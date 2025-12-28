package handlers

import (
	"encoding/json"
	"net/http"
	"socialhub/database"
	"socialhub/sessions"
	"strconv"
)

// AddPostPermissionHandler adds a user to the allowed viewers for a private post
func AddPostPermissionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Get current user ID from session
	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		PostID int `json:"post_id"`
		UserID int `json:"user_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON data", http.StatusBadRequest)
		return
	}

	// Verify that the current user owns the post
	posts, err := database.FetchPostsByUserID(userID)
	if err != nil {
		http.Error(w, "Error verifying post ownership", http.StatusInternalServerError)
		return
	}

	postOwned := false
	for _, post := range posts {
		if post.ID == req.PostID {
			postOwned = true
			break
		}
	}

	if !postOwned {
		http.Error(w, "Unauthorized: You can only modify permissions for your own posts", http.StatusForbidden)
		return
	}

	// Add permission
	err = database.AddPostPermission(req.PostID, req.UserID)
	if err != nil {
		http.Error(w, "Error adding post permission", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "User added to post permissions",
	})
}

// RemovePostPermissionHandler removes a user from the allowed viewers for a private post
func RemovePostPermissionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Get current user ID from session
	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get post_id and user_id from query parameters
	postIDStr := r.URL.Query().Get("post_id")
	permissionUserIDStr := r.URL.Query().Get("user_id")

	if postIDStr == "" || permissionUserIDStr == "" {
		http.Error(w, "Missing post_id or user_id parameter", http.StatusBadRequest)
		return
	}

	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		http.Error(w, "Invalid post_id", http.StatusBadRequest)
		return
	}

	permissionUserID, err := strconv.Atoi(permissionUserIDStr)
	if err != nil {
		http.Error(w, "Invalid user_id", http.StatusBadRequest)
		return
	}

	// Verify that the current user owns the post
	posts, err := database.FetchPostsByUserID(userID)
	if err != nil {
		http.Error(w, "Error verifying post ownership", http.StatusInternalServerError)
		return
	}

	postOwned := false
	for _, post := range posts {
		if post.ID == postID {
			postOwned = true
			break
		}
	}

	if !postOwned {
		http.Error(w, "Unauthorized: You can only modify permissions for your own posts", http.StatusForbidden)
		return
	}

	// Remove permission
	err = database.RemovePostPermission(postID, permissionUserID)
	if err != nil {
		http.Error(w, "Error removing post permission", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "User removed from post permissions",
	})
}

// GetPostPermissionsHandler gets all users who can view a specific private post
func GetPostPermissionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Get current user ID from session
	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	postIDStr := r.URL.Query().Get("post_id")
	if postIDStr == "" {
		http.Error(w, "Missing post_id parameter", http.StatusBadRequest)
		return
	}

	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		http.Error(w, "Invalid post_id", http.StatusBadRequest)
		return
	}

	// Verify that the current user owns the post
	posts, err := database.FetchPostsByUserID(userID)
	if err != nil {
		http.Error(w, "Error verifying post ownership", http.StatusInternalServerError)
		return
	}

	postOwned := false
	for _, post := range posts {
		if post.ID == postID {
			postOwned = true
			break
		}
	}

	if !postOwned {
		http.Error(w, "Unauthorized: You can only view permissions for your own posts", http.StatusForbidden)
		return
	}

	// Get permissions
	userIDs, err := database.GetPostPermissions(postID)
	if err != nil {
		http.Error(w, "Error fetching post permissions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"user_ids": userIDs,
	})
}

// GetUsersForPrivatePostHandler gets all users that can be selected for private post permissions
func GetUsersForPrivatePostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
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

	// Get followers list (these are the users that can be selected for private posts)
	followers, err := database.GetFollowersByNickname(nickname)
	if err != nil {
		http.Error(w, "Failed to fetch followers", http.StatusInternalServerError)
		return
	}

	// Also get users that the current user follows (for mutual connections)
	following, err := database.GetFollowingByNickname(nickname)
	if err != nil {
		http.Error(w, "Failed to fetch following", http.StatusInternalServerError)
		return
	}

	// Combine and deduplicate users
	userMap := make(map[int]interface{})
	
	// Add followers
	for _, follower := range followers {
		userMap[follower.ID] = follower
	}
	
	// Add following (will overwrite duplicates)
	for _, follow := range following {
		userMap[follow.ID] = follow
	}

	// Convert back to slice
	var allUsers []interface{}
	for _, user := range userMap {
		allUsers = append(allUsers, user)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"users":   allUsers,
	})
}

// UpdatePostPermissionsHandler updates the permissions for a private post in bulk
func UpdatePostPermissionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Get current user ID from session
	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		PostID      int   `json:"post_id"`
		UserIDs     []int `json:"user_ids"`
		ReplaceMode bool  `json:"replace_mode"` // If true, replace all permissions; if false, add to existing
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON data", http.StatusBadRequest)
		return
	}

	// Verify that the current user owns the post
	posts, err := database.FetchPostsByUserID(userID)
	if err != nil {
		http.Error(w, "Error verifying post ownership", http.StatusInternalServerError)
		return
	}

	postOwned := false
	for _, post := range posts {
		if post.ID == req.PostID {
			postOwned = true
			break
		}
	}

	if !postOwned {
		http.Error(w, "Unauthorized: You can only modify permissions for your own posts", http.StatusForbidden)
		return
	}

	// If replace mode, first remove all existing permissions
	if req.ReplaceMode {
		// Get current permissions
		currentPermissions, err := database.GetPostPermissions(req.PostID)
		if err != nil {
			http.Error(w, "Error fetching current permissions", http.StatusInternalServerError)
			return
		}

		// Remove all current permissions
		for _, currentUserID := range currentPermissions {
			err = database.RemovePostPermission(req.PostID, currentUserID)
			if err != nil {
				http.Error(w, "Error removing existing permissions", http.StatusInternalServerError)
				return
			}
		}
	}

	// Add new permissions
	for _, permissionUserID := range req.UserIDs {
		err = database.AddPostPermission(req.PostID, permissionUserID)
		if err != nil {
			http.Error(w, "Error adding post permission", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Post permissions updated successfully",
		"updated_count": len(req.UserIDs),
	})
}

// CheckPostAccessHandler checks if the current user can access a specific post
func CheckPostAccessHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Get current user ID from session
	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	postIDStr := r.URL.Query().Get("post_id")
	if postIDStr == "" {
		http.Error(w, "Missing post_id parameter", http.StatusBadRequest)
		return
	}

	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		http.Error(w, "Invalid post_id", http.StatusBadRequest)
		return
	}

	// Get post details
	var postUserID int
	var privacyLevel string
	err = database.Db.QueryRow("SELECT user_id, COALESCE(privacy_level, 'public') FROM posts WHERE post_id = ?", postID).Scan(&postUserID, &privacyLevel)
	if err != nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	// If user owns the post, they can always access it
	if postUserID == userID {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"can_access": true,
			"reason": "post_owner",
		})
		return
	}

	// Check access based on privacy level
	canAccess := false
	reason := ""

	switch privacyLevel {
	case "public":
		canAccess = true
		reason = "public_post"
	case "almost_private":
		// Check if user follows the post owner and is accepted
		var followStatus string
		err = database.Db.QueryRow("SELECT status FROM follows WHERE follower_id = ? AND following_id = ?", userID, postUserID).Scan(&followStatus)
		if err == nil && followStatus == "accepted" {
			canAccess = true
			reason = "accepted_follower"
		} else {
			reason = "not_accepted_follower"
		}
	case "private":
		// Check if user has explicit permission
		var permissionExists int
		err = database.Db.QueryRow("SELECT 1 FROM post_permissions WHERE post_id = ? AND user_id = ?", postID, userID).Scan(&permissionExists)
		if err == nil {
			canAccess = true
			reason = "explicit_permission"
		} else {
			reason = "no_permission"
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"can_access": canAccess,
		"reason":     reason,
		"privacy_level": privacyLevel,
	})
}
