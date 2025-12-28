package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"socialhub/database"
	"socialhub/sessions"
)

// EventNotification represents an event notification for a user
type EventNotification struct {
	EventID     int    `json:"event_id"`
	GroupID     int    `json:"group_id"`
	GroupName   string `json:"group_name"`
	EventTitle  string `json:"event_title"`
	EventTime   string `json:"event_time"`
	UnreadCount int    `json:"unread_count"`
}

// GetEventNotificationsHandler fetches unread event notifications for the current user
func GetEventNotificationsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get unread event notifications for groups the user is a member of
	rows, err := database.Db.Query(`
		SELECT 
			e.id as event_id,
			e.group_id,
			g.group_name,
			e.title as event_title,
			e.event_time,
			COUNT(n.id) as unread_count
		FROM group_events e
		JOIN groups g ON e.group_id = g.group_id
		JOIN group_members gm ON g.group_id = gm.group_id
		LEFT JOIN notifications n ON e.id = n.related_id AND n.user_id = ? AND n.type = 'event_created' AND n.is_read = 0
		WHERE gm.user_id = ? AND e.event_time > datetime('now')
		GROUP BY e.id, e.group_id, g.group_name, e.title, e.event_time
		HAVING unread_count > 0
		ORDER BY e.event_time ASC
	`, userID, userID)
	if err != nil {
		fmt.Printf("Database error in GetEventNotificationsHandler: %v\n", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var notifications []EventNotification
	var totalUnread int

	for rows.Next() {
		var notification EventNotification
		err := rows.Scan(
			&notification.EventID,
			&notification.GroupID,
			&notification.GroupName,
			&notification.EventTitle,
			&notification.EventTime,
			&notification.UnreadCount,
		)
		if err != nil {
			fmt.Printf("Error scanning event notifications: %v\n", err)
			continue
		}
		notifications = append(notifications, notification)
		totalUnread += notification.UnreadCount
	}

	response := map[string]interface{}{
		"notifications": notifications,
		"total_unread":  totalUnread,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// MarkEventAsReadHandler marks all notifications for a specific event as read
func MarkEventAsReadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var request struct {
		EventID int `json:"event_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Mark all event notifications for this user and event as read
	result, err := database.Db.Exec(`
		UPDATE notifications 
		SET is_read = 1 
		WHERE user_id = ? AND related_id = ? AND type = 'event_created'
	`, userID, request.EventID)
	if err != nil {
		fmt.Printf("Database error in MarkEventAsReadHandler: %v\n", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		fmt.Printf("Error getting rows affected: %v\n", err)
	}

	fmt.Printf("Marked %d event notifications as read for user %d, event %d\n", rowsAffected, userID, request.EventID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":       "Event marked as read",
		"rows_affected": rowsAffected,
	})
}

// UpdateEventUnreadCounts increments unread counts for all group members when a new event is created
func UpdateEventUnreadCounts(eventID int, groupID int, creatorID int) error {
	tx, err := database.Db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback() // Will be ignored if tx.Commit() is called

	// Get all group members except the creator
	rows, err := tx.Query(`
		SELECT user_id FROM group_members 
		WHERE group_id = ? AND user_id != ?
	`, groupID, creatorID)
	if err != nil {
		return fmt.Errorf("failed to get group members: %v", err)
	}
	defer rows.Close()

	// Create notifications for each member
	for rows.Next() {
		var userID int
		if err := rows.Scan(&userID); err != nil {
			continue
		}

		// Check if notification already exists
		var existingID int
		err = tx.QueryRow(`
			SELECT id FROM notifications 
			WHERE user_id = ? AND related_id = ? AND type = 'event_created'
		`, userID, eventID).Scan(&existingID)

		if err == sql.ErrNoRows {
			// Create new notification
			_, err = tx.Exec(`
				INSERT INTO notifications (user_id, type, message, is_read, related_id, created_at)
				VALUES (?, 'event_created', 'New event created in your group', 0, ?, datetime('now'))
			`, userID, eventID)
			if err != nil {
				fmt.Printf("Failed to create event notification for user %d: %v\n", userID, err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %v", err)
	}

	// Send real-time notification updates to all affected users
	BroadcastEventNotificationUpdate(eventID, groupID, creatorID)

	return nil
}
