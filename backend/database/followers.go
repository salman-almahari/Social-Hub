package database

import "fmt"

type FollowerUser struct {
	ID             int    `json:"id"`
	Nickname       string `json:"nickname"`
	ProfilePicture string `json:"profilePicture,omitempty"`
}

func GetFollowersByNickname(nickname string) ([]FollowerUser, error) {
	query := `
		SELECT u.uid, u.nickname, u.avatar_url
		FROM follows f
		JOIN users u ON f.follower_id = u.uid
		WHERE f.following_id = (SELECT uid FROM users WHERE nickname = ?) 
		AND f.status = 'accepted'
		ORDER BY u.nickname
	`

	rows, err := Db.Query(query, nickname)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var followers []FollowerUser
	for rows.Next() {
		var user FollowerUser
		var avatarURL *string

		if err := rows.Scan(&user.ID, &user.Nickname, &avatarURL); err != nil {
			return nil, err
		}

		if avatarURL != nil {
			user.ProfilePicture = *avatarURL
		}

		followers = append(followers, user)
	}

	return followers, nil
}

func GetFollowingByNickname(nickname string) ([]FollowerUser, error) {
	query := `
		SELECT u.uid, u.nickname, u.avatar_url
		FROM follows f
		JOIN users u ON f.following_id = u.uid
		WHERE f.follower_id = (SELECT uid FROM users WHERE nickname = ?) 
		AND f.status = 'accepted'
		ORDER BY u.nickname
	`

	rows, err := Db.Query(query, nickname)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var following []FollowerUser
	for rows.Next() {
		var user FollowerUser
		var avatarURL *string

		if err := rows.Scan(&user.ID, &user.Nickname, &avatarURL); err != nil {
			return nil, err
		}

		if avatarURL != nil {
			user.ProfilePicture = *avatarURL
		}

		following = append(following, user)
	}

	return following, nil
}

func CanViewFollowers(targetNickname string, viewerID int) (bool, error) {
	// Allow users to always view their own followers/following
	var targetID int
	err := Db.QueryRow("SELECT uid FROM users WHERE nickname = ?", targetNickname).Scan(&targetID)
	if err != nil {
		fmt.Printf("CanViewFollowers: Error getting targetID: %v\n", err)
		return false, err
	}
	if targetID == viewerID {
		fmt.Printf("CanViewFollowers: Viewer is the owner, access granted.\n")
		return true, nil
	}
	// Check if the target user is public or if the viewer is following them
	query := `
		SELECT 
			CASE 
				WHEN u.is_public = 'public' THEN 1
				WHEN EXISTS (
					SELECT 1 FROM follows 
					WHERE follower_id = ? AND following_id = u.uid AND status = 'accepted'
				) THEN 1
				ELSE 0
			END as can_view
		FROM users u
		WHERE u.nickname = ?
	`
	fmt.Printf("CanViewFollowers: Checking if user %d can view %s\n", viewerID, targetNickname)
	var canView int
	err = Db.QueryRow(query, viewerID, targetNickname).Scan(&canView)
	if err != nil {
		fmt.Printf("CanViewFollowers: Database error: %v\n", err)
		return false, err
	}
	fmt.Printf("CanViewFollowers: Result: %d\n", canView)
	return canView == 1, nil
}
