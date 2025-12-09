package database

import (
	"database/sql"
	"fmt"
)

func GetUser(email string) (string, error) {
	query := `SELECT password  FROM users WHERE email = ?`
	var password string
	err := Db.QueryRow(query, email).Scan(&password)
	if err != nil {
		return "", err
	}
	return password, nil
}

func GetUserID(email string) (int, error) {
	query := `SELECT uid  FROM users WHERE email = ?`
	var userid int
	err := Db.QueryRow(query, email).Scan(&userid)
	if err != nil {
		fmt.Println("Error with UserId")
		return -1, err
	}
	return userid, nil
}

func GetUserIDBySession(sessionID string) (int, error) {
	query := `SELECT user_id FROM sessions WHERE session = ?`
	var userID int
	err := Db.QueryRow(query, sessionID).Scan(&userID)
	if err != nil {
		return -1, fmt.Errorf("could not find user_id for session_id: %v", err)
	}
	return userID, nil
}

func GetNickname(user_id int) (string, error) {
	query := `SELECT nickname FROM users WHERE uid = ?`
	var nickname sql.NullString
	err := Db.QueryRow(query, user_id).Scan(&nickname)
	if err != nil {
		return "", err
	}

	if nickname.Valid {
		fmt.Println("Nickname:", nickname.String)
		return nickname.String, nil
	} else {
		// If nickname is NULL, return a default value or empty string
		fmt.Println("Nickname: NULL (no nickname set)")
		return "", nil
	}
}

func GetNicknameByUserID(userID int) (string, error) {
	return GetNickname(userID)
}

func GetAllNicknames() ([]string, error) {
	query := `SELECT nickname FROM users WHERE nickname IS NOT NULL`
	rows, err := Db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nicknames []string
	for rows.Next() {
		var nickname string
		if err := rows.Scan(&nickname); err != nil {
			return nil, err
		}
		nicknames = append(nicknames, nickname)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	// fmt.Println("Nicknames:", nicknames)
	return nicknames, nil
}

func GetUserIDByNickname(nickname string) (int, error) {
	if Db == nil {
		return 0, fmt.Errorf("Database is not initialized")
	}

	var id int
	err := Db.QueryRow("SELECT uid FROM users WHERE nickname = ?", nickname).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("failed to get user ID by nickname '%s': %v", nickname, err)
	}
	return id, nil
}

func GetUserIDAndVisibilityByNickname(nickname string) (int, string, error) {
	var id int
	var visibility string

	err := Db.QueryRow("SELECT uid, is_public FROM users WHERE nickname = ?", nickname).Scan(&id, &visibility)
	if err != nil {
		return 0, "", fmt.Errorf("failed to get user ID and visibility for nickname '%s': %v", nickname, err)
	}

	return id, visibility, nil
}
