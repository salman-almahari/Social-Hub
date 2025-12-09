package models

type UpdateProfileRequest struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	Gender    string `json:"gender"`
	Age       int    `json:"age"`
	IsPublic  string `json:"isPublic"`
	About_Me  string `json:"about_me"`
}
