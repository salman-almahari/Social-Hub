package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"socialhub/database"
	"socialhub/notify"
)

func RegHandler(w http.ResponseWriter, r *http.Request) {
	var req Reg
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Println("JSON decoding error:", err)
		http.Error(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	ageStr := strconv.Itoa(req.Age)

	// Handle optional nickname - generate a default if not provided
	nickname := req.Nickname
	if nickname == "" {
		// Generate a default nickname using first name and a random number
		// Try up to 10 times to find a unique nickname
		for i := 0; i < 10; i++ {
			generatedNickname := generateDefaultNickname(req.First_Name)
			// Check if this nickname already exists
			exists, err := database.NicknameExists(generatedNickname)
			if err != nil {
				log.Printf("Error checking nickname existence: %v", err)
				break
			}
			if !exists {
				nickname = generatedNickname
				break
			}
		}
		// If we still don't have a nickname after 10 attempts, use a timestamp-based one
		if nickname == "" {
			nickname = generateTimestampNickname(req.First_Name)
		}
	}

	// Use appropriate registration function based on whether avatar is provided
	if req.AvatarUrl != "" {
		err = database.RegisterUserWithAvatar(nickname, req.First_Name, req.Last_Name, req.Gender, ageStr, req.Email, req.Password, req.AvatarUrl, req.Is_Public, req.About_Me)
	} else {
		err = database.RegisterUser(nickname, req.First_Name, req.Last_Name, req.Gender, ageStr, req.Email, req.Password, req.Is_Public, req.About_Me)
	}
	if err != nil {
		log.Printf("Registration error: %v", err)
		if err == sql.ErrNoRows {
			http.Error(w, "User not found", http.StatusNotFound)
		} else {
			// Check for specific SQLite constraint violations
			if err.Error() == "UNIQUE constraint failed: users.nickname" {
				http.Error(w, "Nickname already exists. Please choose a different one.", http.StatusConflict)
			} else if err.Error() == "UNIQUE constraint failed: users.email" {
				http.Error(w, "Email already exists. Please use a different email address.", http.StatusConflict)
			} else {
				http.Error(w, "Registration failed. Please try again.", http.StatusInternalServerError)
			}
		}
		return
	}

	// Broadcast user list update to all connected clients
	notify.BroadcastUserListUpdateWrapper()

	// Prepare response
	response := map[string]interface{}{
		"message": "Register successful",
	}
	
	// If a nickname was generated automatically, include it in the response
	if req.Nickname == "" {
		response["generated_nickname"] = nickname
		response["message"] = "Register successful. A nickname was generated for you."
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	
	responseJSON, err := json.Marshal(response)
	if err != nil {
		http.Error(w, "Error creating response", http.StatusInternalServerError)
		return
	}
	w.Write(responseJSON)
}

// generateDefaultNickname creates a default nickname if none is provided
func generateDefaultNickname(firstName string) string {
	// Initialize random seed
	rand.Seed(time.Now().UnixNano())
	
	// Clean the first name (remove spaces, convert to lowercase)
	cleanName := strings.ToLower(strings.ReplaceAll(firstName, " ", ""))
	
	// Generate a random 3-digit number
	randomNum := rand.Intn(900) + 100 // Generates numbers from 100-999
	
	// Combine first name with random number
	nickname := cleanName + strconv.Itoa(randomNum)
	
	return nickname
}

// generateTimestampNickname creates a nickname using timestamp as fallback
func generateTimestampNickname(firstName string) string {
	// Clean the first name (remove spaces, convert to lowercase)
	cleanName := strings.ToLower(strings.ReplaceAll(firstName, " ", ""))
	
	// Use current timestamp as suffix
	timestamp := time.Now().Unix()
	
	// Combine first name with timestamp
	nickname := cleanName + strconv.FormatInt(timestamp, 10)
	
	return nickname
}
