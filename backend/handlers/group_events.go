package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"socialhub/database"
	"socialhub/sessions"
)

type GroupEventWithGroup struct {
	ID            int     `json:"id"`
	GroupID       int     `json:"groupId"`
	GroupName     string  `json:"groupName"`
	Title         string  `json:"title"`
	Description   string  `json:"description"`
	EventTime     string  `json:"eventTime"`
	CreatedBy     string  `json:"createdBy"`
	GoingCount    int     `json:"goingCount"`
	NotGoingCount int     `json:"notGoingCount"`
	UserResponse  *string `json:"userResponse"`
}

func GetGroupEventsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	groupID := r.URL.Query().Get("groupId")
	if groupID == "" {
		http.Error(w, "Group ID is required", http.StatusBadRequest)
		return
	}

	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get events with response counts and user's response
	rows, err := database.Db.Query(`
		SELECT 
			e.id, e.group_id, e.title, e.description, e.event_time, u.nickname as created_by,
			(SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND response = 'going') as going_count,
			(SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND response = 'not_going') as not_going_count,
			(SELECT response FROM event_responses WHERE event_id = e.id AND user_id = ?) as user_response
		FROM group_events e
		JOIN users u ON e.created_by = u.uid
		WHERE e.group_id = ?
		ORDER BY e.event_time DESC
	`, userID, groupID)
	if err != nil {
		fmt.Printf("Database error in GetGroupEventsHandler: %v\n", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var events []GroupEvent
	for rows.Next() {
		var event GroupEvent
		var userResponse sql.NullString
		err := rows.Scan(
			&event.ID,
			&event.GroupID,
			&event.Title,
			&event.Description,
			&event.EventTime,
			&event.CreatedBy,
			&event.GoingCount,
			&event.NotGoingCount,
			&userResponse,
		)
		if err != nil {
			fmt.Printf("Error scanning events in GetGroupEventsHandler: %v\n", err)
			http.Error(w, "Error scanning events", http.StatusInternalServerError)
			return
		}
		if userResponse.Valid {
			event.UserResponse = &userResponse.String
		}
		events = append(events, event)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

func CreateGroupEventHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var event struct {
		GroupID     int    `json:"groupId"`
		Title       string `json:"title"`
		Description string `json:"description"`
		EventTime   string `json:"eventTime"`
	}

	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		fmt.Printf("Error decoding request body: %v\n", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	fmt.Printf("Received event creation request: %+v\n", event)

	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		fmt.Printf("Error getting user ID from session: %v\n", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	fmt.Printf("Creating event for user ID: %d\n", userID)

	// Insert the event
	result, err := database.Db.Exec(`
		INSERT INTO group_events (group_id, title, description, event_time, created_by)
		VALUES (?, ?, ?, ?, ?)
	`, event.GroupID, event.Title, event.Description, event.EventTime, userID)
	if err != nil {
		fmt.Printf("Database error creating event: %v\n", err)
		http.Error(w, fmt.Sprintf("Failed to create event: %v", err), http.StatusInternalServerError)
		return
	}

	// Get group name and creator nickname for notifications
	var groupName string
	err = database.Db.QueryRow("SELECT group_name FROM groups WHERE id = ?", event.GroupID).Scan(&groupName)
	if err == nil {
		creatorNickname, err := database.GetNicknameByUserID(userID)
		if err == nil {
			// Get all group members and create notifications for them
			rows, err := database.Db.Query(`
				SELECT user_id FROM group_members 
				WHERE group_id = ? AND user_id != ?
			`, event.GroupID, userID)
			if err == nil {
				defer rows.Close()
				for rows.Next() {
					var memberID int
					if rows.Scan(&memberID) == nil {
						CreateEventCreatedNotification(memberID, event.GroupID, groupName, event.Title, creatorNickname)
					}
				}
			}
		}
	}

	eventID, err := result.LastInsertId()
	if err != nil {
		fmt.Printf("Error getting last insert ID: %v\n", err)
		http.Error(w, "Failed to get event ID", http.StatusInternalServerError)
		return
	}

	fmt.Printf("Successfully created event with ID: %d\n", eventID)

	// Update event unread counts for all group members
	if err := UpdateEventUnreadCounts(int(eventID), event.GroupID, userID); err != nil {
		fmt.Printf("Failed to update event unread counts: %v\n", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":      eventID,
		"message": "Event created successfully",
	})
}

func RespondToEventHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		EventID  int    `json:"eventId"`
		Response string `json:"response"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Response != "going" && req.Response != "not_going" {
		http.Error(w, "Invalid response type", http.StatusBadRequest)
		return
	}

	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check if user has already responded
	var existingResponse string
	err = database.Db.QueryRow(`
		SELECT response FROM event_responses
		WHERE event_id = ? AND user_id = ?
	`, req.EventID, userID).Scan(&existingResponse)

	if err == nil {
		// Update existing response
		_, err = database.Db.Exec(`
			UPDATE event_responses
			SET response = ?
			WHERE event_id = ? AND user_id = ?
		`, req.Response, req.EventID, userID)
	} else if err == sql.ErrNoRows {
		// Insert new response
		_, err = database.Db.Exec(`
			INSERT INTO event_responses (event_id, user_id, response)
			VALUES (?, ?, ?)
		`, req.EventID, userID, req.Response)
	}

	if err != nil {
		http.Error(w, "Failed to record response", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Response recorded successfully",
	})
}

func GetAllGroupEventsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get events from all groups the user is a member of
	rows, err := database.Db.Query(`
		SELECT 
			e.id, e.group_id, g.group_name, e.title, e.description, e.event_time, 
			u.nickname as created_by,
			(SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND response = 'going') as going_count,
			(SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND response = 'not_going') as not_going_count,
			(SELECT response FROM event_responses WHERE event_id = e.id AND user_id = ?) as user_response
		FROM group_events e
		JOIN groups g ON e.group_id = g.group_id
		JOIN group_members gm ON g.group_id = gm.group_id
		JOIN users u ON e.created_by = u.uid
		WHERE gm.user_id = ?
		ORDER BY e.event_time DESC
	`, userID, userID)
	if err != nil {
		fmt.Printf("Database error in GetAllGroupEventsHandler: %v\n", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var events []GroupEventWithGroup
	for rows.Next() {
		var event GroupEventWithGroup
		var userResponse sql.NullString
		err := rows.Scan(
			&event.ID,
			&event.GroupID,
			&event.GroupName,
			&event.Title,
			&event.Description,
			&event.EventTime,
			&event.CreatedBy,
			&event.GoingCount,
			&event.NotGoingCount,
			&userResponse,
		)
		if err != nil {
			fmt.Printf("Error scanning events in GetAllGroupEventsHandler: %v\n", err)
			http.Error(w, "Error scanning events", http.StatusInternalServerError)
			return
		}
		if userResponse.Valid {
			event.UserResponse = &userResponse.String
		}
		events = append(events, event)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}
