package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"socialhub/database"
	"time"
)

type Message struct {
	From string    `json:"from"`
	To   string    `json:"to"`
	Text string    `json:"text"`
	Time time.Time `json:"time"`
}

func StoreMessageHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("Received message request: %s %s\n", r.Method, r.URL.Path) // Debug log

	if r.Method != http.MethodPost {
		fmt.Println("Invalid method:", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var message Message
	if err := json.NewDecoder(r.Body).Decode(&message); err != nil {
		fmt.Printf("Decoding error: %v\n", err)
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	fmt.Printf("Received message: %+v\n", message) // Debug log

	if message.From == "" || message.To == "" || message.Text == "" {
		fmt.Println("Missing required fields")
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	query := `
        INSERT INTO messages (sender, recipient, message, timestamp)
        VALUES ($1, $2, $3, $4)
    `
	timestamp := time.Now().Format(time.RFC3339)

	if _, err := database.Db.Exec(query, message.From, message.To, message.Text, timestamp); err != nil {
		fmt.Printf("Database error: %v\n", err)
		http.Error(w, "Failed to store message: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get recipient's user ID for notification
	var recipientID int
	recipientErr := database.Db.QueryRow("SELECT uid FROM users WHERE nickname = ?", message.To).Scan(&recipientID)
	if recipientErr != nil {
		// Log error but don't fail the message storage
		fmt.Printf("Warning: Failed to get recipient ID for notification: %v\n", recipientErr)
	} else {
		// Create notification for the recipient
		CreateNewMessageNotification(recipientID, message.From)
	}

	fmt.Println("Message stored successfully") // Debug log
	w.WriteHeader(http.StatusOK)
}

func GetMessagesHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("Method: %s | Path: %s\n", r.Method, r.URL.Path)

	if r.Method != http.MethodGet {
		fmt.Println("Rejected due to method")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get query parameters
	query := r.URL.Query()
	currentUser := query.Get("user")
	recipient := query.Get("recipient")

	if currentUser == "" || recipient == "" {
		http.Error(w, "Missing user or recipient parameters", http.StatusBadRequest)
		return
	}

	// Fetch conversation between two users
	rows, err := database.Db.Query(`
		SELECT
			sender,
			recipient,
			message,
			timestamp
		FROM messages
		WHERE 
			(sender = $1 AND recipient = $2) OR
			(sender = $3 AND recipient = $4)
		ORDER BY timestamp ASC
	`, currentUser, recipient, recipient, currentUser)

	if err != nil {
		fmt.Printf("Database error: %v\n", err)
		http.Error(w, "Failed to fetch messages: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var messages []Message

	for rows.Next() {
		var msg Message
		var timestamp string

		err := rows.Scan(
			&msg.From,
			&msg.To,
			&msg.Text,
			&timestamp,
		)
		if err != nil {
			fmt.Printf("Scanning error: %v\n", err)
			continue
		}

		// Parse timestamp string to time.Time
		msg.Time, err = time.Parse(time.RFC3339, timestamp)
		if err != nil {
			fmt.Printf("Time parsing error: %v\n", err)
			continue
		}
		messages = append(messages, msg)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// Handler: GET /messages/unread/count?user=...
func GetUnreadMessageCountHandler(w http.ResponseWriter, r *http.Request) {
	user := r.URL.Query().Get("user")
	if user == "" {
		http.Error(w, "Missing user parameter", http.StatusBadRequest)
		return
	}
	count, err := database.GetUnreadMessageCount(user)
	if err != nil {
		http.Error(w, "Failed to fetch unread count", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]int{"unread": count})
}

// Handler: GET /messages/unread/by-sender?user=...
func GetUnreadMessageCountBySenderHandler(w http.ResponseWriter, r *http.Request) {
	user := r.URL.Query().Get("user")
	if user == "" {
		http.Error(w, "Missing user parameter", http.StatusBadRequest)
		return
	}
	counts, err := database.GetUnreadMessageCountBySender(user)
	if err != nil {
		http.Error(w, "Failed to fetch unread counts", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(counts)
}

// Handler: POST /messages/mark-read {"user": "...", "sender": "..."}
func MarkMessagesAsReadHandler(w http.ResponseWriter, r *http.Request) {
	type reqBody struct {
		User   string `json:"user"`
		Sender string `json:"sender"`
	}
	var req reqBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.User == "" || req.Sender == "" {
		http.Error(w, "Missing user or sender", http.StatusBadRequest)
		return
	}
	err := database.MarkMessagesAsRead(req.User, req.Sender)
	if err != nil {
		http.Error(w, "Failed to mark messages as read", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
