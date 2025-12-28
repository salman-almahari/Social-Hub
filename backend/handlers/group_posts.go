package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"socialhub/database"
	"strconv"
	"strings"
	"time"
)

// Group Posts structs
type GroupPost struct {
	ID             int      `json:"id"`
	GroupID        int      `json:"groupId"`
	Title          string   `json:"title"`
	Content        string   `json:"content"`
	Media          []string `json:"media"`
	Categories     []string `json:"categories"`
	AuthorUsername string   `json:"authorUsername"`
	AuthorID       int      `json:"authorId"`
	CreatedAt      string   `json:"createdAt"`
	LikesCount     int      `json:"likesCount"`
	UserHasLiked   bool     `json:"userHasLiked"`
	ImageUrl       string   `json:"imageUrl,omitempty"` // Image URL field
}

type CreateGroupPostRequest struct {
	GroupID    int      `json:"groupId"`
	Title      string   `json:"title"`
	Content    string   `json:"content"`
	Media      []string `json:"media"`
	Categories []string `json:"categories"`
	ImageUrl   string   `json:"imageUrl,omitempty"` // Image URL field
}

type LikeGroupPostRequest struct {
	PostID int `json:"postId"`
}
type GroupPostComment struct {
	ID             int    `json:"id"`
	PostID         int    `json:"postId"`
	Content        string `json:"content"`
	AuthorUsername string `json:"authorUsername"`
	AuthorID       int    `json:"authorId"`
	CreatedAt      string `json:"createdAt"`
	ImageUrl       string `json:"imageUrl,omitempty"`
}

type CreateGroupPostCommentRequest struct {
	PostID   int    `json:"postId"`
	Content  string `json:"content"`
	ImageUrl string `json:"imageUrl,omitempty"`
}

// ================================
// GROUP POST COMMENTS HANDLERS
// ================================

// GetGroupPostCommentsHandler retrieves all comments for a specific post
func GetGroupPostCommentsHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("DEBUG: GetGroupPostCommentsHandler called")

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUserID := getUserIDFromContext(r.Context())
	if currentUserID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	postIDStr := r.URL.Query().Get("postId")
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	// Check if the post exists and get its group_id
	var groupID int
	err = database.Db.QueryRow("SELECT group_id FROM group_posts WHERE id = ?", postID).Scan(&groupID)
	if err != nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	// Check if user is a member of the group
	var memberCount int
	err = database.Db.QueryRow("SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?",
		groupID, currentUserID).Scan(&memberCount)
	if err != nil || memberCount == 0 {
		http.Error(w, "Access denied - not a group member", http.StatusForbidden)
		return
	}

	// Get all comments for the post
	rows, err := database.Db.Query(`
		SELECT 
			gpc.id,
			gpc.post_id,
			gpc.content,
			u.nickname as author_username,
			gpc.author_id,
			gpc.created_at,
			COALESCE(gpc.image_url, '') as image_url
		FROM group_post_comments gpc
		JOIN users u ON gpc.author_id = u.uid
		WHERE gpc.post_id = ?
		ORDER BY gpc.created_at DESC
	`, postID)

	if err != nil {
		log.Printf("ERROR: Database query error: %v", err)
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var comments []GroupPostComment
	for rows.Next() {
		var comment GroupPostComment

		err := rows.Scan(
			&comment.ID,
			&comment.PostID,
			&comment.Content,
			&comment.AuthorUsername,
			&comment.AuthorID,
			&comment.CreatedAt,
			&comment.ImageUrl,
		)
		if err != nil {
			log.Printf("ERROR: Row scan error: %v", err)
			http.Error(w, "Error scanning comments: "+err.Error(), http.StatusInternalServerError)
			return
		}

		comments = append(comments, comment)
	}

	log.Printf("DEBUG: Found %d comments for post %d", len(comments), postID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comments)
}

// AddGroupPostCommentHandler creates a new comment on a group post
func AddGroupPostCommentHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUserID := getUserIDFromContext(r.Context())
	if currentUserID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateGroupPostCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Content == "" {
		http.Error(w, "Content is required", http.StatusBadRequest)
		return
	}

	// Check if the post exists and get its group_id
	var groupID int
	err := database.Db.QueryRow("SELECT group_id FROM group_posts WHERE id = ?", req.PostID).Scan(&groupID)
	if err != nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	// Check if user is a member of the group
	var memberCount int
	err = database.Db.QueryRow("SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?",
		groupID, currentUserID).Scan(&memberCount)
	if err != nil || memberCount == 0 {
		http.Error(w, "Access denied - not a group member", http.StatusForbidden)
		return
	}

	// Insert the comment
	result, err := database.Db.Exec(`
		INSERT INTO group_post_comments (post_id, content, author_id, created_at, image_url)
		VALUES (?, ?, ?, ?, ?)
	`, req.PostID, req.Content, currentUserID, time.Now().Format(time.RFC3339), req.ImageUrl)

	if err != nil {
		http.Error(w, "Failed to create comment: "+err.Error(), http.StatusInternalServerError)
		return
	}

	commentID, _ := result.LastInsertId()

	// Get the author's username
	var authorUsername string
	err = database.Db.QueryRow("SELECT nickname FROM users WHERE uid = ?", currentUserID).Scan(&authorUsername)
	if err != nil {
		authorUsername = "Unknown"
	}

	// Get post author ID for notification
	var postAuthorID int
	err = database.Db.QueryRow("SELECT author_id FROM group_posts WHERE id = ?", req.PostID).Scan(&postAuthorID)
	if err != nil {
		// Log error but don't fail the comment creation
		fmt.Printf("Warning: Failed to get post author for notification: %v\n", err)
	} else if postAuthorID != currentUserID {
		// Create notification for post author (don't notify if commenting on own post)
		CreatePostInteractionNotification(postAuthorID, req.PostID, "comment", authorUsername)
	}

	// Return the created comment
	response := GroupPostComment{
		ID:             int(commentID),
		PostID:         req.PostID,
		Content:        req.Content,
		AuthorUsername: authorUsername,
		AuthorID:       currentUserID,
		CreatedAt:      time.Now().Format(time.RFC3339),
		ImageUrl:       req.ImageUrl,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// DeleteGroupPostCommentHandler deletes a group post comment
func DeleteGroupPostCommentHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUserID := getUserIDFromContext(r.Context())
	if currentUserID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract comment ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 2 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}

	commentIDStr := pathParts[len(pathParts)-1]
	commentID, err := strconv.Atoi(commentIDStr)
	if err != nil {
		http.Error(w, "Invalid comment ID", http.StatusBadRequest)
		return
	}

	// Get comment details including author and post info
	var authorID, postID, groupID int
	var imageUrl string
	err = database.Db.QueryRow(`
		SELECT gpc.author_id, gpc.post_id, gp.group_id, COALESCE(gpc.image_url, '')
		FROM group_post_comments gpc
		JOIN group_posts gp ON gpc.post_id = gp.id
		WHERE gpc.id = ?
	`, commentID).Scan(&authorID, &postID, &groupID, &imageUrl)
	if err != nil {
		http.Error(w, "Comment not found", http.StatusNotFound)
		return
	}

	// Check if user is the comment author or group admin
	var groupCreator int
	err = database.Db.QueryRow("SELECT created_by FROM groups WHERE group_id = ?", groupID).Scan(&groupCreator)
	if err != nil {
		fmt.Printf("Error fetching group creator: %v\n", err)
	}

	// Only allow deletion if user is the comment author or group admin
	if authorID != currentUserID && groupCreator != currentUserID {
		http.Error(w, "Access denied - only comment author or group admin can delete", http.StatusForbidden)
		return
	}

	// Delete the comment
	_, err = database.Db.Exec("DELETE FROM group_post_comments WHERE id = ?", commentID)
	if err != nil {
		http.Error(w, "Failed to delete comment", http.StatusInternalServerError)
		return
	}

	// Delete image file if it exists
	if imageUrl != "" {
		imagePath := strings.TrimPrefix(imageUrl, "/")
		if err := os.Remove(imagePath); err != nil {
			fmt.Printf("Warning: Failed to delete comment image file %s: %v\n", imagePath, err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Comment deleted successfully"})
}

// ================================
// IMAGE UPLOAD HANDLER
// ================================

// UploadGroupPostImageHandler handles image upload for group posts
func UploadGroupPostImageHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check authentication
	currentUserID := getUserIDFromContext(r.Context())
	if currentUserID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse multipart form
	err := r.ParseMultipartForm(10 << 20) // 10 MB max
	if err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	// Get file from form
	file, header, err := r.FormFile("group_post_image")
	if err != nil {
		http.Error(w, "No file provided", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate file type - accept any image format
	validTypes := map[string]bool{
		"image/jpeg":  true,
		"image/png":   true,
		"image/gif":   true,
		"image/webp":  true,
		"image/bmp":   true,
		"image/tiff":  true,
		"image/svg+xml": true,
		"image/x-icon": true,
		"image/jfif":  true,
		"image/pjpeg": true,
		"image/pjp":   true,
	}

	contentType := header.Header.Get("Content-Type")
	if !validTypes[contentType] {
		http.Error(w, "Invalid file type. Please upload a valid image file", http.StatusBadRequest)
		return
	}

	// Validate file size (10MB)
	if header.Size > 10*1024*1024 {
		http.Error(w, "File too large. Maximum size is 10MB", http.StatusBadRequest)
		return
	}

	// Create uploads directory if it doesn't exist
	uploadsDir := "uploads/group_posts"
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		http.Error(w, "Failed to create upload directory", http.StatusInternalServerError)
		return
	}

	// Generate unique filename
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		// Determine extension from content type
		switch contentType {
		case "image/jpeg":
			ext = ".jpg"
		case "image/png":
			ext = ".png"
		case "image/gif":
			ext = ".gif"
		case "image/webp":
			ext = ".webp"
		case "image/bmp":
			ext = ".bmp"
		case "image/tiff":
			ext = ".tiff"
		case "image/svg+xml":
			ext = ".svg"
		case "image/x-icon":
			ext = ".ico"
		case "image/jfif":
			ext = ".jfif"
		case "image/pjpeg":
			ext = ".pjpeg"
		case "image/pjp":
			ext = ".pjp"
		}
	}

	filename := fmt.Sprintf("group_post_%d_%d%s", currentUserID, time.Now().Unix(), ext)
	filePath := filepath.Join(uploadsDir, filename)

	// Create destination file
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "Failed to create file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copy uploaded file to destination
	_, err = io.Copy(dst, file)
	if err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// Return the image URL
	imageUrl := fmt.Sprintf("/uploads/group_posts/%s", filename)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"image_url": imageUrl,
		"message":   "Image uploaded successfully",
	})
}

// ServeGroupPostImages serves uploaded group post images
func ServeGroupPostImages(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	// Extract filename from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	filename := pathParts[len(pathParts)-1]

	// Validate filename to prevent directory traversal
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") {
		http.Error(w, "Invalid filename", http.StatusBadRequest)
		return
	}

	filePath := filepath.Join("uploads/group_posts", filename)

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		http.Error(w, "Image not found", http.StatusNotFound)
		return
	}

	// Set appropriate content type based on file extension
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg":
		w.Header().Set("Content-Type", "image/jpeg")
	case ".png":
		w.Header().Set("Content-Type", "image/png")
	case ".gif":
		w.Header().Set("Content-Type", "image/gif")
	case ".webp":
		w.Header().Set("Content-Type", "image/webp")
	default:
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	// Set cache headers
	w.Header().Set("Cache-Control", "public, max-age=31536000") // 1 year

	http.ServeFile(w, r, filePath)
}

// ================================
// GROUP POSTS HANDLERS
// ================================

// GetGroupPostsHandler retrieves all posts for a specific group with image support
func GetGroupPostsHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("DEBUG: GetGroupPostsHandler called")

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUserID := getUserIDFromContext(r.Context())
	log.Printf("DEBUG: Current user ID: %d", currentUserID)
	if currentUserID == 0 {
		log.Printf("ERROR: User not authenticated")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	groupIDStr := r.URL.Query().Get("groupId")
	log.Printf("DEBUG: Group ID string: %s", groupIDStr)
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		log.Printf("ERROR: Invalid group ID: %v", err)
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Check if user is a member of the group
	var memberCount int
	err = database.Db.QueryRow("SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?",
		groupID, currentUserID).Scan(&memberCount)
	if err != nil {
		log.Printf("ERROR: Database error checking membership: %v", err)
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if memberCount == 0 {
		log.Printf("ERROR: User %d is not a member of group %d", currentUserID, groupID)
		http.Error(w, "Access denied - not a group member", http.StatusForbidden)
		return
	}

	log.Printf("DEBUG: User %d is a member of group %d", currentUserID, groupID)

	// Get all posts for the group with like information and image URL
	rows, err := database.Db.Query(`
		SELECT 
			gp.id,
			gp.group_id,
			gp.title,
			gp.content,
			COALESCE(gp.media, '') as media,
			COALESCE(gp.categories, '') as categories,
			u.nickname as author_username,
			gp.author_id,
			gp.created_at,
			COALESCE(like_counts.likes_count, 0) as likes_count,
			CASE WHEN user_likes.post_id IS NOT NULL THEN 1 ELSE 0 END as user_has_liked,
			COALESCE(gp.image_url, '') as image_url
		FROM group_posts gp
		JOIN users u ON gp.author_id = u.uid
		LEFT JOIN (
			SELECT post_id, COUNT(*) as likes_count 
			FROM group_post_likes 
			GROUP BY post_id
		) like_counts ON gp.id = like_counts.post_id
		LEFT JOIN group_post_likes user_likes ON gp.id = user_likes.post_id AND user_likes.user_id = ?
		WHERE gp.group_id = ?
		ORDER BY gp.created_at DESC
	`, currentUserID, groupID)

	if err != nil {
		log.Printf("ERROR: Database query error: %v", err)
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var posts []GroupPost
	for rows.Next() {
		var post GroupPost
		var categoriesStr string
		var mediaStr string
		var userHasLikedInt int

		err := rows.Scan(
			&post.ID,
			&post.GroupID,
			&post.Title,
			&post.Content,
			&mediaStr,
			&categoriesStr,
			&post.AuthorUsername,
			&post.AuthorID,
			&post.CreatedAt,
			&post.LikesCount,
			&userHasLikedInt,
			&post.ImageUrl,
		)
		if err != nil {
			log.Printf("ERROR: Row scan error: %v", err)
			http.Error(w, "Error scanning posts: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Parse media
		if mediaStr != "" {
			post.Media = strings.Split(mediaStr, ",")
			// Trim whitespace from each media item
			for i := range post.Media {
				post.Media[i] = strings.TrimSpace(post.Media[i])
			}
		} else {
			post.Media = []string{}
		}

		// Parse categories
		if categoriesStr != "" {
			post.Categories = strings.Split(categoriesStr, ",")
			// Trim whitespace from each category
			for i := range post.Categories {
				post.Categories[i] = strings.TrimSpace(post.Categories[i])
			}
		} else {
			post.Categories = []string{}
		}

		post.UserHasLiked = userHasLikedInt == 1

		posts = append(posts, post)
	}

	log.Printf("DEBUG: Found %d posts for group %d", len(posts), groupID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

// CreateGroupPostHandler creates a new post in a group with image support
func CreateGroupPostHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUserID := getUserIDFromContext(r.Context())
	if currentUserID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateGroupPostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Title == "" || req.Content == "" {
		http.Error(w, "Title and content are required", http.StatusBadRequest)
		return
	}

	// Check if user is a member of the group
	var memberCount int
	err := database.Db.QueryRow("SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?",
		req.GroupID, currentUserID).Scan(&memberCount)
	if err != nil || memberCount == 0 {
		http.Error(w, "Access denied - not a group member", http.StatusForbidden)
		return
	}

	// Convert categories to comma-separated string
	categoriesStr := strings.Join(req.Categories, ",")

	// Insert the post with image URL
	result, err := database.Db.Exec(`
		INSERT INTO group_posts (group_id, title, content, media, categories, author_id, created_at, image_url)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, req.GroupID, req.Title, req.Content, strings.Join(req.Media, ","), categoriesStr, currentUserID, time.Now().Format(time.RFC3339), req.ImageUrl)

	if err != nil {
		http.Error(w, "Failed to create post: "+err.Error(), http.StatusInternalServerError)
		return
	}

	postID, _ := result.LastInsertId()

	// Get the author's username
	var authorUsername string
	err = database.Db.QueryRow("SELECT nickname FROM users WHERE uid = ?", currentUserID).Scan(&authorUsername)
	if err != nil {
		authorUsername = "Unknown"
	}

	// Get group name for notifications
	var groupName string
	err = database.Db.QueryRow("SELECT group_name FROM groups WHERE group_id = ?", req.GroupID).Scan(&groupName)
	if err != nil {
		// Log error but don't fail the post creation
		fmt.Printf("Warning: Failed to get group name for notifications: %v\n", err)
		groupName = "Unknown Group"
	}

	// Create notifications for all group members except the author
	rows, err := database.Db.Query("SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?", req.GroupID, currentUserID)
	if err != nil {
		// Log error but don't fail the post creation
		fmt.Printf("Warning: Failed to get group members for notifications: %v\n", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var memberID int
			if err := rows.Scan(&memberID); err != nil {
				continue
			}
			// Create notification for each group member
			CreateGroupPostNotification(memberID, req.GroupID, groupName, authorUsername)
		}
	}

	// Return the created post
	response := GroupPost{
		ID:             int(postID),
		GroupID:        req.GroupID,
		Title:          req.Title,
		Content:        req.Content,
		Media:          req.Media,
		Categories:     req.Categories,
		AuthorUsername: authorUsername,
		AuthorID:       currentUserID,
		CreatedAt:      time.Now().Format(time.RFC3339),
		LikesCount:     0,
		UserHasLiked:   false,
		ImageUrl:       req.ImageUrl,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// LikeGroupPostHandler handles liking/unliking a group post
func LikeGroupPostHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUserID := getUserIDFromContext(r.Context())
	if currentUserID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req LikeGroupPostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Check if the post exists and get its group_id
	var groupID int
	err := database.Db.QueryRow("SELECT group_id FROM group_posts WHERE id = ?", req.PostID).Scan(&groupID)
	if err != nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	// Check if user is a member of the group
	var memberCount int
	err = database.Db.QueryRow("SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?",
		groupID, currentUserID).Scan(&memberCount)
	if err != nil || memberCount == 0 {
		http.Error(w, "Access denied - not a group member", http.StatusForbidden)
		return
	}

	// Check if user has already liked this post
	var likeCount int
	err = database.Db.QueryRow("SELECT COUNT(*) FROM group_post_likes WHERE post_id = ? AND user_id = ?",
		req.PostID, currentUserID).Scan(&likeCount)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if likeCount > 0 {
		// Unlike the post
		_, err = database.Db.Exec("DELETE FROM group_post_likes WHERE post_id = ? AND user_id = ?",
			req.PostID, currentUserID)
		if err != nil {
			http.Error(w, "Failed to unlike post", http.StatusInternalServerError)
			return
		}
	} else {
		// Like the post
		_, err = database.Db.Exec("INSERT INTO group_post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)",
			req.PostID, currentUserID, time.Now().Format(time.RFC3339))
		if err != nil {
			http.Error(w, "Failed to like post", http.StatusInternalServerError)
			return
		}

		// Get post owner and liker nickname for notification
		var postOwnerID int
		err = database.Db.QueryRow("SELECT user_id FROM group_posts WHERE id = ?", req.PostID).Scan(&postOwnerID)
		if err == nil && postOwnerID != currentUserID {
			likerNickname, err := database.GetNicknameByUserID(currentUserID)
			if err == nil {
				CreatePostInteractionNotification(postOwnerID, req.PostID, "like", likerNickname)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Success"})
}

// DeleteGroupPostHandler deletes a group post with image cleanup
func DeleteGroupPostHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUserID := getUserIDFromContext(r.Context())
	if currentUserID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract post ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 2 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}

	postIDStr := pathParts[len(pathParts)-1]
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	// Get post details including image URL
	var authorID, groupID int
	var imageUrl string
	err = database.Db.QueryRow("SELECT author_id, group_id, COALESCE(image_url, '') FROM group_posts WHERE id = ?", postID).Scan(&authorID, &groupID, &imageUrl)
	if err != nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	// Check if user is the author or group admin
	var groupCreator int
	err = database.Db.QueryRow("SELECT created_by FROM groups WHERE group_id = ?", groupID).Scan(&groupCreator)
	if err != nil {
		fmt.Printf("Error fetching group creator: %v\n", err)
	}

	// Only allow deletion if user is the post author or group admin
	if authorID != currentUserID && groupCreator != currentUserID {
		http.Error(w, "Access denied - only post author or group admin can delete", http.StatusForbidden)
		return
	}

	// Start transaction to delete post and associated data
	tx, err := database.Db.Begin()
	if err != nil {
		http.Error(w, "Transaction error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Delete associated likes first
	_, err = tx.Exec("DELETE FROM group_post_likes WHERE post_id = ?", postID)
	if err != nil {
		http.Error(w, "Failed to delete post likes", http.StatusInternalServerError)
		return
	}

	// Delete the post
	_, err = tx.Exec("DELETE FROM group_posts WHERE id = ?", postID)
	if err != nil {
		http.Error(w, "Failed to delete post", http.StatusInternalServerError)
		return
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	// Delete image file if it exists
	if imageUrl != "" {
		// Remove leading slash and construct full path
		imagePath := strings.TrimPrefix(imageUrl, "/")
		if err := os.Remove(imagePath); err != nil {
			// Log error but don't fail the request
			fmt.Printf("Warning: Failed to delete image file %s: %v\n", imagePath, err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Post deleted successfully"})
}