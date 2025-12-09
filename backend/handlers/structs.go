package handlers

import (
	"time"
)

type Log struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type Reg struct {
	Nickname   string `json:"nickname"`
	First_Name string `json:"first_name"`
	Last_Name  string `json:"last_name"`
	Gender     string `json:"gender"`
	Age        int    `json:"age"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	AvatarUrl  string `json:"avatar_url"`
	Is_Public  string `json:"is_public"`
	About_Me   string `json:"about_me"`
}

type Posts struct {
	ID       int      `json:"id"`
	UserID   int      `json:"user_id"`
	Username string   `json:"username"`
	Title    string   `json:"title"`
	Content  string   `json:"content"`
	Category []string `json:"category"`
}

// type Client struct {
// 	Conn     *websocket.Conn `json:"-"`
// 	Userid   int             `json:"user_id"`
// 	Nickname string          `json:"nickname"`
// }

type Group struct {
    ID                    int    `json:"id"`
    GroupName            string `json:"groupName"`
    Description          string `json:"description"`
    CreatedAt            string `json:"createdAt"`
    IsAdmin              bool   `json:"isAdmin"`
    IsMember             bool   `json:"isMember"`
    CreatedByUsername    string `json:"createdByUsername"`
    UpcomingEventsCount  int    `json:"upcomingEventsCount"`
}

type CreateGroupRequest struct {
	GroupName   string `json:"groupName"`
	Description string `json:"groupDescription"`
}

type GroupResponse struct {
	ID          int       `json:"id"`
	GroupName   string    `json:"groupName"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

type GroupResponseWithAdmin struct {
	GroupResponse
	CreatedBy         int    `json:"createdBy"`
	CreatedByUsername string `json:"createdByUsername"`
	IsAdmin           bool   `json:"isAdmin"`
	IsMember          bool   `json:"isMember"`
}

type AddUserToGroupRequest struct {
	GroupID  int    `json:"groupId"`
	Username string `json:"username"`
}

type GroupMember struct {
	Username string    `json:"username"`
	JoinedAt time.Time `json:"joinedAt"`
	IsAdmin  bool      `json:"isAdmin"`
}

type GroupInvitation struct {
	ID         int       `json:"id"`
	GroupID    int       `json:"group_id"`
	SenderID   int       `json:"sender_id"`
	ReceiverID int       `json:"receiver_id"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

type GroupRequest struct {
	ID        int       `json:"id"`
	GroupID   int       `json:"group_id"`
	UserID    int       `json:"user_id"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type GroupEvent struct {
	ID           int     `json:"id"`
	GroupID      int     `json:"groupId"`
	Title        string  `json:"title"`
	Description  string  `json:"description"`
	EventTime    string  `json:"eventTime"`
	CreatedBy    string  `json:"createdBy"`
	GoingCount   int     `json:"goingCount"`
	NotGoingCount int    `json:"notGoingCount"`
	UserResponse *string `json:"userResponse"`
}

type EventResponse struct {
	EventID  int    `json:"event_id"`
	UserID   int    `json:"user_id"`
	Response string `json:"response"`
}

type FollowRequest struct {
	TargetNickname string `json:"target_nickname"`
}

type FollowRequestResponse struct {
	FollowerID   int    `json:"follower_id"`
	FollowerName string `json:"follower_name"`
}

// type Message struct {
// 	From string `json:"from"`
// 	To   string `json:"to"`
// 	Text string `json:"text"`
// 	Time string `json:"time"`
// }
