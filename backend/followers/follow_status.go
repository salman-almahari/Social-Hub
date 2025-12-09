package followers

import (
	"encoding/json"
	"net/http"
	"social-network/database"
	"social-network/sessions"
)

func FollowStatusHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	targetNickname := r.URL.Query().Get("target_nickname")
	if targetNickname == "" {
		http.Error(w, "Missing target nickname", http.StatusBadRequest)
		return
	}

	_, visibility, err := database.GetUserIDAndVisibilityByNickname(targetNickname)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	
	status, err := GetFollowStatus(userID, targetNickname)
	if err != nil {
		http.Error(w, "Error checking follow status", http.StatusInternalServerError)
		return
	}

	response := map[string]string{
		"status":     status,
		"visibility": visibility,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
