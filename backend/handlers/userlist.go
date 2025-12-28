package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"socialhub/database"
)

func ChatRecentUsersHandler(w http.ResponseWriter, r *http.Request) {
	user := r.URL.Query().Get("user")
	if user == "" {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"error": "Missing 'user' query param"}`, http.StatusBadRequest)
		return
	}

	query := `
		SELECT other_user
		FROM (
			SELECT 
				CASE
					WHEN sender = ? THEN recipient
					WHEN recipient = ? THEN sender
				END AS other_user,
				MAX(timestamp) AS last_time
			FROM messages
			WHERE sender = ? OR recipient = ?
			GROUP BY other_user
		)
		ORDER BY last_time DESC
	`

	rows, err := database.Db.Query(query, user, user, user, user)
	if err != nil {
		log.Printf("Query error for user %s: %v\n", user, err)
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []string
	for rows.Next() {
		var other string
		if err := rows.Scan(&other); err != nil {
			log.Println("Row scan error:", err)
			continue
		}
		users = append(users, other)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
