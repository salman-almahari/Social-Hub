package handlers

import (
	"encoding/json"
	"net/http"
	"socialhub/database"
	"strconv"
	"time"
)

type CreateGroupEventRequest struct {
	GroupID     int    `json:"groupId"`
	Title       string `json:"title"`
	Description string `json:"description"`
	EventDate   string `json:"eventDate"`
}

type EventResponseRequest struct {
	EventID  int    `json:"eventId"`
	Response string `json:"response"`
}

func GetGroupMessagesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	
	if r.Method != http.MethodGet {
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

	var memberCount int
	err = database.Db.QueryRow("SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?",
		groupID, currentUserID).Scan(&memberCount)
	if err != nil || memberCount == 0 {
		http.Error(w, "Access denied - not a group member", http.StatusForbidden)
		return
	}

	rows, err := database.Db.Query(`
		SELECT users.nickname, gm.message, gm.created_at
		FROM group_messages gm
		JOIN users ON gm.user_id = users.uid
		WHERE gm.group_id = ?
		ORDER BY gm.created_at ASC
	`, groupID)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var messages []map[string]interface{}
	for rows.Next() {
		var sender, content string
		var timestamp time.Time

		if err := rows.Scan(&sender, &content, &timestamp); err != nil {
			http.Error(w, "Scan error: "+err.Error(), http.StatusInternalServerError)
			return
		}

		messages = append(messages, map[string]interface{}{
			"sender":    sender,
			"content":   content,
			"timestamp": timestamp,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}