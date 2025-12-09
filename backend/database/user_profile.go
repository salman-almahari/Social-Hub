package database

import (
	"database/sql"
	"strings"
)

type UserProfile struct {
	Nickname       string  `json:"nickname"`
	FirstName      string  `json:"firstName"`
	LastName       string  `json:"lastName"`
	Email          string  `json:"email"`
	Gender         string  `json:"gender"`
	Age            int     `json:"age"`
	ProfilePicture string  `json:"profilePicture"`
	About_Me       string  `json:"about_me"`
	Posts          []Posts `json:"posts"`
	Followers      int     `json:"followers"`
	Following      int     `json:"following"`
	IsPublic       string  `json:"isPublic"`
}

func GetUserProfileByID(db *sql.DB, userID int) (*UserProfile, error) {
	query := `
		SELECT 
			u.nickname,
			u.first_name as firstName,
			u.last_name as lastName,
			u.email,
			u.gender,
			u.age,
			COALESCE(u.avatar_url, ''),
			COALESCE(u.about_me, ''),
			u.is_public as isPublic,
			(SELECT COUNT(*) FROM follows WHERE following_id = u.uid AND status = 'accepted') as followers,
			(SELECT COUNT(*) FROM follows WHERE follower_id = u.uid AND status = 'accepted') as following
		FROM users u 
		WHERE u.uid = ?;
	`

	var profile UserProfile
	err := db.QueryRow(query, userID).Scan(
		&profile.Nickname,
		&profile.FirstName,
		&profile.LastName,
		&profile.Email,
		&profile.Gender,
		&profile.Age,
		&profile.ProfilePicture,
		&profile.About_Me,
		&profile.IsPublic,
		&profile.Followers,
		&profile.Following,
	)
	if err != nil {
		return nil, err
	}

	// Fetch user's posts (user can see all their own posts)
	posts, err := FetchPostsByUserID(userID)
	if err != nil {
		profile.Posts = []Posts{}
	} else {
		profile.Posts = posts
	}

	return &profile, nil
}

func GetUserPublicProfileByNickname(db *sql.DB, nickname string, viewerID int) (*UserProfile, error) {
	// COALESCE is to avoid null issues, this is something new for me leave the comment
	query := `
		SELECT 
			u.nickname,
			u.first_name as firstName,
			u.last_name as lastName,
			u.email,
			u.gender,
			u.age,
			COALESCE(u.avatar_url, ''),
			COALESCE(u.about_me, ''),
			u.is_public as isPublic,
			(SELECT COUNT(*) FROM follows WHERE following_id = u.uid AND status = 'accepted') as followers,
			(SELECT COUNT(*) FROM follows WHERE follower_id = u.uid AND status = 'accepted') as following
		FROM users u 
		WHERE u.nickname = ?;
	`

	var profile UserProfile
	err := db.QueryRow(query, nickname).Scan(
		&profile.Nickname,
		&profile.FirstName,
		&profile.LastName,
		&profile.Email,
		&profile.Gender,
		&profile.Age,
		&profile.ProfilePicture,
		&profile.About_Me,
		&profile.IsPublic,
		&profile.Followers,
		&profile.Following,
	)
	if err != nil {
		return nil, err
	}

	// Get user ID for posts query
	var userID int
	err = db.QueryRow("SELECT uid FROM users WHERE nickname = ?", nickname).Scan(&userID)
	if err != nil {
		profile.Posts = []Posts{}
		return &profile, nil
	}

	// Check if viewer can see posts (public profile OR viewer is following)
	canViewPosts := false
	if strings.ToLower(profile.IsPublic) == "public" {
		canViewPosts = true
	} else {
		// Check if viewer is following this user
		var followStatus string
		err = db.QueryRow("SELECT status FROM follows WHERE follower_id = ? AND following_id = ?", viewerID, userID).Scan(&followStatus)
		if err == nil && followStatus == "accepted" {
			canViewPosts = true
		}
	}

	if canViewPosts {
		// Fetch user's posts with privacy filtering
		posts, err := FetchPostsByUserIDWithPrivacy(userID, viewerID)
		if err != nil {
			profile.Posts = []Posts{}
		} else {
			profile.Posts = posts
		}
	} else {
		// Don't include posts for private profiles when viewer is not following
		profile.Posts = []Posts{}
	}

	return &profile, nil
}
