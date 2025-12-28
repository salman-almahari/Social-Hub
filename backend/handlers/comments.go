package handlers

import (
	"encoding/json"
	"net/http"
	"social-network/database"
	"strconv"
	"time"
)

type Comment struct {
	ID             int    `json:"id"`
	PostID         int    `json:"post_id"`
	UserID         int    `json:"user_id"`
	Nickname       string `json:"nickname"`
	ProfilePicture string `json:"profilePicture"`
	Content        string `json:"content"`
	Time           string `json:"time"`
	ImageURL       string `json:"image_url,omitempty"`
}

func InsertCommentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context (set by RequireAuth middleware)
	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var newComment Comment
	if err := json.NewDecoder(r.Body).Decode(&newComment); err != nil {
		http.Error(w, "Invalid JSON data", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if newComment.PostID == 0 || newComment.Content == "" {
		http.Error(w, "Missing required fields (post_id or content)", http.StatusBadRequest)
		return
	}

	// Use the authenticated user's ID from context, not from request body
	newComment.UserID = userID

	// Generate timestamp on server side
	newComment.Time = time.Now().Format("2006-01-02 15:04:05")

	commentID, err := InsertComment(newComment)
	if err != nil {
		http.Error(w, "Failed to insert comment: "+err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"success":    true,
		"comment_id": commentID,
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Failed to encode response: "+err.Error(), http.StatusInternalServerError)
		return
	}
}

func GetCommentsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Get post ID from query parameters
	postID := r.URL.Query().Get("post_id")
	if postID == "" {
		http.Error(w, "Missing post_id parameter", http.StatusBadRequest)
		return
	}

	pid, err := strconv.Atoi(postID)
	if err != nil {
		http.Error(w, "Invalid post_id format", http.StatusBadRequest)
		return
	}

	comments, err := FetchComments(pid)
	if err != nil {
		http.Error(w, "Error fetching comments: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(comments); err != nil {
		http.Error(w, "Failed to encode response: "+err.Error(), http.StatusInternalServerError)
		return
	}
}

func InsertComment(comment Comment) (int, error) {
	var id int
	// Fixed: Use correct database column names (comment_id, comment instead of id, content)
	// Also add time column since it exists in the database
	err := database.Db.QueryRow(
		`INSERT INTO comments (post_id, user_id, comment, time, image_url) 
		VALUES ($1, $2, $3, $4, $5) RETURNING comment_id`,
		comment.PostID, comment.UserID, comment.Content, comment.Time, comment.ImageURL,
	).Scan(&id)

	if err != nil {
		return 0, err
	}

	// Get post owner and commenter nickname for notification
	var postOwnerID int
	err = database.Db.QueryRow("SELECT user_id FROM posts WHERE post_id = ?", comment.PostID).Scan(&postOwnerID)
	if err == nil && postOwnerID != comment.UserID {
		commenterNickname, err := database.GetNicknameByUserID(comment.UserID)
		if err == nil {
			CreatePostInteractionNotification(postOwnerID, comment.PostID, "comment", commenterNickname)
		}
	}

	return id, nil
}

func FetchComments(postID int) ([]Comment, error) {
	// Join users table to get nickname and avatar_url
	rows, err := database.Db.Query(
		`SELECT c.comment_id, c.post_id, c.user_id, u.nickname, COALESCE(u.avatar_url, ''), c.comment, COALESCE(c.time, ''), c.image_url
		FROM comments c
		JOIN users u ON c.user_id = u.uid
		WHERE c.post_id = $1 ORDER BY c.comment_id DESC`,
		postID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comments []Comment
	for rows.Next() {
		var c Comment
		var imageURL *string
		if err := rows.Scan(&c.ID, &c.PostID, &c.UserID, &c.Nickname, &c.ProfilePicture, &c.Content, &c.Time, &imageURL); err != nil {
			return nil, err
		}
		if imageURL != nil {
			c.ImageURL = *imageURL
		}
		comments = append(comments, c)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return comments, nil
}
