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
	postUploadDir = "uploads/posts"
	maxPostFileSize = 10 * 1024 * 1024 // 10MB for posts
)

func init() {
	// Create post uploads directory if it doesn't exist
	if err := os.MkdirAll(postUploadDir, 0755); err != nil {
		fmt.Printf("Error creating post uploads directory: %v\n", err)
	}
}

func UploadPostImage(w http.ResponseWriter, r *http.Request) {
	// Check if the request method is POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse the multipart form
	if err := r.ParseMultipartForm(maxPostFileSize); err != nil {
		http.Error(w, "File too large", http.StatusBadRequest)
		return
	}

	// Get the file from the form
	file, header, err := r.FormFile("post_image")
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
	filename := fmt.Sprintf("post_%d%s", time.Now().UnixNano(), fileType)
	filepath := filepath.Join(postUploadDir, filename)

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
	fmt.Fprintf(w, `{"image_url": "/uploads/posts/%s"}`, filename)
}

func ServePostImage(w http.ResponseWriter, r *http.Request) {
	// Get the filename from the URL
	filename := strings.TrimPrefix(r.URL.Path, "/uploads/posts/")
	if filename == "" {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	// Serve the file
	http.ServeFile(w, r, filepath.Join(postUploadDir, filename))
} 