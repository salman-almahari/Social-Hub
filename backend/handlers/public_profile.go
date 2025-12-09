package handlers

import (
	"encoding/json"
	"net/http"
	"social-network/database"
	"social-network/sessions"
	"strings"
)

func PublicProfileHandler(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/user/")
	nickname := strings.TrimSpace(path)

	if nickname == "" {
		http.Error(w, "Nickname is required", http.StatusBadRequest)
		return
	}

	// Get current user ID from session
	viewerID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		// If no session, use 0 as viewer ID (not logged in)
		viewerID = 0
	}

	profile, err := database.GetUserPublicProfileByNickname(database.Db, nickname, viewerID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if strings.ToLower(profile.IsPublic) != "public" {
		profile.FirstName = ""
		profile.LastName = ""
		profile.Email = ""
		profile.Gender = ""
		profile.Age = 0
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}
