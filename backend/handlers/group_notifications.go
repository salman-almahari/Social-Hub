package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"social-network/database"
)

// GroupNotification represents a group notification record
type GroupNotification struct {
	GroupID           int `json:"group_id"`
	UserID            int `json:"user_id"`
	LastReadMessageID int `json:"last_read_message_id"`
	UnreadCount       int `json:"unread_count"`
}

// GetGroupNotificationsHandler returns unread message counts for all groups
func GetGroupNotificationsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUserID := getUserIDFromContext(r.Context())
	if currentUserID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get all groups the user is a member of with their unread counts
	rows, err := database.Db.Query(`
		SELECT 
			g.group_id,
			g.group_name,
			COALESCE(gn.unread_count, 0) as unread_count
		FROM groups g
		JOIN group_members gm ON g.group_id = gm.group_id
		LEFT JOIN group_message_notifications gn ON g.group_id = gn.group_id AND gn.user_id = ?
		WHERE gm.user_id = ?
		ORDER BY g.group_name
	`, currentUserID, currentUserID)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var notifications []map[string]interface{}
	totalUnread := 0

	for rows.Next() {
		var groupID int
		var groupName string
		var unreadCount int

		if err := rows.Scan(&groupID, &groupName, &unreadCount); err != nil {
			http.Error(w, "Scan error: "+err.Error(), http.StatusInternalServerError)
			return
		}

		totalUnread += unreadCount

		notifications = append(notifications, map[string]interface{}{
			"group_id":     groupID,
			"group_name":   groupName,
			"unread_count": unreadCount,
		})
	}

	response := map[string]interface{}{
		"notifications": notifications,
		"total_unread":  totalUnread,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// MarkGroupAsReadHandler marks all messages in a group as read for the current user
func MarkGroupAsReadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUserID := getUserIDFromContext(r.Context())
	if currentUserID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	groupIDStr := r.URL.Query().Get("group_id")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group_id", http.StatusBadRequest)
		return
	}

	// Check if user is a member of the group
	var memberCount int
	err = database.Db.QueryRow("SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?",
		groupID, currentUserID).Scan(&memberCount)
	if err != nil || memberCount == 0 {
		http.Error(w, "Access denied - not a group member", http.StatusForbidden)
		return
	}

	// Get the latest message ID for this group
	var latestMessageID int
	err = database.Db.QueryRow("SELECT COALESCE(MAX(id), 0) FROM group_messages WHERE group_id = ?", groupID).Scan(&latestMessageID)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Insert or update the notification record
	_, err = database.Db.Exec(`
		INSERT OR REPLACE INTO group_message_notifications (group_id, user_id, last_read_message_id, unread_count)
		VALUES (?, ?, ?, 0)
	`, groupID, currentUserID, latestMessageID)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// UpdateUnreadCounts updates unread counts for all group members when a new message is sent
func UpdateUnreadCounts(groupID int, senderID int) error {
	// Use a transaction to avoid database locking issues
	tx, err := database.Db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback() // Will be ignored if tx.Commit() is called

	// Get all group members except the sender
	rows, err := tx.Query(`
		SELECT user_id FROM group_members 
		WHERE group_id = ? AND user_id != ?
	`, groupID, senderID)
	if err != nil {
		return fmt.Errorf("failed to get group members: %v", err)
	}
	defer rows.Close()

	for rows.Next() {
		var userID int
		if err := rows.Scan(&userID); err != nil {
			continue
		}

		// Use INSERT OR REPLACE to handle both insert and update cases atomically
		_, err = tx.Exec(`
			INSERT OR REPLACE INTO group_message_notifications (group_id, user_id, unread_count) 
			VALUES (?, ?, COALESCE((SELECT unread_count FROM group_message_notifications WHERE group_id = ? AND user_id = ?), 0) + 1)
		`, groupID, userID, groupID, userID)

		if err != nil {
			fmt.Printf("Failed to update unread count for user %d: %v\n", userID, err)
		}
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %v", err)
	}

	// Send real-time notification updates to all affected users
	BroadcastNotificationUpdate(groupID, senderID)

	return nil
}
