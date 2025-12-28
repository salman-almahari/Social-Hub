package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"socialhub/database"
	// "your_project/database" // adjust path as needed
)

func ChatHistoryHandler(w http.ResponseWriter, r *http.Request) {
	sender := r.URL.Query().Get("user1")
	recipient := r.URL.Query().Get("user2")

	fmt.Println("ChatHistoryHandler triggered")
	fmt.Println("Query params:", sender, recipient)

	if sender == "" || recipient == "" {
		http.Error(w, "Missing user1 or user2 query params", http.StatusBadRequest)
		fmt.Println("Missing query params")
		return
	}

	history, err := database.GetChatHistory(sender, recipient)
	if err != nil {
		http.Error(w, "Failed to fetch chat history", http.StatusInternalServerError)
		fmt.Println("Error getting chat history:", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(history); err != nil {
		http.Error(w, "Failed to encode chat history", http.StatusInternalServerError)
		fmt.Println("Error encoding response:", err)
		return
	}

	fmt.Println("Chat history successfully sent")
}

func CanAccessChatHandler(w http.ResponseWriter, r *http.Request) {
	user := r.URL.Query().Get("user")
	target := r.URL.Query().Get("target")

	fmt.Println("CanAccessChatHandler called with:", user, target)

	if user == "" || target == "" {
		http.Error(w, "Missing user or target", http.StatusBadRequest)
		return
	}

	// ✅ Check if target is public
	isPublic, err := database.IsPublic(target)
	if err != nil {
		fmt.Println("Error in IsPublic:", err)
		http.Error(w, "Failed to check public status", http.StatusInternalServerError)
		return
	}

	// ✅ Check if user follows the target (and is accepted)
	isFollowing, err := database.IsFollowing(user, target)
	if err != nil {
		fmt.Println("Error in IsFollowing:", err)
		http.Error(w, "Failed to check following", http.StatusInternalServerError)
		return
	}

	// ✅ Grant access if target is public OR user follows target (accepted)
	if isPublic || isFollowing {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"access": true})
		return
	}

	// ❌ Otherwise, deny access
	http.Error(w, "Access denied", http.StatusForbidden)
}
