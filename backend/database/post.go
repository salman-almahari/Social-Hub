package database

// database: /Users/macbookair/Documents/social-network/backend/SN.db
import (
	"database/sql"
	"fmt"
	"strings"
)

type Posts struct {
	ID            int      `json:"id"`
	UserID        int      `json:"user_id"`
	Username      string   `json:"username"`
	Title         string   `json:"title"`
	Content       string   `json:"content"`
	Category      []string `json:"category"`
	ImageURL      string   `json:"image_url,omitempty"`
	PrivacyLevel  string   `json:"privacy_level,omitempty"`
	SelectedUsers []int    `json:"selected_users,omitempty"`
	CreatedAt     string   `json:"created_at,omitempty"`
}

func InsertPost(post Posts) (int64, error) {
	categ := strings.Join(post.Category, ",")

	// Set default privacy level if not specified
	if post.PrivacyLevel == "" {
		post.PrivacyLevel = "public"
	}

	query := `INSERT INTO posts (user_id, post_heading, post_data, category, image_url, privacy_level) 
              VALUES (?, ?, ?, ?, ?, ?)`

	stmt, err := Db.Prepare(query)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	res, err := stmt.Exec(post.UserID, post.Title, post.Content, categ, post.ImageURL, post.PrivacyLevel)
	if err != nil {
		return 0, err
	}

	lastInsertedID, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}

	return lastInsertedID, nil
}

func FetchPosts() ([]Posts, error) {
	rows, err := Db.Query(`
		SELECT p.post_id, p.user_id, u.nickname, p.post_heading, p.post_data, p.category, p.image_url, p.privacy_level, p.created_at 
		FROM posts p 
		JOIN users u ON p.user_id = u.uid 
		WHERE COALESCE(p.privacy_level, 'public') = 'public'
		ORDER BY p.post_id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []Posts
	for rows.Next() {
		var post Posts
		var categoryStr string
		var imageURL *string
		var privacyLevel *string
		var createdAt *string

		if err := rows.Scan(&post.ID, &post.UserID, &post.Username, &post.Title, &post.Content, &categoryStr, &imageURL, &privacyLevel, &createdAt); err != nil {
			return nil, err
		}

		if imageURL != nil {
			post.ImageURL = *imageURL
		}

		if privacyLevel != nil {
			post.PrivacyLevel = *privacyLevel
		} else {
			post.PrivacyLevel = "public"
		}

		if createdAt != nil {
			post.CreatedAt = *createdAt
		}

		// Convert category string back to slice
		if categoryStr != "" {
			post.Category = strings.Split(categoryStr, ",")
		}

		posts = append(posts, post)
	}

	return posts, nil
}

// FetchPostsWithPrivacy fetches posts based on privacy settings and viewer permissions
func FetchPostsWithPrivacy(viewerID int) ([]Posts, error) {
	query := `
		SELECT DISTINCT p.post_id, p.user_id, u.nickname, p.post_heading, p.post_data, p.category, p.image_url, COALESCE(p.privacy_level, 'public') as privacy_level, p.created_at
		FROM posts p
		JOIN users u ON p.user_id = u.uid
		LEFT JOIN follows f ON p.user_id = f.following_id AND f.follower_id = ?
		LEFT JOIN post_permissions pp ON p.post_id = pp.post_id AND pp.user_id = ?
		WHERE COALESCE(p.privacy_level, 'public') = 'public'
		   OR (COALESCE(p.privacy_level, 'public') = 'almost_private' AND f.status = 'accepted')
		   OR (COALESCE(p.privacy_level, 'public') = 'private' AND pp.user_id IS NOT NULL)
		   OR p.user_id = ?
		ORDER BY p.post_id DESC
	`

	rows, err := Db.Query(query, viewerID, viewerID, viewerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []Posts
	for rows.Next() {
		var post Posts
		var categoryStr string
		var imageURL *string
		var privacyLevel string
		var createdAt *string

		if err := rows.Scan(&post.ID, &post.UserID, &post.Username, &post.Title, &post.Content, &categoryStr, &imageURL, &privacyLevel, &createdAt); err != nil {
			return nil, err
		}

		if imageURL != nil {
			post.ImageURL = *imageURL
		}

		post.PrivacyLevel = privacyLevel

		if createdAt != nil {
			post.CreatedAt = *createdAt
		}

		// Convert category string back to slice
		if categoryStr != "" {
			post.Category = strings.Split(categoryStr, ",")
		}

		posts = append(posts, post)
	}

	return posts, nil
}

// AddPostPermission adds a user to the allowed viewers for a private post
func AddPostPermission(postID int, userID int) error {
	// First, ensure the post_permissions table exists
	createTableQuery := `
		CREATE TABLE IF NOT EXISTS post_permissions (
			post_id INTEGER,
			user_id INTEGER,
			FOREIGN KEY (post_id) REFERENCES posts (post_id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users (uid) ON DELETE CASCADE,
			PRIMARY KEY (post_id, user_id)
		)
	`
	_, err := Db.Exec(createTableQuery)
	if err != nil {
		return err
	}

	query := `INSERT OR IGNORE INTO post_permissions (post_id, user_id) VALUES (?, ?)`
	_, err = Db.Exec(query, postID, userID)
	return err
}

// RemovePostPermission removes a user from the allowed viewers for a private post
func RemovePostPermission(postID int, userID int) error {
	// First, ensure the post_permissions table exists
	createTableQuery := `
		CREATE TABLE IF NOT EXISTS post_permissions (
			post_id INTEGER,
			user_id INTEGER,
			FOREIGN KEY (post_id) REFERENCES posts (post_id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users (uid) ON DELETE CASCADE,
			PRIMARY KEY (post_id, user_id)
		)
	`
	_, err := Db.Exec(createTableQuery)
	if err != nil {
		return err
	}

	query := `DELETE FROM post_permissions WHERE post_id = ? AND user_id = ?`
	_, err = Db.Exec(query, postID, userID)
	return err
}

// GetPostPermissions gets all users who can view a specific private post
func GetPostPermissions(postID int) ([]int, error) {
	// First, ensure the post_permissions table exists
	createTableQuery := `
		CREATE TABLE IF NOT EXISTS post_permissions (
			post_id INTEGER,
			user_id INTEGER,
			FOREIGN KEY (post_id) REFERENCES posts (post_id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users (uid) ON DELETE CASCADE,
			PRIMARY KEY (post_id, user_id)
		)
	`

	_, err := Db.Exec(createTableQuery)
	if err != nil {
		return nil, err
	}

	query := `SELECT user_id FROM post_permissions WHERE post_id = ?`
	rows, err := Db.Query(query, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var userIDs []int
	for rows.Next() {
		var userID int
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		userIDs = append(userIDs, userID)
	}

	return userIDs, nil
}

func FetchPostsByUserID(userID int) ([]Posts, error) {
	rows, err := Db.Query(`
		SELECT p.post_id, p.user_id, u.nickname, p.post_heading, p.post_data, p.category, p.image_url, p.privacy_level, p.created_at 
		FROM posts p 
		JOIN users u ON p.user_id = u.uid 
		WHERE p.user_id = ? 
		ORDER BY p.post_id DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []Posts
	for rows.Next() {
		var post Posts
		var categoryStr string
		var imageURL *string
		var privacyLevel *string
		var createdAt *string

		if err := rows.Scan(&post.ID, &post.UserID, &post.Username, &post.Title, &post.Content, &categoryStr, &imageURL, &privacyLevel, &createdAt); err != nil {
			return nil, err
		}

		if imageURL != nil {
			post.ImageURL = *imageURL
		}

		if privacyLevel != nil {
			post.PrivacyLevel = *privacyLevel
		} else {
			post.PrivacyLevel = "public"
		}

		if createdAt != nil {
			post.CreatedAt = *createdAt
		}

		// Convert category string back to slice
		if categoryStr != "" {
			post.Category = strings.Split(categoryStr, ",")
		}

		posts = append(posts, post)
	}

	return posts, nil
}

// FetchPostsByUserIDWithPrivacy fetches posts by a specific user with privacy filtering for a viewer
func FetchPostsByUserIDWithPrivacy(userID int, viewerID int) ([]Posts, error) {
	// First, let's check what posts exist and their privacy levels
	checkQuery := `SELECT post_id, post_heading, COALESCE(privacy_level, 'public') as privacy_level FROM posts WHERE user_id = ?`
	checkRows, err := Db.Query(checkQuery, userID)
	if err != nil {
		return nil, err
	}
	defer checkRows.Close()

	fmt.Printf("🔍 Checking posts for user %d (viewer: %d):\n", userID, viewerID)
	for checkRows.Next() {
		var postID int
		var title, privacy string
		checkRows.Scan(&postID, &title, &privacy)
		fmt.Printf("  Post %d: '%s' (privacy: %s)\n", postID, title, privacy)
	}

	// Check follow status
	var followStatus string
	err = Db.QueryRow("SELECT status FROM follows WHERE follower_id = ? AND following_id = ?", viewerID, userID).Scan(&followStatus)
	if err != nil {
		followStatus = "not_following"
	}
	fmt.Printf("  Follow status: %s\n", followStatus)

	// Let's test each condition separately to see what's happening
	fmt.Printf("  🔍 Testing query conditions:\n")

	// Test 1: Public posts
	publicQuery := `SELECT COUNT(*) FROM posts WHERE user_id = ? AND COALESCE(privacy_level, 'public') = 'public'`
	var publicCount int
	err = Db.QueryRow(publicQuery, userID).Scan(&publicCount)
	if err != nil {
		fmt.Printf("Error checking public posts: %v\n", err)
	} else {
		fmt.Printf("Public posts: %d\n", publicCount)
	}

	// Test 2: Almost private posts with accepted follow
	almostPrivateQuery := `
		SELECT COUNT(*) FROM posts p
		LEFT JOIN follows f ON p.user_id = f.following_id AND f.follower_id = ?
		WHERE p.user_id = ? AND COALESCE(p.privacy_level, 'public') = 'almost_private' AND f.status = 'accepted'
	`
	var almostPrivateCount int
	err = Db.QueryRow(almostPrivateQuery, viewerID, userID).Scan(&almostPrivateCount)
	if err != nil {
		fmt.Printf("Error checking almost private posts: %v\n", err)
	} else {
		fmt.Printf("Almost private posts (with accepted follow): %d\n", almostPrivateCount)
	}

	privateQuery := `
		SELECT COUNT(*) FROM posts p
		LEFT JOIN post_permissions pp ON p.post_id = pp.post_id AND pp.user_id = ?
		WHERE p.user_id = ? AND COALESCE(p.privacy_level, 'public') = 'private' AND pp.user_id IS NOT NULL
	`
	var privateCount int
	err = Db.QueryRow(privateQuery, viewerID, userID).Scan(&privateCount)
	if err != nil {
		fmt.Printf("    ❌ Error checking private posts: %v\n", err)
	} else {
		fmt.Printf("    ✅ Private posts (with permissions): %d\n", privateCount)
	}

	// Check if post_permissions table exists
	var tableExists int
	err = Db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='post_permissions'").Scan(&tableExists)
	if err != nil {
		fmt.Printf("    ❌ Error checking post_permissions table: %v\n", err)
		tableExists = 0
	}

	var rows *sql.Rows

	if tableExists == 0 {
		fmt.Printf("    ⚠️  post_permissions table doesn't exist, using simplified query\n")
		// Simplified query without private post permissions
		query := `
			SELECT DISTINCT p.post_id, p.user_id, u.nickname, p.post_heading, p.post_data, p.category, p.image_url, COALESCE(p.privacy_level, 'public') as privacy_level, p.created_at
			FROM posts p
			JOIN users u ON p.user_id = u.uid
			LEFT JOIN follows f ON p.user_id = f.following_id AND f.follower_id = ?
			WHERE p.user_id = ?
			  AND (
			       COALESCE(p.privacy_level, 'public') = 'public'
			       OR (COALESCE(p.privacy_level, 'public') = 'almost_private' AND f.status = 'accepted')
			       OR p.user_id = ?
			  )
			ORDER BY p.post_id DESC
		`
		rows, err = Db.Query(query, viewerID, userID, viewerID)
	} else {
		fmt.Printf("    ✅ post_permissions table exists, using full query\n")
		// Full query with private post permissions
		query := `
			SELECT DISTINCT p.post_id, p.user_id, u.nickname, p.post_heading, p.post_data, p.category, p.image_url, COALESCE(p.privacy_level, 'public') as privacy_level, p.created_at
			FROM posts p
			JOIN users u ON p.user_id = u.uid
			LEFT JOIN follows f ON p.user_id = f.following_id AND f.follower_id = ?
			LEFT JOIN post_permissions pp ON p.post_id = pp.post_id AND pp.user_id = ?
			WHERE p.user_id = ?
			  AND (
			       COALESCE(p.privacy_level, 'public') = 'public'
			       OR (COALESCE(p.privacy_level, 'public') = 'almost_private' AND f.status = 'accepted')
			       OR (COALESCE(p.privacy_level, 'public') = 'private' AND pp.user_id IS NOT NULL)
			       OR p.user_id = ?
			  )
			ORDER BY p.post_id DESC
		`
		rows, err = Db.Query(query, viewerID, viewerID, userID, viewerID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []Posts
	for rows.Next() {
		var post Posts
		var categoryStr string
		var imageURL *string
		var privacyLevel string
		var createdAt *string

		if err := rows.Scan(&post.ID, &post.UserID, &post.Username, &post.Title, &post.Content, &categoryStr, &imageURL, &privacyLevel, &createdAt); err != nil {
			return nil, err
		}

		if imageURL != nil {
			post.ImageURL = *imageURL
		}

		post.PrivacyLevel = privacyLevel

		if createdAt != nil {
			post.CreatedAt = *createdAt
		}

		// Convert category string back to slice
		if categoryStr != "" {
			post.Category = strings.Split(categoryStr, ",")
		}

		posts = append(posts, post)
	}

	fmt.Printf("  ✅ Returning %d posts\n", len(posts))
	return posts, nil
}
