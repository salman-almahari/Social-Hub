package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"socialhub/database"
	"socialhub/models"
	"socialhub/sessions"
)

func UserProfileHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("📥 [Handler] /profile hit")

	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		fmt.Println("❌ Failed to get user ID from session:", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	fmt.Println("✅ Got user ID from session:", userID)

	profile, err := database.GetUserProfileByID(database.Db, userID)
	if err != nil {
		fmt.Println("❌ Failed to get profile from DB:", err)
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	fmt.Printf("✅ Loaded profile from DB: %+v\n", profile)

	w.Header().Set("Content-Type", "application/json")
	err = json.NewEncoder(w).Encode(profile)
	if err != nil {
		fmt.Println("❌ Failed to encode profile to JSON:", err)
	} else {
		fmt.Println("✅ Profile JSON sent successfully")
	}
}

func UpdateUserProfileHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("📥 [Handler] /profile/update hit")

	if r.Method != http.MethodPost {
		fmt.Println("❌ Invalid method:", r.Method)
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get session cookie
	_, err := r.Cookie("session_id")
	if err != nil {
		fmt.Println("❌ No session cookie found:", err)
		http.Error(w, "No session found", http.StatusUnauthorized)
		return
	}
	// Session cookie found

	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		fmt.Println("❌ Failed to get user ID from session:", err)
		http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
		return
	}
	fmt.Println("✅ Got user ID from session:", userID)

	var req models.UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Println("❌ Failed to decode request body:", err)
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}
	fmt.Printf("✅ Decoded request body: %+v\n", req)

	err = database.UpdateUserProfile(userID, req)
	if err != nil {
		fmt.Println("❌ Failed to update profile in database:", err)
		http.Error(w, "Failed to update profile: "+err.Error(), http.StatusInternalServerError)
		return
	}

	fmt.Println("✅ Profile updated successfully")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Profile updated successfully"}`))
}
