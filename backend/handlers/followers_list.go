package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"social-network/database"
	"social-network/sessions"
	"strings"
)

func GetFollowersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract nickname from URL path
	fmt.Printf("Followers Request URL: %s\n", r.URL.Path)
	pathParts := strings.Split(r.URL.Path, "/")
	fmt.Printf("Followers Path parts: %v\n", pathParts)
	if len(pathParts) < 3 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}
	targetNickname := pathParts[2]
	fmt.Printf("Followers Target nickname: %s\n", targetNickname)

	// Get current user ID from session
	viewerID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check if viewer can see followers
	fmt.Printf("Followers: Checking visibility for %s by user %d\n", targetNickname, viewerID)
	canView, err := database.CanViewFollowers(targetNickname, viewerID)
	if err != nil {
		fmt.Printf("Followers: Error checking follower visibility: %v\n", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	fmt.Printf("Followers: Can view: %t\n", canView)

	if !canView {
		fmt.Printf("Followers: Access denied for user %d viewing %s\n", viewerID, targetNickname)
		http.Error(w, "Cannot view followers for this user", http.StatusForbidden)
		return
	}

	// Get followers list
	followers, err := database.GetFollowersByNickname(targetNickname)
	if err != nil {
		fmt.Println("Error fetching followers:", err)
		http.Error(w, "Failed to fetch followers", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"users": followers,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func GetFollowingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract nickname from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 3 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}
	targetNickname := pathParts[2]

	// Get current user ID from session
	viewerID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check if viewer can see following
	canView, err := database.CanViewFollowers(targetNickname, viewerID)
	if err != nil {
		fmt.Println("Error checking following visibility:", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if !canView {
		http.Error(w, "Cannot view following for this user", http.StatusForbidden)
		return
	}

	// Get following list
	following, err := database.GetFollowingByNickname(targetNickname)
	if err != nil {
		fmt.Println("Error fetching following:", err)
		http.Error(w, "Failed to fetch following", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"users": following,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetMyFollowersHandler gets the current user's followers for post permission management
func GetMyFollowersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get current user ID from session
	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get current user's nickname
	nickname, err := database.GetNicknameByUserID(userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Get followers list
	followers, err := database.GetFollowersByNickname(nickname)
	if err != nil {
		fmt.Println("Error fetching followers:", err)
		http.Error(w, "Failed to fetch followers", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"followers": followers,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
