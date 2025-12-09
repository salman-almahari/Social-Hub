package handlers

import (
	"encoding/json"
	"net/http"
	"social-network/database"
	"strconv"
	"strings"
	"fmt"
	"time"
)

type Notification struct {
	ID        int    `json:"id"`
	UserID    int    `json:"user_id"`
	Type      string `json:"type"`
	Message   string `json:"message"`
	IsRead    int    `json:"is_read"`
	RelatedID *int   `json:"related_id,omitempty"`
	CreatedAt string `json:"created_at"`
}

// GetNotificationsHandler - Get all notifications for the authenticated user
func GetNotificationsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context (set by RequireAuth middleware)
	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Query notifications for the user, ordered by most recent first
	rows, err := database.Db.Query(`
		SELECT id, user_id, type, message, is_read, related_id, created_at
		FROM notifications 
		WHERE user_id = ?
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		http.Error(w, "Failed to fetch notifications: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var notifications []Notification
	for rows.Next() {
		var notification Notification
		var relatedID *int
		err := rows.Scan(
			&notification.ID,
			&notification.UserID,
			&notification.Type,
			&notification.Message,
			&notification.IsRead,
			&relatedID,
			&notification.CreatedAt,
		)
		if err != nil {
			http.Error(w, "Error scanning notification: "+err.Error(), http.StatusInternalServerError)
			return
		}
		notification.RelatedID = relatedID
		notifications = append(notifications, notification)
	}

	// Return notifications as JSON
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notifications)
}

// MarkNotificationsAsReadHandler - Mark notifications as read
func MarkNotificationsAsReadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context (set by RequireAuth middleware)
	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var request struct {
		NotificationIDs []int `json:"notification_ids"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if len(request.NotificationIDs) == 0 {
		http.Error(w, "No notification IDs provided", http.StatusBadRequest)
		return
	}

	// Build the SQL query with placeholders
	placeholders := make([]string, len(request.NotificationIDs))
	args := make([]interface{}, len(request.NotificationIDs)+1)
	args[0] = userID
	
	for i, id := range request.NotificationIDs {
		placeholders[i] = "?"
		args[i+1] = id
	}

	query := "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (" + strings.Join(placeholders, ",") + ")"

	// Execute the update
	result, err := database.Db.Exec(query, args...)
	if err != nil {
		http.Error(w, "Failed to mark notifications as read: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		http.Error(w, "Failed to get affected rows: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Notifications marked as read",
		"affected_rows": rowsAffected,
	})
}

// DeleteNotificationHandler - Delete a specific notification
func DeleteNotificationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context (set by RequireAuth middleware)
	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract notification ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 3 {
		http.Error(w, "Invalid notification ID", http.StatusBadRequest)
		return
	}

	notificationID, err := strconv.Atoi(pathParts[len(pathParts)-1])
	if err != nil {
		http.Error(w, "Invalid notification ID", http.StatusBadRequest)
		return
	}

	// Delete the notification (only if it belongs to the authenticated user)
	result, err := database.Db.Exec(
		"DELETE FROM notifications WHERE id = ? AND user_id = ?",
		notificationID, userID,
	)
	if err != nil {
		http.Error(w, "Failed to delete notification: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		http.Error(w, "Failed to get affected rows: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if rowsAffected == 0 {
		http.Error(w, "Notification not found or access denied", http.StatusNotFound)
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Notification deleted successfully",
		"deleted_id": notificationID,
	})
}

// ============================================================================
// NOTIFICATION CREATION FUNCTIONS
// ============================================================================

// CreateNotification - Helper function to create a notification
func CreateNotification(userID int, notificationType string, message string, relatedID *int) error {
	_, err := database.Db.Exec(`
		INSERT INTO notifications (user_id, type, message, is_read, related_id, created_at)
		VALUES (?, ?, ?, 0, ?, ?)
	`, userID, notificationType, message, relatedID, time.Now().Format("2006-01-02 15:04:05"))
	
	if err != nil {
		fmt.Printf("Error creating notification: %v\n", err)
		return err
	}
	
	fmt.Printf("Created notification for user %d: %s - %s\n", userID, notificationType, message)
	
	// Also broadcast via WebSocket if user is connected
	BroadcastNotificationToUser(userID, notificationType, message, relatedID)
	
	return nil
}

// CreateFollowRequestNotification - Create notification when someone sends a follow request
func CreateFollowRequestNotification(followerID int, targetUserID int, followerNickname string) error {
	message := fmt.Sprintf("%s sent you a follow request", followerNickname)
	return CreateNotification(targetUserID, "follow_request", message, &followerID)
}

// CreateFollowAcceptedNotification - Create notification when a follow request is accepted
func CreateFollowAcceptedNotification(targetUserID int, followerID int, targetNickname string) error {
	message := fmt.Sprintf("%s accepted your follow request", targetNickname)
	return CreateNotification(followerID, "follow_request", message, &targetUserID)
}

// CreateGroupInviteNotification - Create notification when someone is invited to a group
func CreateGroupInviteNotification(invitedUserID int, groupID int, groupName string, inviterNickname string) error {
	message := fmt.Sprintf("%s invited you to join the group '%s'", inviterNickname, groupName)
	return CreateNotification(invitedUserID, "group_invite", message, &groupID)
}

// CreateGroupJoinRequestNotification - Create notification when someone requests to join a group
func CreateGroupJoinRequestNotification(groupAdminID int, groupID int, groupName string, requesterNickname string) error {
	message := fmt.Sprintf("%s requested to join the group '%s'", requesterNickname, groupName)
	return CreateNotification(groupAdminID, "group_join_request", message, &groupID)
}

// CreateGroupJoinAcceptedNotification - Create notification when a group join request is accepted
func CreateGroupJoinAcceptedNotification(requesterID int, groupID int, groupName string) error {
	message := fmt.Sprintf("Your request to join the group '%s' was accepted", groupName)
	return CreateNotification(requesterID, "group_join_request", message, &groupID)
}

// CreateEventCreatedNotification - Create notification when a new event is created in a group
func CreateEventCreatedNotification(groupMemberID int, groupID int, groupName string, eventTitle string, creatorNickname string) error {
	message := fmt.Sprintf("%s created a new event '%s' in the group '%s'", creatorNickname, eventTitle, groupName)
	return CreateNotification(groupMemberID, "event_created", message, &groupID)
}

// CreatePostInteractionNotification - Create notification for likes, comments, etc.
func CreatePostInteractionNotification(postOwnerID int, postID int, interactionType string, interactorNickname string) error {
	var message string
	switch interactionType {
	case "like":
		message = fmt.Sprintf("%s liked your post", interactorNickname)
	case "comment":
		message = fmt.Sprintf("%s commented on your post", interactorNickname)
	case "dislike":
		message = fmt.Sprintf("%s disliked your post", interactorNickname)
	default:
		message = fmt.Sprintf("%s interacted with your post", interactorNickname)
	}
	
	return CreateNotification(postOwnerID, "post_interaction", message, &postID)
}

// CreatePostMentionNotification - Create notification when someone mentions a user in a post
func CreatePostMentionNotification(mentionedUserID int, postID int, mentionerNickname string) error {
	message := fmt.Sprintf("%s mentioned you in a post", mentionerNickname)
	return CreateNotification(mentionedUserID, "post_interaction", message, &postID)
}

// CreateGroupEventReminderNotification - Create notification for event reminders
func CreateGroupEventReminderNotification(memberID int, groupID int, groupName string, eventTitle string, eventTime string) error {
	message := fmt.Sprintf("Reminder: Event '%s' in group '%s' starts at %s", eventTitle, groupName, eventTime)
	return CreateNotification(memberID, "event_created", message, &groupID)
}

// CreateGroupRoleChangeNotification - Create notification when someone's role changes in a group
func CreateGroupRoleChangeNotification(userID int, groupID int, groupName string, newRole string, adminNickname string) error {
	message := fmt.Sprintf("%s changed your role to %s in the group '%s'", adminNickname, newRole, groupName)
	return CreateNotification(userID, "group_invite", message, &groupID)
}

// CreateGroupPostNotification - Create notification when someone posts in a group
func CreateGroupPostNotification(groupMemberID int, groupID int, groupName string, posterNickname string) error {
	message := fmt.Sprintf("%s posted in the group '%s'", posterNickname, groupName)
	return CreateNotification(groupMemberID, "post_interaction", message, &groupID)
}

// CreateNewMessageNotification - Create notification when someone sends a new message
func CreateNewMessageNotification(recipientID int, senderNickname string) error {
	message := fmt.Sprintf("%s sent you a new message", senderNickname)
	return CreateNotification(recipientID, "new_message", message, nil)
}

// CreateGroupMessageNotification - Create notification when someone sends a message in a group
func CreateGroupMessageNotification(groupMemberID int, groupID int, groupName string, senderNickname string) error {
	message := fmt.Sprintf("%s sent a message in the group '%s'", senderNickname, groupName)
	return CreateNotification(groupMemberID, "group_message", message, &groupID)
} 