package database

import (
	"fmt"
	"socialhub/models"
)

func UpdateUserProfile(userID int, req models.UpdateProfileRequest) error {
	query := `
        UPDATE users 
        SET first_name = ?, last_name = ?, email = ?, gender = ?, age = ?, is_public = ?, about_me = ?
        WHERE uid = ?
    `
	_, err := Db.Exec(query, req.FirstName, req.LastName, req.Email, req.Gender, req.Age, req.IsPublic, req.About_Me, userID)
	if err != nil {
		return fmt.Errorf("error updating user profile: %v", err)
	}
	return nil
}
