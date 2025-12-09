package followers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"social-network/database"
	"social-network/handlers"
	"social-network/sessions"
)

// Import the notification function from main package
var notifyFollowStatusUpdate func(string, string)

// Set the notification function
func SetNotifyFollowStatusUpdate(fn func(string, string)) {
	notifyFollowStatusUpdate = fn
}

func FollowHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	followerID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		fmt.Println("Failed to get follower ID from session:", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	fmt.Println("Follower ID from session:", followerID)

	var req handlers.FollowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Println("Failed to decode request body:", err)
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}
	fmt.Println("Target nickname from request:", req.TargetNickname)

	targetID, visibility, err := database.GetUserIDAndVisibilityByNickname(req.TargetNickname)
	if err != nil {
		fmt.Println("Failed to get target user:", err)
		http.Error(w, "Target user not found", http.StatusNotFound)
		return
	}
	fmt.Println("Target user found - ID:", targetID, "Visibility:", visibility)

	if visibility == "public" {
		query := `INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, 'accepted')`
		_, err := Db.Exec(query, followerID, targetID)
		if err != nil {
			fmt.Println("Error creating accepted follow request:", err)
			http.Error(w, "Error following public user", http.StatusInternalServerError)
			return
		}

		// Get the follower's nickname to send notification to them
		followerNickname, err := database.GetNicknameByUserID(followerID)
		if err == nil {
			notifyFollowStatusUpdate(followerNickname, "accepted")
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"message": "Follow request accepted"}`))
		return
	}

	err = CreateFollowRequest(followerID, targetID)
	if err != nil {
		fmt.Println("Error creating follow request:", err)
		http.Error(w, "Could not follow user", http.StatusInternalServerError)
		return
	}

	// Get the follower's nickname for the notification
	followerNickname, err := database.GetNicknameByUserID(followerID)
	if err == nil {
		// Create notification for the target user
		handlers.CreateFollowRequestNotification(followerID, targetID, followerNickname)
	}

	// Notify user2 (target) of a new pending follow request
	notifyFollowStatusUpdate(req.TargetNickname, "pending")

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Follow request sent"}`))
}

func UnfollowHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		TargetNickname string `json:"target_nickname"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	targetID, err := database.GetUserIDByNickname(req.TargetNickname)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	err = DeleteFollow(userID, targetID)
	if err != nil {
		fmt.Println("Error deleting follow:", err)
		http.Error(w, "Could not unfollow user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Unfollowed successfully"}`))
}

func AcceptFollowHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		FollowerNickname string `json:"follower_nickname"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	followerID, err := database.GetUserIDByNickname(req.FollowerNickname)
	if err != nil {
		http.Error(w, "Follower not found", http.StatusNotFound)
		return
	}

	err = AcceptFollowRequest(followerID, userID)
	if err != nil {
		fmt.Println("Error accepting follow request:", err)
		http.Error(w, "Could not accept follow request", http.StatusInternalServerError)
		return
	}

	// Get the current user's nickname for the notification
	currentUserNickname, err := database.GetNicknameByUserID(userID)
	if err == nil {
		// Create notification for the follower that their request was accepted
		handlers.CreateFollowAcceptedNotification(userID, followerID, currentUserNickname)
	}

	notifyFollowStatusUpdate(req.FollowerNickname, "accepted")

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Follow request accepted"}`))
}

func DeclineFollowHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		FollowerNickname string `json:"follower_nickname"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	followerID, err := database.GetUserIDByNickname(req.FollowerNickname)
	if err != nil {
		http.Error(w, "Follower not found", http.StatusNotFound)
		return
	}

	err = DeleteFollowRequest(followerID, userID)
	if err != nil {
		fmt.Println("Error declining follow request:", err)
		http.Error(w, "Could not decline follow request", http.StatusInternalServerError)
		return
	}

	// Notify the follower that their request was declined
	notifyFollowStatusUpdate(req.FollowerNickname, "declined")

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Follow request declined"}`))
}
