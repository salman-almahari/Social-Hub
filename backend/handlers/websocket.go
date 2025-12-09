package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"social-network/database"
	"social-network/notify"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Connection struct {
	conn     *websocket.Conn
	userID   int
	nickname string
	groups   map[int]bool
}

var (
	userConnections  = make(map[string]*Connection)
	groupConnections = make(map[int]map[int]*Connection)
)

type WebSocketMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type ChatMessage struct {
	To      string `json:"to"`
	Message string `json:"message"`
}

type GroupChatMessage struct {
	GroupID int    `json:"groupId"`
	Content string `json:"content"`
}

type GroupSubscription struct {
	GroupID int `json:"groupId"`
}

type ChatResponse struct {
	From      string `json:"from"`
	To        string `json:"to"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

type GroupChatResponse struct {
	Sender    string `json:"sender"`
	Content   string `json:"content"`
	Timestamp string `json:"timestamp"`
	GroupID   int    `json:"groupId"`
}

var notifyFollowStatusUpdateFunc func(string, string)

func SetNotifyFollowStatusUpdate(fn func(string, string)) {
	notifyFollowStatusUpdateFunc = fn
}

func UnifiedWebSocketHandler(w http.ResponseWriter, r *http.Request) {
	userCookie, err := r.Cookie("session_id")
	if err != nil {
		log.Println("Error retrieving session_id:", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	sessionID := userCookie.Value
	userID, err := database.GetUserIDBySession(sessionID)
	if err != nil {
		log.Println("Invalid session:", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	nickname, err := database.GetNickname(userID)
	if err != nil {
		log.Println("Error getting nickname:", err)
		nickname = "Guest"
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading to WebSocket:", err)
		return
	}
	defer conn.Close()

	connection := &Connection{
		conn:     conn,
		userID:   userID,
		nickname: nickname,
		groups:   make(map[int]bool),
	}

	userConnections[nickname] = connection
	log.Printf("User %s connected via unified WebSocket", nickname)

	pendingMessages, err := database.GetMessagesForUser(nickname)
	if err != nil {
		log.Println("Error fetching pending messages:", err)
	} else {
		for _, msg := range pendingMessages {
			response := ChatResponse{
				From:      msg.Sender,
				To:        nickname,
				Message:   msg.Message,
				Timestamp: msg.Timestamp,
			}
			conn.WriteJSON(WebSocketMessage{Type: "chat", Data: response})
		}
	}

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Println("Unexpected WebSocket error:", err)
			}
			break
		}

		var wsMsg WebSocketMessage
		if err := json.Unmarshal(message, &wsMsg); err != nil {
			log.Println("Error parsing message:", err)
			continue
		}

		switch wsMsg.Type {
		case "chat":
			handlePrivateChat(connection, wsMsg.Data)
		case "group_subscribe", "subscribe":
			handleGroupSubscription(connection, wsMsg.Data)
		case "group_unsubscribe", "unsubscribe":
			handleGroupUnsubscription(connection, wsMsg.Data)
		case "group_chat":
			handleGroupChat(connection, wsMsg.Data)
		default:
			log.Printf("Unknown message type: %s", wsMsg.Type)
		}
	}

	cleanup(connection)
}

func handlePrivateChat(conn *Connection, data interface{}) {
	rawData, err := json.Marshal(data)
	if err != nil {
		log.Println("Error marshaling chat data:", err)
		return
	}

	var chatMsg ChatMessage
	if err := json.Unmarshal(rawData, &chatMsg); err != nil {
		log.Println("Error parsing chat message:", err)
		return
	}

	timestamp := database.GetCurrentTimestamp()

	err = database.SaveMessage(chatMsg.To, conn.nickname, chatMsg.Message, timestamp)
	if err != nil {
		log.Printf("Failed to save message: %v", err)
		return
	}

	if recipientConn, ok := userConnections[chatMsg.To]; ok {
		response := ChatResponse{
			From:      conn.nickname,
			To:        chatMsg.To,
			Message:   chatMsg.Message,
			Timestamp: timestamp,
		}
		err := recipientConn.conn.WriteJSON(WebSocketMessage{Type: "chat", Data: response})
		if err != nil {
			log.Printf("Error sending message to %s: %v", chatMsg.To, err)
		}
	}

	// Create notification for the recipient
	// Get recipient's user ID
	var recipientID int
	err = database.Db.QueryRow("SELECT uid FROM users WHERE nickname = ?", chatMsg.To).Scan(&recipientID)
	if err != nil {
		log.Printf("Warning: Failed to get recipient ID for notification: %v", err)
	} else {
		// Create notification for the recipient
		CreateNewMessageNotification(recipientID, conn.nickname)
	}
}

func handleGroupSubscription(conn *Connection, data interface{}) {
	rawData, err := json.Marshal(data)
	if err != nil {
		log.Println("Error marshaling subscription data:", err)
		return
	}

	var sub GroupSubscription
	if err := json.Unmarshal(rawData, &sub); err != nil {
		log.Println("Error parsing group subscription:", err)
		return
	}

	var memberCount int
	err = database.Db.QueryRow("SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?",
		sub.GroupID, conn.userID).Scan(&memberCount)
	if err != nil || memberCount == 0 {
		log.Printf("User %s not authorized for group %d", conn.nickname, sub.GroupID)
		return
	}

	conn.groups[sub.GroupID] = true

	if groupConnections[sub.GroupID] == nil {
		groupConnections[sub.GroupID] = make(map[int]*Connection)
	}
	groupConnections[sub.GroupID][conn.userID] = conn

	log.Printf("User %s subscribed to group %d", conn.nickname, sub.GroupID)
}

func handleGroupUnsubscription(conn *Connection, data interface{}) {
	rawData, err := json.Marshal(data)
	if err != nil {
		log.Println("Error marshaling unsubscription data:", err)
		return
	}

	var sub GroupSubscription
	if err := json.Unmarshal(rawData, &sub); err != nil {
		log.Println("Error parsing group unsubscription:", err)
		return
	}

	delete(conn.groups, sub.GroupID)
	if groupConnections[sub.GroupID] != nil {
		delete(groupConnections[sub.GroupID], conn.userID)
		if len(groupConnections[sub.GroupID]) == 0 {
			delete(groupConnections, sub.GroupID)
		}
	}

	log.Printf("User %s unsubscribed from group %d", conn.nickname, sub.GroupID)
}

func handleGroupChat(conn *Connection, data interface{}) {
	rawData, err := json.Marshal(data)
	if err != nil {
		log.Println("Error marshaling group chat data:", err)
		return
	}

	var groupMsg GroupChatMessage
	if err := json.Unmarshal(rawData, &groupMsg); err != nil {
		log.Println("Error parsing group chat message:", err)
		return
	}

	if !conn.groups[groupMsg.GroupID] {
		log.Printf("User %s not subscribed to group %d", conn.nickname, groupMsg.GroupID)
		return
	}

	timestamp := time.Now()
	_, err = database.Db.Exec(
		"INSERT INTO group_messages (group_id, user_id, message, created_at) VALUES (?, ?, ?, ?)",
		groupMsg.GroupID, conn.userID, groupMsg.Content, timestamp,
	)
	if err != nil {
		log.Printf("Failed to save group message: %v", err)
		return
	}

	// Update unread counts for all group members except sender
	if err := UpdateUnreadCounts(groupMsg.GroupID, conn.userID); err != nil {
		log.Printf("Failed to update unread counts: %v", err)
	}

	response := GroupChatResponse{
		Sender:    conn.nickname,
		Content:   groupMsg.Content,
		Timestamp: timestamp.Format(time.RFC3339),
		GroupID:   groupMsg.GroupID,
	}

	broadcastToGroup(groupMsg.GroupID, response)

	// Get group name for notifications
	var groupName string
	err = database.Db.QueryRow("SELECT group_name FROM groups WHERE group_id = ?", groupMsg.GroupID).Scan(&groupName)
	if err != nil {
		// Log error but don't fail the message sending
		log.Printf("Warning: Failed to get group name for notifications: %v", err)
		groupName = "Unknown Group"
	}

	// Create notifications for group members (except the sender)
	rows, err := database.Db.Query("SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?", groupMsg.GroupID, conn.userID)
	if err != nil {
		log.Printf("Warning: Failed to get group members for notifications: %v", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var memberID int
			if err := rows.Scan(&memberID); err != nil {
				continue
			}
			// Create notification for each group member
			CreateGroupMessageNotification(memberID, groupMsg.GroupID, groupName, conn.nickname)
		}
	}
}

func broadcastToGroup(groupID int, message GroupChatResponse) {
	if groupConns, exists := groupConnections[groupID]; exists {
		for userID, conn := range groupConns {
			err := conn.conn.WriteJSON(WebSocketMessage{Type: "group_chat", Data: message})
			if err != nil {
				log.Printf("Failed to send group message to user %d: %v", userID, err)
				conn.conn.Close()
				delete(groupConns, userID)
			}
		}
	}
}

func cleanup(conn *Connection) {
	delete(userConnections, conn.nickname)

	for groupID := range conn.groups {
		if groupConnections[groupID] != nil {
			delete(groupConnections[groupID], conn.userID)
			if len(groupConnections[groupID]) == 0 {
				delete(groupConnections, groupID)
			}
		}
	}

	log.Printf("User %s disconnected and cleaned up", conn.nickname)
}

func NotifyFollowStatusUpdate(nickname string, status string) {
	log.Printf("Notifying %s about follow status update: %s", nickname, status)
	if conn, ok := userConnections[nickname]; ok {
		message := WebSocketMessage{
			Type: "follow_status_update",
			Data: map[string]string{"status": status},
		}
		err := conn.conn.WriteJSON(message)
		if err != nil {
			log.Printf("Error sending follow status update to %s: %v", nickname, err)
			delete(userConnections, nickname)
		}
	}
}

func BroadcastUserListUpdate() {
	log.Printf("Broadcasting user list update to %d connected clients", len(userConnections))
	message := WebSocketMessage{
		Type: "user_list_update",
		Data: nil,
	}
	for nickname, conn := range userConnections {
		err := conn.conn.WriteJSON(message)
		if err != nil {
			log.Printf("Error broadcasting to %s: %v", nickname, err)
			delete(userConnections, nickname)
		}
	}
}

// BroadcastNotificationUpdate sends real-time notification updates to all users in a group
func BroadcastNotificationUpdate(groupID int, senderID int) {
	// Get all group members except the sender
	rows, err := database.Db.Query(`
		SELECT user_id FROM group_members 
		WHERE group_id = ? AND user_id != ?
	`, groupID, senderID)
	if err != nil {
		log.Printf("Failed to get group members for notification broadcast: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var userID int
		if err := rows.Scan(&userID); err != nil {
			continue
		}

		// Get user's nickname
		var nickname string
		err = database.Db.QueryRow("SELECT nickname FROM users WHERE uid = ?", userID).Scan(&nickname)
		if err != nil {
			log.Printf("Failed to get nickname for user %d: %v", userID, err)
			continue
		}

		// Send notification update to the user
		if conn, ok := userConnections[nickname]; ok {
			message := WebSocketMessage{
				Type: "notification_update",
				Data: map[string]interface{}{
					"group_id": groupID,
					"action":   "new_message",
				},
			}
			err := conn.conn.WriteJSON(message)
			if err != nil {
				log.Printf("Error sending notification update to %s: %v", nickname, err)
				delete(userConnections, nickname)
			}
		}
	}
}

// BroadcastEventNotificationUpdate sends real-time event notification updates to all users in a group
func BroadcastEventNotificationUpdate(eventID int, groupID int, creatorID int) {
	// Get all group members except the creator
	rows, err := database.Db.Query(`
		SELECT user_id FROM group_members 
		WHERE group_id = ? AND user_id != ?
	`, groupID, creatorID)
	if err != nil {
		log.Printf("Failed to get group members for event notification broadcast: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var userID int
		if err := rows.Scan(&userID); err != nil {
			continue
		}

		// Get user's nickname
		var nickname string
		err = database.Db.QueryRow("SELECT nickname FROM users WHERE uid = ?", userID).Scan(&nickname)
		if err != nil {
			log.Printf("Failed to get nickname for user %d: %v", userID, err)
			continue
		}

		// Send event notification update to the user
		if conn, ok := userConnections[nickname]; ok {
			message := WebSocketMessage{
				Type: "event_notification_update",
				Data: map[string]interface{}{
					"event_id": eventID,
					"group_id": groupID,
					"action":   "new_event",
				},
			}
			err := conn.conn.WriteJSON(message)
			if err != nil {
				log.Printf("Error sending event notification update to %s: %v", nickname, err)
				delete(userConnections, nickname)
			}
		}
	}
}

// BroadcastRequestUpdate sends real-time request updates to a specific user
func BroadcastRequestUpdate(nickname string, requestType string) {
	if conn, ok := userConnections[nickname]; ok {
		message := WebSocketMessage{
			Type: requestType,
			Data: map[string]interface{}{
				"action": "new_request",
			},
		}
		err := conn.conn.WriteJSON(message)
		if err != nil {
			log.Printf("Error sending request update to %s: %v", nickname, err)
			delete(userConnections, nickname)
		}
	}
}

func InitializeWebSocketNotifications() {
	if notifyFollowStatusUpdateFunc != nil {
		notifyFollowStatusUpdateFunc = NotifyFollowStatusUpdate
	}
	notify.SetBroadcastFunction(BroadcastUserListUpdate)
}

// BroadcastNotificationToUser - Send notification to a specific user via WebSocket
func BroadcastNotificationToUser(userID int, notificationType string, message string, relatedID *int) {
	// Find the user's connection
	var userConn *Connection
	for _, conn := range userConnections {
		if conn.userID == userID {
			userConn = conn
			break
		}
	}

	if userConn == nil {
		// User is not connected, notification will be stored in database
		return
	}

	notificationMessage := WebSocketMessage{
		Type: "notification",
		Data: map[string]interface{}{
			"type":       notificationType,
			"message":    message,
			"related_id": relatedID,
			"timestamp":  time.Now().Unix(),
		},
	}

	messageJSON, err := json.Marshal(notificationMessage)
	if err != nil {
		log.Println("Error marshaling notification message:", err)
		return
	}

	if err := userConn.conn.WriteMessage(websocket.TextMessage, messageJSON); err != nil {
		log.Println("Error sending notification:", err)
	}
}
