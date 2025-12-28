package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"socialhub/database"
	"socialhub/sessions"
	// "socialhub/database"
)

func InsertPostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from session
	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		fmt.Printf("Session error: %v\n", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	fmt.Printf("User ID from session: %d\n", userID)

	var newPost database.Posts
	if err := json.NewDecoder(r.Body).Decode(&newPost); err != nil {
		http.Error(w, "Invalid JSON data", http.StatusBadRequest)
		return
	}

	// Set the user ID from session
	newPost.UserID = userID

	if newPost.Title == "" || newPost.Content == "" || len(newPost.Category) == 0 {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Validate privacy level
	if newPost.PrivacyLevel != "" && newPost.PrivacyLevel != "public" && newPost.PrivacyLevel != "almost_private" && newPost.PrivacyLevel != "private" {
		http.Error(w, "Invalid privacy level. Must be 'public', 'almost_private', or 'private'", http.StatusBadRequest)
		return
	}

	postID, err := database.InsertPost(newPost)
	if err != nil {
		http.Error(w, "Failed to insert post: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// If this is a private post and selected users are provided, add permissions
	if newPost.PrivacyLevel == "private" && len(newPost.SelectedUsers) > 0 {
		for _, userID := range newPost.SelectedUsers {
			err = database.AddPostPermission(int(postID), userID)
			if err != nil {
				// Log error but don't fail the post creation
				fmt.Printf("Warning: Failed to add permission for user %d to post %d: %v\n", userID, postID, err)
			}
		}
	}

	response := map[string]interface{}{
		"success": true,
		"post_id": postID,
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Failed to encode response: "+err.Error(), http.StatusInternalServerError)
		return
	}
}

func GetPostsHandler(w http.ResponseWriter, r *http.Request) {

	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from session for privacy filtering
	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		// If no session, fetch only public posts
		posts, err := database.FetchPosts()
		if err != nil {
			http.Error(w, "Error fetching posts", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(posts)
		return
	}

	// Fetch posts with privacy filtering
	posts, err := database.FetchPostsWithPrivacy(userID)
	if err != nil {
		http.Error(w, "Error fetching posts", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}
