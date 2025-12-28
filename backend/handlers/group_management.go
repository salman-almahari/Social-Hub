package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"socialhub/database"
	"strconv"
	"time"
)

type Request struct {
	// Common fields
	ID        *int    `json:"id,omitempty"`
	CreatedAt *string `json:"createdAt,omitempty"`
	Status    *string `json:"status,omitempty"`
	UserID    *int    `json:"userId,omitempty"`
	Username  *string `json:"username,omitempty"`

	// Follow request specific fields
	FollowerID   *int    `json:"follower_id,omitempty"`
	FollowerName *string `json:"follower_name,omitempty"`

	// Group request specific fields
	Title             *string `json:"title,omitempty"`
	Description       *string `json:"description,omitempty"`
	CreatedByUsername *string `json:"createdByUsername,omitempty"`
	GroupID           *int    `json:"groupId,omitempty"`
	GroupName         *string `json:"groupName,omitempty"`
	CreatedByUserID   *int    `json:"createdByUserId,omitempty"`
}

type GroupJoinRequestInfo struct {
	ID        int    `json:"id"`
	GroupID   int    `json:"groupId"`
	GroupName string `json:"groupName"`
	UserID    int    `json:"userId"`
	Username  string `json:"username"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
}

type GroupInviteRequestInfo struct {
	ID        int    `json:"id"`
	GroupID   int    `json:"groupId"`
	GroupName string `json:"groupName"`
	UserID    int    `json:"userId"`
	Username  string `json:"username"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
}

// GetGroupsHandler - Returns groups with membership status
func GetGroupsHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("Method: %s | Path: %s\n", r.Method, r.URL.Path)

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context (set by RequireAuth middleware)
	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	fmt.Println("GetGroupsHandler called for user:", userID)

	rows, err := database.Db.Query(`
		SELECT
			g.group_id AS id,
			g.group_name,
			g.description,
			u.nickname AS groupLeader,
			g.created_at,
			g.created_by,
			CASE WHEN gm.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_member
		FROM groups g
		JOIN users u ON g.created_by = u.uid
		LEFT JOIN group_members gm ON g.group_id = gm.group_id AND gm.user_id = ?
		ORDER BY g.created_at DESC
	`, userID)

	if err != nil {
		fmt.Printf("Database error: %v\n", err)
		http.Error(w, "Failed to fetch groups: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var groups []GroupResponseWithAdmin
	for rows.Next() {
		var group GroupResponseWithAdmin
		var createdAt string
		var isMemberInt int

		err := rows.Scan(
			&group.ID,
			&group.GroupName,
			&group.Description,
			&group.CreatedByUsername,
			&createdAt,
			&group.CreatedBy,
			&isMemberInt,
		)
		if err != nil {
			fmt.Printf("Scanning error: %v\n", err)
			http.Error(w, "Error scanning groups: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Set membership status
		group.IsMember = isMemberInt == 1
		// Check if current user is admin
		group.IsAdmin = (group.CreatedBy == userID)

		// Handle time parsing gracefully
		parsedTime, parseErr := time.Parse("2006-01-02 15:04:05", createdAt)
		if parseErr != nil {
			parsedTime, parseErr = time.Parse(time.RFC3339, createdAt)
			if parseErr != nil {
				fmt.Printf("Using fallback time due to parse error: %v\n", parseErr)
				parsedTime = time.Now()
			}
		}
		group.CreatedAt = parsedTime

		groups = append(groups, group)
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(groups); err != nil {
		fmt.Printf("JSON encoding error: %v\n", err)
	}
}

// CreateGroupHandler - Creates group and adds creator as member
func CreateGroupHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("CreateGroupHandler called")
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context
	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.GroupName == "" || req.Description == "" {
		http.Error(w, "Group name and description are required", http.StatusBadRequest)
		return
	}

	// Start transaction
	tx, err := database.Db.Begin()
	if err != nil {
		http.Error(w, "Transaction error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Insert group
	result, err := tx.Exec(
		`INSERT INTO groups (group_name, description, created_by, created_at) 
         VALUES (?, ?, ?, ?)`,
		req.GroupName,
		req.Description,
		userID,
		time.Now().Format(time.RFC3339),
	)

	if err != nil {
		http.Error(w, "Failed to create group: "+err.Error(), http.StatusInternalServerError)
		return
	}

	groupID, _ := result.LastInsertId()

	// Add creator as group member and admin
	_, err = tx.Exec(
		`INSERT INTO group_members (group_id, user_id, joined_at, is_admin) VALUES (?, ?, ?, 1)`,
		groupID, userID, time.Now().Format(time.RFC3339),
	)

	if err != nil {
		http.Error(w, "Failed to add creator to group: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, "Failed to commit transaction: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Fix existing groups: set creators as admins
	fixExistingGroupAdmins()

	var creatorUsername string
	err = database.Db.QueryRow("SELECT nickname FROM users WHERE uid = ?", userID).Scan(&creatorUsername)
	if err != nil {
		creatorUsername = "Unknown"
	}

	response := GroupResponseWithAdmin{
		GroupResponse: GroupResponse{
			ID:          int(groupID),
			GroupName:   req.GroupName,
			Description: req.Description,
			CreatedAt:   time.Now(),
		},
		CreatedBy:         userID,
		CreatedByUsername: creatorUsername,
		IsAdmin:           true,
		IsMember:          true,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// GroupInviteRequestsHandler - Handle group invite requests (POST to create, GET to list)
func GroupInviteRequestsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		handleCreateGroupInviteRequest(w, r)
	case http.MethodGet:
		handleListGroupInviteRequests(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleCreateGroupInviteRequest - Admin invites a user to join a group
func handleCreateGroupInviteRequest(w http.ResponseWriter, r *http.Request) {
	fmt.Println("handleCreateGroupInviteRequest called")

	// Get admin user from context
	adminUserID := getUserIDFromContext(r.Context())
	if adminUserID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		GroupID  int    `json:"groupId"`
		Username string `json:"username"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Username == "" {
		http.Error(w, "Username is required", http.StatusBadRequest)
		return
	}

	fmt.Printf("Admin %d inviting user %s to group %d\n", adminUserID, req.Username, req.GroupID)

	// Check if the current user is the creator/admin of the group
	var groupCreator int
	var groupName string
	err := database.Db.QueryRow("SELECT created_by, group_name FROM groups WHERE group_id = ?", req.GroupID).Scan(&groupCreator, &groupName)
	if err != nil {
		fmt.Printf("Group not found error: %v\n", err)
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	if groupCreator != adminUserID {
		http.Error(w, "You are not an admin of this group", http.StatusForbidden)
		return
	}

	// Check if user exists
	var targetUserID int
	err = database.Db.QueryRow("SELECT uid FROM users WHERE nickname = ?", req.Username).Scan(&targetUserID)
	if err != nil {
		fmt.Printf("User not found error: %v\n", err)
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Check if user is already a member
	var isMember bool
	err = database.Db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM group_members 
			WHERE group_id = ? AND user_id = ?
		)`, req.GroupID, targetUserID).Scan(&isMember)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if isMember {
		http.Error(w, "User is already a member of this group", http.StatusBadRequest)
		return
	}

	// Check if user already has a pending invite
	var hasInvite bool
	err = database.Db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM group_invite_requests 
			WHERE group_id = ? AND user_id = ? AND status = 'pending'
		)`, req.GroupID, targetUserID).Scan(&hasInvite)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if hasInvite {
		http.Error(w, "User already has a pending invite for this group", http.StatusBadRequest)
		return
	}

	// Create the invite request
	_, err = database.Db.Exec(`
		INSERT INTO group_invite_requests (group_id, user_id, username, status, created_at) 
		VALUES (?, ?, ?, 'pending', ?)
	`, req.GroupID, targetUserID, req.Username, time.Now().Format(time.RFC3339))

	if err != nil {
		fmt.Printf("Failed to create invite: %v\n", err)
		http.Error(w, "Failed to create invite: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get admin nickname for notification
	adminNickname, err := database.GetNicknameByUserID(adminUserID)
	if err == nil {
		// Create notification for the invited user
		CreateGroupInviteNotification(targetUserID, req.GroupID, groupName, adminNickname)

		// Send WebSocket notification to invited user
		BroadcastRequestUpdate(req.Username, "group_invite")
	}

	fmt.Printf("Successfully created invite for user %s to group %s\n", req.Username, groupName)

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message":   "User invited successfully",
		"groupName": groupName,
		"username":  req.Username,
	})
}

// handleListGroupInviteRequests - List group invite requests for current user
func handleListGroupInviteRequests(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get invites received by the current user
	rows, err := database.Db.Query(`
		SELECT 
			gir.id, 
			gir.group_id, 
			g.group_name, 
			gir.user_id, 
			gir.username, 
			gir.status, 
			gir.created_at
		FROM group_invite_requests gir
		JOIN groups g ON gir.group_id = g.group_id
		WHERE gir.user_id = ?
		ORDER BY gir.created_at DESC
	`, userID)

	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var invites []GroupInviteRequestInfo
	for rows.Next() {
		var invite GroupInviteRequestInfo
		err := rows.Scan(&invite.ID, &invite.GroupID, &invite.GroupName, &invite.UserID, &invite.Username, &invite.Status, &invite.CreatedAt)
		if err != nil {
			http.Error(w, "Scan error: "+err.Error(), http.StatusInternalServerError)
			return
		}
		invites = append(invites, invite)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invites)
}

// AcceptGroupInviteHandler - User accepts a group invite
func AcceptGroupInviteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		InviteID int `json:"inviteId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Verify the invite belongs to the current user and is pending
	var groupID int
	var inviteUserID int
	err := database.Db.QueryRow(`
		SELECT group_id, user_id 
		FROM group_invite_requests 
		WHERE id = ? AND status = 'pending'
	`, req.InviteID).Scan(&groupID, &inviteUserID)

	if err != nil {
		http.Error(w, "Invite not found or already processed", http.StatusNotFound)
		return
	}

	if inviteUserID != userID {
		http.Error(w, "This invite doesn't belong to you", http.StatusForbidden)
		return
	}

	// Start transaction
	tx, err := database.Db.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Update invite status
	_, err = tx.Exec(`
		UPDATE group_invite_requests 
		SET status = 'accepted' 
		WHERE id = ?
	`, req.InviteID)

	if err != nil {
		http.Error(w, "Failed to update invite", http.StatusInternalServerError)
		return
	}

	// Add user to group
	_, err = tx.Exec(`
		INSERT OR REPLACE INTO group_members (group_id, user_id, joined_at) 
		VALUES (?, ?, ?)
	`, groupID, userID, time.Now().Format(time.RFC3339))

	if err != nil {
		http.Error(w, "Failed to add user to group", http.StatusInternalServerError)
		return
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Invite accepted successfully"})
}

// RejectGroupInviteHandler - User rejects a group invite
func RejectGroupInviteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		InviteID int `json:"inviteId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Verify the invite belongs to the current user and is pending
	var inviteUserID int
	err := database.Db.QueryRow(`
		SELECT user_id 
		FROM group_invite_requests 
		WHERE id = ? AND status = 'pending'
	`, req.InviteID).Scan(&inviteUserID)

	if err != nil {
		http.Error(w, "Invite not found or already processed", http.StatusNotFound)
		return
	}

	if inviteUserID != userID {
		http.Error(w, "This invite doesn't belong to you", http.StatusForbidden)
		return
	}

	// Update invite status
	_, err = database.Db.Exec(`
		UPDATE group_invite_requests 
		SET status = 'rejected' 
		WHERE id = ?
	`, req.InviteID)

	if err != nil {
		http.Error(w, "Failed to update invite", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Invite rejected successfully"})
}

// GetGroupMembersHandler - Get all members of a group
func GetGroupMembersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUserID := getUserIDFromContext(r.Context())
	if currentUserID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	groupIDStr := r.URL.Query().Get("group_id")
	if groupIDStr == "" {
		groupIDStr = r.URL.Query().Get("groupId")
	}

	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group_id", http.StatusBadRequest)
		return
	}

	// Check current user is member of group
	var memberCount int
	err = database.Db.QueryRow("SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?",
		groupID, currentUserID).Scan(&memberCount)
	if err != nil || memberCount == 0 {
		http.Error(w, "Access denied - not a group member", http.StatusForbidden)
		return
	}

	// Get all group members
	rows, err := database.Db.Query(`
		SELECT u.nickname, gm.joined_at, g.created_by = gm.user_id as is_admin
		FROM group_members gm
		JOIN users u ON gm.user_id = u.uid
		JOIN groups g ON gm.group_id = g.group_id
		WHERE gm.group_id = ?
		ORDER BY is_admin DESC, gm.joined_at ASC
	`, groupID)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var members []GroupMember
	for rows.Next() {
		var member GroupMember
		var joinedAt string
		var isAdminInt int
		err := rows.Scan(&member.Username, &joinedAt, &isAdminInt)
		if err != nil {
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}

		member.IsAdmin = isAdminInt == 1
		parsedTime, _ := time.Parse(time.RFC3339, joinedAt)
		member.JoinedAt = parsedTime

		members = append(members, member)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}

// RequestJoinGroupHandler - Handle requests to join a group
func RequestJoinGroupHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user from context (set by RequireAuth middleware)
	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		GroupID     int    `json:"groupId"`
		GroupName   string `json:"groupName"`
		Title       string `json:"title"`
		Description string `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Check if user is already a member
	var isMember bool
	err := database.Db.QueryRow(`
        SELECT EXISTS(
            SELECT 1 FROM group_members 
            WHERE group_id = ? AND user_id = ?
        )`, req.GroupID, userID).Scan(&isMember)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if isMember {
		http.Error(w, "You are already a member of this group", http.StatusBadRequest)
		return
	}

	// Check if user already has a pending request
	var hasRequest bool
	err = database.Db.QueryRow(`
        SELECT EXISTS(
            SELECT 1 FROM group_join_requests 
            WHERE group_id = ? AND user_id = ? AND status = 'pending'
        )`, req.GroupID, userID).Scan(&hasRequest)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if hasRequest {
		http.Error(w, "You already have a pending request for this group", http.StatusBadRequest)
		return
	}

	// Get username
	var username string
	err = database.Db.QueryRow("SELECT nickname FROM users WHERE uid = ?", userID).Scan(&username)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Check if there's already a request for this user and group
	var existingStatus string
	err = database.Db.QueryRow(`
		SELECT status FROM group_join_requests 
		WHERE group_id = ? AND user_id = ?
	`, req.GroupID, userID).Scan(&existingStatus)

	if err == nil {
		// Request already exists
		if existingStatus == "pending" {
			http.Error(w, "You already have a pending join request for this group", http.StatusConflict)
			return
		} else if existingStatus == "approved" {
			http.Error(w, "You are already a member of this group", http.StatusConflict)
			return
		} else if existingStatus == "rejected" {
			// Update the rejected request to pending
			_, err = database.Db.Exec(`
				UPDATE group_join_requests 
				SET status = 'pending', created_at = ?
				WHERE group_id = ? AND user_id = ?
			`, time.Now().Format(time.RFC3339), req.GroupID, userID)

			if err != nil {
				http.Error(w, "Failed to resubmit request: "+err.Error(), http.StatusInternalServerError)
				return
			}
		}
	} else if err == sql.ErrNoRows {
		// No existing request, create a new one
		_, err = database.Db.Exec(`
			INSERT INTO group_join_requests (group_id, user_id, username, status, created_at) 
			VALUES (?, ?, ?, 'pending', ?)
		`, req.GroupID, userID, username, time.Now().Format(time.RFC3339))

		if err != nil {
			http.Error(w, "Failed to create request: "+err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get group name and admin user ID for notification
	var groupName string
	var adminUserID int
	err = database.Db.QueryRow("SELECT group_name, created_by FROM groups WHERE group_id = ?", req.GroupID).Scan(&groupName, &adminUserID)
	if err != nil {
		// Log error but don't fail the request
		fmt.Printf("Warning: Failed to get group info for notification: %v\n", err)
		groupName = "Unknown Group"
	} else {
		// Create notification for group admin
		CreateGroupJoinRequestNotification(adminUserID, req.GroupID, groupName, username)

		// Send WebSocket notification to admin
		adminNickname, err := database.GetNicknameByUserID(adminUserID)
		if err == nil {
			BroadcastRequestUpdate(adminNickname, "group_join_request")
		}
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Join request sent successfully"})
}

// ApproveGroupRequestHandler - Approve a group join request
func ApproveGroupRequestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get admin user from context
	adminUserID := getUserIDFromContext(r.Context())
	if adminUserID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		RequestID int `json:"requestId"`
		UserID    int `json:"userId"`
		GroupID   int `json:"groupId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Check if the current user is the creator/admin of the group
	var groupCreator int
	err := database.Db.QueryRow("SELECT created_by FROM groups WHERE group_id = ?", req.GroupID).Scan(&groupCreator)
	if err != nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	if groupCreator != adminUserID {
		http.Error(w, "You are not an admin of this group", http.StatusForbidden)
		return
	}

	// Start transaction
	tx, err := database.Db.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Update request status
	_, err = tx.Exec(`
        UPDATE group_join_requests 
        SET status = 'approved' 
        WHERE id = ? AND status = 'pending'
    `, req.RequestID)

	if err != nil {
		http.Error(w, "Failed to update request", http.StatusInternalServerError)
		return
	}

	// Add user to group
	_, err = tx.Exec(`
        INSERT OR REPLACE INTO group_members (group_id, user_id, joined_at) 
        VALUES (?, ?, ?)
    `, req.GroupID, req.UserID, time.Now().Format(time.RFC3339))

	if err != nil {
		http.Error(w, "Failed to add user to group", http.StatusInternalServerError)
		return
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	// Get group name for notification
	var groupName string
	err = database.Db.QueryRow("SELECT group_name FROM groups WHERE group_id = ?", req.GroupID).Scan(&groupName)
	if err != nil {
		// Log error but don't fail the request
		fmt.Printf("Warning: Failed to get group name for notification: %v\n", err)
		groupName = "Unknown Group"
	} else {
		// Create notification for the user whose request was approved
		CreateGroupJoinAcceptedNotification(req.UserID, req.GroupID, groupName)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Request approved successfully"})
}

// RejectGroupRequestHandler - Reject a group join request
func RejectGroupRequestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get admin user from context
	adminUserID := getUserIDFromContext(r.Context())
	if adminUserID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		RequestID int `json:"requestId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Get group ID from request to verify admin status
	var groupID int
	err := database.Db.QueryRow("SELECT group_id FROM group_join_requests WHERE id = ?", req.RequestID).Scan(&groupID)
	if err != nil {
		http.Error(w, "Request not found", http.StatusNotFound)
		return
	}

	// Check if the current user is the creator/admin of the group
	var groupCreator int
	err = database.Db.QueryRow("SELECT created_by FROM groups WHERE group_id = ?", groupID).Scan(&groupCreator)
	if err != nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	if groupCreator != adminUserID {
		http.Error(w, "You are not an admin of this group", http.StatusForbidden)
		return
	}

	// Update request status
	_, err = database.Db.Exec(`
        UPDATE group_join_requests 
        SET status = 'rejected' 
        WHERE id = ? AND status = 'pending'
    `, req.RequestID)

	if err != nil {
		http.Error(w, "Failed to update request", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Request rejected successfully"})
}

// ListGroupJoinRequestsHandler - Lists group join requests for the current user (as requester and as admin)
func ListGroupJoinRequestsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// 1. Requests made by the current user
	requesterRows, err := database.Db.Query(`
        SELECT gjr.id, gjr.group_id, g.group_name, gjr.user_id, gjr.username, gjr.status, gjr.created_at
        FROM group_join_requests gjr
        JOIN groups g ON gjr.group_id = g.group_id
        WHERE gjr.user_id = ?
        ORDER BY gjr.created_at DESC
    `, userID)
	if err != nil {
		http.Error(w, "Database error (requester): "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer requesterRows.Close()

	var asRequester []GroupJoinRequestInfo
	for requesterRows.Next() {
		var req GroupJoinRequestInfo
		if err := requesterRows.Scan(&req.ID, &req.GroupID, &req.GroupName, &req.UserID, &req.Username, &req.Status, &req.CreatedAt); err != nil {
			http.Error(w, "Scan error (requester): "+err.Error(), http.StatusInternalServerError)
			return
		}
		asRequester = append(asRequester, req)
	}

	// 2. Pending requests for groups where current user is admin
	adminRows, err := database.Db.Query(`
        SELECT gjr.id, gjr.group_id, g.group_name, gjr.user_id, gjr.username, gjr.status, gjr.created_at
        FROM group_join_requests gjr
        JOIN groups g ON gjr.group_id = g.group_id
        WHERE g.created_by = ? AND gjr.status = 'pending'
        ORDER BY gjr.created_at DESC
    `, userID)
	if err != nil {
		http.Error(w, "Database error (admin): "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer adminRows.Close()

	var asAdmin []GroupJoinRequestInfo
	for adminRows.Next() {
		var req GroupJoinRequestInfo
		if err := adminRows.Scan(&req.ID, &req.GroupID, &req.GroupName, &req.UserID, &req.Username, &req.Status, &req.CreatedAt); err != nil {
			http.Error(w, "Scan error (admin): "+err.Error(), http.StatusInternalServerError)
			return
		}
		asAdmin = append(asAdmin, req)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"asRequester": asRequester,
		"asAdmin":     asAdmin,
	})
}

// Helper function to get user ID from context
func getUserIDFromContext(ctx context.Context) int {
	userIDValue := ctx.Value("userID")
	if userIDValue == nil {
		return 0
	}
	userID, ok := userIDValue.(int)
	if !ok {
		return 0
	}
	return userID
}

// fixExistingGroupAdmins sets the is_admin flag for group creators who don't have it set
func fixExistingGroupAdmins() {
	rows, err := database.Db.Query(`
		SELECT g.group_id, g.created_by 
		FROM groups g
		JOIN group_members gm ON g.group_id = gm.group_id AND g.created_by = gm.user_id
		WHERE gm.is_admin = 0 OR gm.is_admin IS NULL
	`)
	if err != nil {
		fmt.Printf("Error querying groups to fix admins: %v\n", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var groupID, createdBy int
		if err := rows.Scan(&groupID, &createdBy); err != nil {
			continue
		}

		_, err := database.Db.Exec(`
			UPDATE group_members 
			SET is_admin = 1 
			WHERE group_id = ? AND user_id = ?
		`, groupID, createdBy)
		if err != nil {
			fmt.Printf("Error updating admin for group %d: %v\n", groupID, err)
		} else {
			fmt.Printf("Fixed admin for group %d (user %d)\n", groupID, createdBy)
		}
	}
}
