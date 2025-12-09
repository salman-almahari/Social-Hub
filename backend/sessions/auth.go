package sessions

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	SessionStore *SessionStore
	DB           *sql.DB
}

func (h *AuthHandler) AuthStatus(w http.ResponseWriter, r *http.Request) {
	// Get session from cookie
	cookie, err := r.Cookie("session_id")
	if err != nil {
		log.Println("AuthStatus: No session cookie found")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get session from store
	session, err := h.SessionStore.GetSession(cookie.Value)
	if err != nil || session.UserID == 0 {
		log.Println("AuthStatus: Invalid session")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get user from database
	var nickname string
	err = h.DB.QueryRow("SELECT nickname FROM users WHERE uid = ?", session.UserID).Scan(&nickname)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Println("AuthStatus: User not found")
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		log.Printf("AuthStatus: Database error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Return user nickname
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Nickname string `json:"nickname"`
	}{
		Nickname: nickname,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Println("JSON decoding error:", err)
		http.Error(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	var user struct {
		ID       int
		Password string
		Nickname string
	}

	err = h.DB.QueryRow("SELECT uid, password, nickname FROM users WHERE email = ?", req.Email).Scan(&user.ID, &user.Password, &user.Nickname)
	if err != nil {
		fmt.Printf("err: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "User not found"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid password"})
		return
	}

	session, err := h.SessionStore.CreateSession(user.ID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    session.ID,
		Path:     "/",
		Expires:  session.ExpiresAt,
		HttpOnly: true,
		Secure:   false, // Set to true in production with HTTPS
		SameSite: http.SameSiteLaxMode,
	})

	fmt.Println("Login attempt:", req.Email)
	fmt.Println("User ID:", user.ID, "Nickname:", user.Nickname)

	// w.WriteHeader(http.StatusOK)
	// w.Write([]byte("Login successful"))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message":    "Login successful",
		"session_id": session.ID,
		"nickname":   user.Nickname,
	})

}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie("session_id")
	if err != nil {
		http.Error(w, "Not logged in", http.StatusBadRequest)
		return
	}

	if err := h.SessionStore.DeleteSession(cookie.Value); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:   "session_id",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Logged out successfully"))
}

func (h *AuthHandler) RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session_id")
		if err != nil {
			fmt.Println("Unauthorized - No session cookie", err)
			http.Error(w, "Unauthorized - No session cookie", http.StatusUnauthorized)
			return
		}
		// Session cookie found

		session, err := h.SessionStore.GetSession(cookie.Value)
		if err != nil || session.UserID == 0 {
			fmt.Println("Unauthorized - Invalid session")
			http.Error(w, "Unauthorized - Invalid session", http.StatusUnauthorized)
			return
		}

		// Add user ID to context
		ctx := context.WithValue(r.Context(), "userID", session.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}
