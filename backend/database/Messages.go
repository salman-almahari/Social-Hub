package database

import (
	"fmt"
	"time"
)

// Define Message struct with correct field names
type Message struct {
	MessageID int    `json:"message_id"`
	Sender    string `json:"sender"`
	Recipient string `json:"recipient"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

// Save a message to the database
func SaveMessage(recipient, sender, message, timestamp string) error {
	query := `INSERT INTO messages (recipient, sender, message, timestamp) 
             VALUES (?, ?, ?, ?)`
	result, err := Db.Exec(query, recipient, sender, message, timestamp)
	if err != nil {
		return fmt.Errorf("failed to save message: %v", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error checking rows affected: %v", err)
	}

	if rows == 0 {
		return fmt.Errorf("message not saved")
	}

	return nil
}

// Fetch undelivered messages for a user
func GetMessagesForUser(recipient string) ([]Message, error) {
	query := "SELECT message_id, sender, message, timestamp FROM messages WHERE recipient = ?"
	rows, err := Db.Query(query, recipient)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve messages: %v", err)
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		if err := rows.Scan(&msg.MessageID, &msg.Sender, &msg.Message, &msg.Timestamp); err != nil {
			return nil, fmt.Errorf("error scanning row: %v", err)
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

// Mark messages as delivered (if applicable)
func MarkMessagesAsDelivered(recipient string) error {
	query := "DELETE FROM messages WHERE recipient = ?"
	_, err := Db.Exec(query, recipient) // Remove delivered messages (or update their status if needed)
	if err != nil {
		return fmt.Errorf("failed to mark messages as delivered: %v", err)
	}
	return nil
}

func GetCurrentTimestamp() string {
	return time.Now().Format(time.RFC3339) // Produces "2025-06-18T14:16:56Z"

}

// Get full chat history between two users
func GetChatHistory(user1, user2 string) ([]Message, error) {
	fmt.Println("Fetching chat history between:", user1, "and", user2)

	query := `
		SELECT message_id, sender, recipient, message, timestamp 
		FROM messages 
		WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?)
		ORDER BY timestamp ASC
	`

	rows, err := Db.Query(query, user1, user2, user2, user1)
	if err != nil {
		fmt.Println("Error querying chat history:", err)
		return nil, err
	}
	defer rows.Close()

	var history []Message
	for rows.Next() {
		var msg Message
		if err := rows.Scan(&msg.MessageID, &msg.Sender, &msg.Recipient, &msg.Message, &msg.Timestamp); err != nil {
			fmt.Println("Error scanning row:", err)
			continue
		}
		fmt.Printf("Found message: %+v\n", msg)
		history = append(history, msg)
	}

	fmt.Printf("Total messages found: %d\n", len(history))
	return history, nil
}

// Get total unread message count for a user
func GetUnreadMessageCount(user string) (int, error) {
	query := `SELECT COUNT(*) FROM messages WHERE recipient = ? AND is_read = 0`
	var count int
	err := Db.QueryRow(query, user).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

// Get unread message count per sender for a user
func GetUnreadMessageCountBySender(user string) (map[string]int, error) {
	query := `SELECT sender, COUNT(*) FROM messages WHERE recipient = ? AND is_read = 0 GROUP BY sender`
	rows, err := Db.Query(query, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var sender string
		var count int
		if err := rows.Scan(&sender, &count); err != nil {
			return nil, err
		}
		counts[sender] = count
	}
	return counts, nil
}

// Mark all messages from sender to user as read
func MarkMessagesAsRead(user, sender string) error {
	query := `UPDATE messages SET is_read = 1 WHERE recipient = ? AND sender = ? AND is_read = 0`
	_, err := Db.Exec(query, user, sender)
	return err
}

func IsFollowing(followerNickname, followeeNickname string) (bool, error) {
	followerID, err := GetUserIDByNickname(followerNickname)
	if err != nil {
		fmt.Printf("Error getting followerID for %s: %v\n", followerNickname, err)
		return false, err
	}
	followeeID, err := GetUserIDByNickname(followeeNickname)
	if err != nil {
		fmt.Printf("Error getting followeeID for %s: %v\n", followeeNickname, err)
		return false, err
	}
	var exists bool
	err = Db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? AND status = 'accepted'
		)
	`, followerID, followeeID).Scan(&exists)
	return exists, err
}

func IsPublic(username string) (bool, error) {
	var isPublicStr string
	err := Db.QueryRow("SELECT is_public FROM users WHERE nickname = ?", username).Scan(&isPublicStr)
	if err != nil {
		return false, err
	}
	return isPublicStr == "public", nil
}
