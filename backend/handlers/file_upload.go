package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"social-network/database"
	"social-network/sessions"
)

const (
	uploadDir   = "uploads"
	maxFileSize = 5 * 1024 * 1024 // 5MB
)

func init() {
	// Create uploads directory if it doesn't exist
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		fmt.Printf("Error creating uploads directory: %v\n", err)
	}
}

// UploadProfilePictureForRegistration handles avatar upload during registration (no auth required)
func UploadProfilePictureForRegistration(w http.ResponseWriter, r *http.Request) {
	// Check if the request method is POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse the multipart form
	if err := r.ParseMultipartForm(maxFileSize); err != nil {
		http.Error(w, "File too large", http.StatusBadRequest)
		return
	}

	// Get the file from the form
	file, header, err := r.FormFile("avatar")
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
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), fileType)
	filepath := filepath.Join(uploadDir, filename)

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

	// Return the file path (no database update needed during registration)
	avatarPath := "/uploads/" + filename
	fmt.Println("[UploadProfilePictureForRegistration] File uploaded successfully:", avatarPath)

	// Return the file path
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"avatar_url": "%s"}`, avatarPath)
}

func UploadProfilePicture(w http.ResponseWriter, r *http.Request) {
	// Check if the request method is POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse the multipart form
	if err := r.ParseMultipartForm(maxFileSize); err != nil {
		http.Error(w, "File too large", http.StatusBadRequest)
		return
	}

	// Get the file from the form
	file, header, err := r.FormFile("avatar")
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
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), fileType)
	filepath := filepath.Join(uploadDir, filename)

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

	// Get user ID from session
	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		fmt.Println("[UploadProfilePicture] Failed to get user ID from session:", err)
		return
	}
	fmt.Println("[UploadProfilePicture] Got userID:", userID)

	// Update avatar_url in the database
	avatarPath := "/uploads/" + filename
	fmt.Println("[UploadProfilePicture] Updating avatar_url to:", avatarPath)
	_, err = database.Db.Exec("UPDATE users SET avatar_url = ? WHERE uid = ?", avatarPath, userID)
	if err != nil {
		http.Error(w, "Failed to update avatar in database", http.StatusInternalServerError)
		fmt.Println("[UploadProfilePicture] Failed to update avatar_url in DB:", err)
		return
	}
	fmt.Println("[UploadProfilePicture] avatar_url updated successfully for userID:", userID)

	// Return the file path
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"avatar_url": "%s"}`, avatarPath)
}

func ServeImage(w http.ResponseWriter, r *http.Request) {
	// Get the filename from the URL
	filename := strings.TrimPrefix(r.URL.Path, "/uploads/")
	if filename == "" {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	// Serve the file
	http.ServeFile(w, r, filepath.Join(uploadDir, filename))
}
