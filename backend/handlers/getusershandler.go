package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"socialhub/database"
)

func GetAllNicknamesHandler(w http.ResponseWriter, r *http.Request) {
	// Get all nicknames and avatar_urls from DB
	rows, err := database.Db.Query("SELECT nickname, COALESCE(avatar_url, '') FROM users")
	if err != nil {
		http.Error(w, "Failed to retrieve users", http.StatusInternalServerError)
		log.Println("DB error:", err)
		return
	}
	defer rows.Close()

	var users []map[string]string
	for rows.Next() {
		var nickname, avatarURL string
		if err := rows.Scan(&nickname, &avatarURL); err != nil {
			log.Println("Row scan error:", err)
			continue
		}
		users = append(users, map[string]string{
			"nickname":       nickname,
			"profilePicture": avatarURL,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"users": users,
	})
}
