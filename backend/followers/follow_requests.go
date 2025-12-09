package followers

import (
	"encoding/json"
	"net/http"
	"social-network/sessions"
)

func GetFollowRequestsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	requests, err := GetPendingFollowRequests(userID)
	if err != nil {
		http.Error(w, "Failed to fetch requests", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(requests)
}
