package database

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

func RegisterUser(nickname, first_name, last_name, gender, age, email, password, is_public, about_me string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Println(err)
		return err
	}
	password = string(hashedPassword)
	
	// Handle empty nickname - set to NULL in database
	var nicknameValue interface{}
	if nickname == "" {
		nicknameValue = nil
	} else {
		nicknameValue = nickname
	}
	
	// Handle empty about_me - set to NULL in database
	var aboutMeValue interface{}
	if about_me == "" {
		aboutMeValue = nil
	} else {
		aboutMeValue = about_me
	}
	
	query := `INSERT INTO users (nickname, first_name, last_name, gender, age, email, password, avatar_url, is_public, about_me) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
	if _, err := Db.Exec(query, nicknameValue, first_name, last_name, gender, age, email, password, is_public, aboutMeValue); err != nil {
		fmt.Println(err)
		return err
	}
	return nil
}

// NicknameExists checks if a nickname already exists in the database
func NicknameExists(nickname string) (bool, error) {
	var exists int
	query := `SELECT COUNT(*) FROM users WHERE nickname = ?`
	err := Db.QueryRow(query, nickname).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists > 0, nil
}

func RegisterUserWithAvatar(nickname, first_name, last_name, gender, age, email, password, avatarUrl, is_public, about_me string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Println(err)
		return err
	}
	password = string(hashedPassword)
	
	// Handle empty nickname - set to NULL in database
	var nicknameValue interface{}
	if nickname == "" {
		nicknameValue = nil
	} else {
		nicknameValue = nickname
	}
	
	// Handle empty about_me - set to NULL in database
	var aboutMeValue interface{}
	if about_me == "" {
		aboutMeValue = nil
	} else {
		aboutMeValue = about_me
	}
	
	query := `INSERT INTO users (nickname, first_name, last_name, gender, age, email, password, avatar_url, is_public, about_me) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	if _, err := Db.Exec(query, nicknameValue, first_name, last_name, gender, age, email, password, avatarUrl, is_public, aboutMeValue); err != nil {
		fmt.Println(err)
		return err
	}
	return nil
}
