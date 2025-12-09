package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"social-network/database"
	"social-network/sessions"
)

// AllRequestsResponse represents all types of requests for a user
type AllRequestsResponse struct {
	FollowRequests    []FollowRequestResponse    `json:"follow_requests"`
	GroupJoinRequests []GroupJoinRequestResponse `json:"group_join_requests"`
	GroupInvites      []GroupInviteResponse      `json:"group_invites"`
	TotalCount        int                        `json:"total_count"`
}

// GroupJoinRequestResponse represents a group join request
type GroupJoinRequestResponse struct {
	ID        int    `json:"id"`
	GroupID   int    `json:"groupId"`
	GroupName string `json:"groupName"`
	UserID    int    `json:"userId"`
	Username  string `json:"username"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
}

// GroupInviteResponse represents a group invite
type GroupInviteResponse struct {
	ID        int    `json:"id"`
	GroupID   int    `json:"groupId"`
	GroupName string `json:"groupName"`
	UserID    int    `json:"userId"`
	Username  string `json:"username"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
}

// GetAllRequestsHandler fetches all types of requests for the current user
func GetAllRequestsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := sessions.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get follow requests
	followRequests, err := getPendingFollowRequests(userID)
	if err != nil {
		http.Error(w, "Failed to fetch follow requests", http.StatusInternalServerError)
		return
	}

	// Get group join requests (for group admins)
	groupJoinRequests, err := getGroupJoinRequestsForAdmin(userID)
	if err != nil {
		fmt.Printf("❌ Error fetching group join requests: %v\n", err)
		http.Error(w, "Failed to fetch group join requests", http.StatusInternalServerError)
		return
	}
	fmt.Printf("📊 Group join requests count: %d\n", len(groupJoinRequests))

	// Get group invites (for users)
	groupInvites, err := getGroupInvitesForUser(userID)
	if err != nil {
		http.Error(w, "Failed to fetch group invites", http.StatusInternalServerError)
		return
	}

	totalCount := len(followRequests) + len(groupJoinRequests) + len(groupInvites)

	response := AllRequestsResponse{
		FollowRequests:    followRequests,
		GroupJoinRequests: groupJoinRequests,
		GroupInvites:      groupInvites,
		TotalCount:        totalCount,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// getGroupJoinRequestsForAdmin fetches group join requests for groups where the user is an admin
func getGroupJoinRequestsForAdmin(userID int) ([]GroupJoinRequestResponse, error) {
	fmt.Printf("🔍 Looking for group join requests for user ID: %d\n", userID)

	rows, err := database.Db.Query(`
		SELECT gjr.id, gjr.group_id, g.group_name, gjr.user_id, gjr.username, gjr.status, gjr.created_at
		FROM group_join_requests gjr
		JOIN groups g ON gjr.group_id = g.group_id
		JOIN group_members gm ON g.group_id = gm.group_id
		WHERE gm.user_id = ? AND (gm.is_admin = 1 OR g.created_by = gm.user_id) AND gjr.status = 'pending'
		ORDER BY gjr.created_at DESC
	`, userID)
	if err != nil {
		fmt.Printf("❌ Error querying group join requests: %v\n", err)
		return nil, err
	}
	defer rows.Close()

	var requests []GroupJoinRequestResponse
	for rows.Next() {
		var req GroupJoinRequestResponse
		err := rows.Scan(&req.ID, &req.GroupID, &req.GroupName, &req.UserID, &req.Username, &req.Status, &req.CreatedAt)
		if err != nil {
			fmt.Printf("❌ Error scanning group join request: %v\n", err)
			continue
		}
		fmt.Printf("✅ Found group join request: ID=%d, Group=%s, User=%s\n", req.ID, req.GroupName, req.Username)
		requests = append(requests, req)
	}

	fmt.Printf("📊 Total group join requests found: %d\n", len(requests))
	return requests, nil
}

// getGroupInvitesForUser fetches group invites for the current user
func getGroupInvitesForUser(userID int) ([]GroupInviteResponse, error) {
	rows, err := database.Db.Query(`
		SELECT gir.id, gir.group_id, g.group_name, gir.user_id, gir.username, gir.status, gir.created_at
		FROM group_invite_requests gir
		JOIN groups g ON gir.group_id = g.group_id
		WHERE gir.user_id = ? AND gir.status = 'pending'
		ORDER BY gir.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invites []GroupInviteResponse
	for rows.Next() {
		var invite GroupInviteResponse
		err := rows.Scan(&invite.ID, &invite.GroupID, &invite.GroupName, &invite.UserID, &invite.Username, &invite.Status, &invite.CreatedAt)
		if err != nil {
			continue
		}
		invites = append(invites, invite)
	}

	return invites, nil
}

// getPendingFollowRequests fetches pending follow requests for a user
func getPendingFollowRequests(userID int) ([]FollowRequestResponse, error) {
	rows, err := database.Db.Query(`
		SELECT f.follower_id, u.nickname
		FROM follows f
		JOIN users u ON f.follower_id = u.uid
		WHERE f.following_id = ? AND f.status = 'pending'
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var requests []FollowRequestResponse
	for rows.Next() {
		var req FollowRequestResponse
		err := rows.Scan(&req.FollowerID, &req.FollowerName)
		if err != nil {
			continue
		}
		requests = append(requests, req)
	}

	return requests, nil
}
