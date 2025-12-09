package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	commentUploadDir = "uploads/comments"
	maxCommentFileSize = 5 * 1024 * 1024 // 5MB for comments
)

func init() {
	// Create comment uploads directory if it doesn't exist
	if err := os.MkdirAll(commentUploadDir, 0755); err != nil {
		fmt.Printf("Error creating comment uploads directory: %v\n", err)
	}
}

func UploadCommentImage(w http.ResponseWriter, r *http.Request) {
	// Check if the request method is POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse the multipart form
	if err := r.ParseMultipartForm(maxCommentFileSize); err != nil {
		http.Error(w, "File too large", http.StatusBadRequest)
		return
	}

	// Get the file from the form
	file, header, err := r.FormFile("comment_image")
	if err != nil {
		http.Error(w, "Error retrieving file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Check file type - accept any image format
	fileType := strings.ToLower(filepath.Ext(header.Filename))
	validImageTypes := []string{".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif", ".webp", ".svg", ".ico", ".jfif", ".pjpeg", ".pjp"}
	
	isValidImage := false
	for _, validType := range validImageTypes {
		if fileType == validType {
			isValidImage = true
			break
		}
	}
	
	if !isValidImage {
		http.Error(w, "Invalid file type. Please upload a valid image file", http.StatusBadRequest)
		return
	}

	// Generate unique filename
	filename := fmt.Sprintf("comment_%d%s", time.Now().UnixNano(), fileType)
	filepath := filepath.Join(commentUploadDir, filename)

	// Create the file
	dst, err := os.Create(filepath)
	if err != nil {
		http.Error(w, "Error creating file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copy the uploaded file to the destination file
	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Error saving file", http.StatusInternalServerError)
		return
	}

	// Return the file path
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"image_url": "/uploads/comments/%s"}`, filename)
}

func ServeCommentImage(w http.ResponseWriter, r *http.Request) {
	// Get the filename from the URL
	filename := strings.TrimPrefix(r.URL.Path, "/uploads/comments/")
	if filename == "" {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	// Serve the file
	http.ServeFile(w, r, filepath.Join(commentUploadDir, filename))
} 