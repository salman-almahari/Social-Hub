package database

import (
	"database/sql"
	"fmt"
	"log"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/mattn/go-sqlite3"
)

var Db *sql.DB

func InitDB(dbPath string) error {
	database, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatal(err)
	}
	Db = database
	driver, err := sqlite3.WithInstance(Db, &sqlite3.Config{})
	if err != nil {
		log.Fatal("Error creating SQLite driver:", err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		"file://migrations",
		"sqlite3",
		driver,
	)
	if err != nil {
		log.Fatal("Error creating migration instance:", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal("Migration failed:", err)
	}

	fmt.Println("Migrations applied successfully!")

	// Create group tables after migrations
	if err := CreateGroupTables(); err != nil {
		log.Fatal("Failed to create group tables:", err)
	}

	log.Println("Database setup complete")
	return nil
}

type Post struct {
	ID      int
	Title   string
	Content string
}

func InsertDummyData(db *sql.DB) {
	posts := []Post{
		{Title: "Welcome to the forum", Content: "This is a welcome post!"},
		{Title: "Go programming", Content: "Let's discuss Go programming!"},
		{Title: "Database integration", Content: "Learn how to use SQLite with Go."},
	}

	for _, post := range posts {
		_, err := db.Exec("INSERT INTO posts (post_heading, post_data) VALUES (?, ?)", post.Title, post.Content)
		if err != nil {
			log.Printf("Error inserting post: %v, Title: %s", err, post.Title)
			log.Fatal(err)
		}
	}
}

// CreateGroupTables creates all necessary tables for the group system
func CreateGroupTables() error {

	groupsTable := `
	CREATE TABLE IF NOT EXISTS groups (
		group_id INTEGER PRIMARY KEY AUTOINCREMENT,
		group_name TEXT NOT NULL,
		description TEXT NOT NULL,
		created_by INTEGER NOT NULL,
		created_at TEXT NOT NULL,
		FOREIGN KEY (created_by) REFERENCES users(uid)
	);`

	_, err := Db.Exec(groupsTable)
	if err != nil {
		return fmt.Errorf("failed to create groups table: %v", err)
	}

	groupMembersTable := `
	CREATE TABLE IF NOT EXISTS group_members (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		group_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		joined_at TEXT NOT NULL,
		is_admin BOOLEAN DEFAULT FALSE,
		FOREIGN KEY (group_id) REFERENCES groups(group_id),
		FOREIGN KEY (user_id) REFERENCES users(uid),
		UNIQUE(group_id, user_id)
	);`

	_, err = Db.Exec(groupMembersTable)
	if err != nil {
		return fmt.Errorf("failed to create group_members table: %v", err)
	}

	// Add is_admin column if it doesn't exist (for backwards compatibility)
	_, err = Db.Exec(`ALTER TABLE group_members ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;`)
	if err != nil {
		if !strings.Contains(err.Error(), "duplicate column name") &&
			!strings.Contains(err.Error(), "already exists") {
			return fmt.Errorf("failed to add is_admin column: %v", err)
		}
	}

	groupMessagesTable := `
	CREATE TABLE IF NOT EXISTS group_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		group_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		message TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (group_id) REFERENCES groups(group_id),
		FOREIGN KEY (user_id) REFERENCES users(uid)
	);`

	_, err = Db.Exec(groupMessagesTable)
	if err != nil {
		return fmt.Errorf("failed to create group_messages table: %v", err)
	}

	groupPostsTable := `
	CREATE TABLE IF NOT EXISTS group_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    media TEXT DEFAULT '',
    image_url TEXT,
    categories TEXT,
    author_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(uid) ON DELETE CASCADE
);`

	_, err = Db.Exec(groupPostsTable)
	if err != nil {
		return fmt.Errorf("failed to create group_posts table: %v", err)
	}

	// Add media column if it doesn't exist (for backwards compatibility)
	_, err = Db.Exec(`ALTER TABLE group_posts ADD COLUMN media TEXT DEFAULT '';`)
	if err != nil {
		// Check if error is because column already exists
		if !strings.Contains(err.Error(), "duplicate column name") &&
			!strings.Contains(err.Error(), "already exists") {
			return fmt.Errorf("failed to add media column: %v", err)
		}
	}

	groupPostLikesTable := `
	CREATE TABLE IF NOT EXISTS group_post_likes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		post_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		created_at DATETIME NOT NULL,
		UNIQUE(post_id, user_id), -- Prevent duplicate likes
		FOREIGN KEY (post_id) REFERENCES group_posts(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
	);`

	_, err = Db.Exec(groupPostLikesTable)
	if err != nil {
		return fmt.Errorf("failed to create group_post_likes table: %v", err)
	}

	groupPostCommentsTable := `
	CREATE TABLE IF NOT EXISTS group_post_comments (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	post_id INTEGER NOT NULL,
	content TEXT NOT NULL,
	image_url TEXT,
	author_id INTEGER NOT NULL,
	created_at DATETIME NOT NULL,
	FOREIGN KEY (post_id) REFERENCES group_posts(id) ON DELETE CASCADE,
	FOREIGN KEY (author_id) REFERENCES users(uid) ON DELETE CASCADE
	);`

	_, err = Db.Exec(groupPostCommentsTable)
	if err != nil {
		return fmt.Errorf("failed to create group_post_comments table: %v", err)
	}

	// Create group_join_requests table (FIXED VERSION)
	groupJoinRequestsTable := `
	CREATE TABLE IF NOT EXISTS group_join_requests (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		group_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		username TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		created_at TEXT NOT NULL,
		FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE,
		UNIQUE(group_id, user_id)
	);`

	_, err = Db.Exec(groupJoinRequestsTable)
	if err != nil {
		return fmt.Errorf("failed to create group_join_requests table: %v", err)
	}

	// Create group_invite_requests table
	groupInviteRequestsTable := `
	CREATE TABLE IF NOT EXISTS group_invite_requests (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		group_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		username TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		created_at TEXT NOT NULL,
		FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE,
		UNIQUE(group_id, user_id)
	);`
	_, err = Db.Exec(groupInviteRequestsTable)
	if err != nil {
		return fmt.Errorf("failed to create group_invite_requests table: %v", err)
	}

	// Create group_events table
	groupEventsTable := `
	CREATE TABLE IF NOT EXISTS group_events (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		group_id INTEGER NOT NULL,
		title TEXT NOT NULL,
		description TEXT NOT NULL,
		event_time DATETIME NOT NULL,
		created_by INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
		FOREIGN KEY (created_by) REFERENCES users(uid) ON DELETE CASCADE
	);`

	_, err = Db.Exec(groupEventsTable)
	if err != nil {
		return fmt.Errorf("failed to create group_events table: %v", err)
	}

	// Create event_responses table
	eventResponsesTable := `
	CREATE TABLE IF NOT EXISTS event_responses (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		event_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		response TEXT NOT NULL CHECK (response IN ('going', 'not_going')),
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (event_id) REFERENCES group_events(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE,
		UNIQUE(event_id, user_id)
	);`

	_, err = Db.Exec(eventResponsesTable)
	if err != nil {
		return fmt.Errorf("failed to create event_responses table: %v", err)
	}

	// Create group_message_notifications table for tracking unread messages
	groupNotificationsTable := `
	CREATE TABLE IF NOT EXISTS group_message_notifications (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		group_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		last_read_message_id INTEGER DEFAULT 0,
		unread_count INTEGER DEFAULT 0,
		FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE,
		UNIQUE(group_id, user_id)
	);`

	_, err = Db.Exec(groupNotificationsTable)
	if err != nil {
		return fmt.Errorf("failed to create group_message_notifications table: %v", err)
	}

	// Create indexes for better performance
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_group_posts_group_id ON group_posts(group_id);",
		"CREATE INDEX IF NOT EXISTS idx_group_posts_author_id ON group_posts(author_id);",
		"CREATE INDEX IF NOT EXISTS idx_group_posts_created_at ON group_posts(created_at);",
		"CREATE INDEX IF NOT EXISTS idx_group_post_likes_post_id ON group_post_likes(post_id);",
		"CREATE INDEX IF NOT EXISTS idx_group_post_likes_user_id ON group_post_likes(user_id);",
		"CREATE INDEX IF NOT EXISTS idx_group_join_requests_group_status ON group_join_requests(group_id, status);",
		"CREATE INDEX IF NOT EXISTS idx_group_join_requests_user ON group_join_requests(user_id);",
		"CREATE INDEX IF NOT EXISTS idx_group_post_comments_post_id ON group_post_comments(post_id);",
		"CREATE INDEX IF NOT EXISTS idx_group_events_group_id ON group_events(group_id);",
		"CREATE INDEX IF NOT EXISTS idx_group_events_event_time ON group_events(event_time);",
		"CREATE INDEX IF NOT EXISTS idx_event_responses_event_id ON event_responses(event_id);",
		"CREATE INDEX IF NOT EXISTS idx_event_responses_user_id ON event_responses(user_id);",
		"CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);",
		"CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);",
	}

	for _, indexSQL := range indexes {
		_, err = Db.Exec(indexSQL)
		if err != nil {
			return fmt.Errorf("failed to create index: %v", err)
		}
	}

	fmt.Println("Group tables (including posts, likes, events, and join requests) created successfully")
	return nil
}

// Legacy function - keeping for compatibility
func CreateGroupMessagesTable() error {
	return CreateGroupTables()
}
