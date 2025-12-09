package sessions

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

type Session struct {
	ID        string
	UserID    int
	ExpiresAt time.Time
}

type SessionStore struct {
	DB *sql.DB
}

var SessionStoreInstance *SessionStore

func CreateSessionStore(db *sql.DB) *SessionStore {
	return &SessionStore{DB: db}
}

// GetUserIDFromSession extracts the user ID from the session cookie
func (ss *SessionStore) GetUserIDFromSession(r *http.Request) (int, error) {
	cookie, err := r.Cookie("session_id")
	if err != nil {
		return -1, err
	}

	session, err := ss.GetSession(cookie.Value)
	if err != nil {
		return -1, err
	}

	// Check if session is expired
	if time.Now().After(session.ExpiresAt) {
		ss.DeleteSession(session.ID)
		return -1, fmt.Errorf("session expired")
	}

	return session.UserID, nil
}

func (ss *SessionStore) CreateSession(userID int) (*Session, error) {
	id := uuid.New().String()
	expiresAt := time.Now().Add(24 * time.Hour)

	err := ss.InsertSession(id, userID, expiresAt)
	if err != nil {

		err = ss.DeleteSessionsByUserID(userID)
		if err != nil {
			return nil, err
		}

		err = ss.InsertSession(id, userID, expiresAt)
		if err != nil {
			fmt.Printf("err: %v\n", err)
			return nil, err
		}

		return nil, err
	}

	return &Session{
		ID:        id,
		UserID:    userID,
		ExpiresAt: expiresAt,
	}, nil
}

func (ss *SessionStore) InsertSession(id string, userID int, expiresAt time.Time) error {
	_, err := ss.DB.Exec(
		"INSERT INTO sessions (session, user_id, expires_at) VALUES (?, ?, ?)", // Use 'session' column
		id, userID, expiresAt,
	)
	return err
}

func (ss *SessionStore) GetSession(sessionID string) (*Session, error) {
	var s Session
	err := ss.DB.QueryRow(
		"SELECT session, user_id, expires_at FROM sessions WHERE session = ?", // Select 'session' and filter by it
		sessionID,
	).Scan(&s.ID, &s.UserID, &s.ExpiresAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (ss *SessionStore) DeleteSession(sessionID string) error {
	_, err := ss.DB.Exec("DELETE FROM sessions WHERE session = ?", sessionID) // Delete by 'session' column
	return err
}

func (ss *SessionStore) DeleteSessionsByUserID(userID int) error {
	_, err := ss.DB.Exec("DELETE FROM sessions WHERE user_id = ?", userID)
	return err
}

func GetUserIDFromSession(r *http.Request) (int, error) {
	cookie, err := r.Cookie("session_id")
	if err != nil {
		return -1, err
	}

	session, err := SessionStoreInstance.GetSession(cookie.Value)
	if err != nil {
		return -1, fmt.Errorf("invalid session")
	}

	// Check if session is expired
	if time.Now().After(session.ExpiresAt) {
		SessionStoreInstance.DeleteSession(session.ID)
		return -1, fmt.Errorf("session expired")
	}

	return session.UserID, nil
}
