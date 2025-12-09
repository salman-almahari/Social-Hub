package followers

import (
	"database/sql"
	"fmt"
	"social-network/handlers"
)

var Db *sql.DB

func CreateFollowRequest(followerID, followingID int) error {
	query := `INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, 'pending')`
	_, err := Db.Exec(query, followerID, followingID)
	if err != nil {
		fmt.Println("Error creating follow request:", err)
		return err
	}
	return nil
}

func DeleteFollow(followerID, followingID int) error {
	query := `DELETE FROM follows WHERE follower_id = ? AND following_id = ?`
	_, err := Db.Exec(query, followerID, followingID)
	if err != nil {
		fmt.Println("Error deleting follow:", err)
		return err
	}
	return nil
}

func AcceptFollowRequest(followerID, followingID int) error {
	query := `UPDATE follows SET status = 'accepted' WHERE follower_id = ? AND following_id = ?`
	_, err := Db.Exec(query, followerID, followingID)
	if err != nil {
		fmt.Println("Error accepting follow request:", err)
		return err
	}
	return nil
}

func DeleteFollowRequest(followerID, followingID int) error {
	query := `DELETE FROM follows WHERE follower_id = ? AND following_id = ? AND status = 'pending'`
	_, err := Db.Exec(query, followerID, followingID)
	if err != nil {
		fmt.Println("Error deleting follow request:", err)
		return err
	}
	return nil
}

func GetPendingFollowRequests(userID int) ([]handlers.FollowRequestResponse, error) {
	query := `
		SELECT f.follower_id, u.nickname
		FROM follows f
		JOIN users u ON f.follower_id = u.uid
		WHERE f.following_id = ? AND f.status = 'pending'
	`

	rows, err := Db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []handlers.FollowRequestResponse
	for rows.Next() {
		var r handlers.FollowRequestResponse
		if err := rows.Scan(&r.FollowerID, &r.FollowerName); err != nil {
			return nil, err
		}
		results = append(results, r)
	}

	return results, nil
}

func GetFollowStatus(userID int, targetNickname string) (string, error) {
	query := `
		SELECT f.status
		FROM follows f
		JOIN users u ON u.uid = f.following_id
		WHERE f.follower_id = ? AND u.nickname = ?
	`
	var status string
	err := Db.QueryRow(query, userID, targetNickname).Scan(&status)
	if err == sql.ErrNoRows {
		return "none", nil
	}
	if err != nil {
		return "", err
	}
	return status, nil
}
