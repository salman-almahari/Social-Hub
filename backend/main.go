package main

import (
	"fmt"
	"log"
	"net/http"
	"socialhub/database"
	"socialhub/followers"
	"socialhub/handlers"
	"socialhub/sessions"
)

func main() {
	database.InitDB("SN.db")

	ss := sessions.CreateSessionStore(database.Db)
	sessions.SessionStoreInstance = ss
	followers.Db = database.Db

	handlers.InitializeWebSocketNotifications()
	followers.SetNotifyFollowStatusUpdate(handlers.NotifyFollowStatusUpdate)

	Auth := sessions.AuthHandler{SessionStore: ss, DB: database.Db}

	http.HandleFunc("/ws", handlers.UnifiedWebSocketHandler)

	http.HandleFunc("/login", corsMiddleware(Auth.Login))
	http.HandleFunc("/register", corsMiddleware(handlers.RegHandler))
	http.HandleFunc("/logout", corsMiddleware(Auth.Logout))
	http.HandleFunc("/auth/status", corsMiddleware(Auth.AuthStatus))

	http.HandleFunc("/createpost", corsMiddleware(handlers.InsertPostHandler))
	http.HandleFunc("/posts", corsMiddleware(handlers.GetPostsHandler))

	http.HandleFunc("/post-permissions/add", corsMiddleware(Auth.RequireAuth(handlers.AddPostPermissionHandler)))
	http.HandleFunc("/post-permissions/remove", corsMiddleware(Auth.RequireAuth(handlers.RemovePostPermissionHandler)))
	http.HandleFunc("/post-permissions/get", corsMiddleware(Auth.RequireAuth(handlers.GetPostPermissionsHandler)))
	http.HandleFunc("/post-permissions/update", corsMiddleware(Auth.RequireAuth(handlers.UpdatePostPermissionsHandler)))
	http.HandleFunc("/post-permissions/users", corsMiddleware(Auth.RequireAuth(handlers.GetUsersForPrivatePostHandler)))
	http.HandleFunc("/post-permissions/check-access", corsMiddleware(Auth.RequireAuth(handlers.CheckPostAccessHandler)))

	http.HandleFunc("/comments", corsMiddleware(handlers.GetCommentsHandler))
	http.HandleFunc("/comments/add", corsMiddleware(Auth.RequireAuth(handlers.InsertCommentHandler)))

	http.HandleFunc("/getUsersHandler", corsMiddleware(handlers.GetAllNicknamesHandler))
	http.HandleFunc("/profile", corsMiddleware(handlers.UserProfileHandler))
	http.HandleFunc("/user/", corsMiddleware(handlers.PublicProfileHandler))
	http.HandleFunc("/upload-avatar", corsMiddleware(handlers.UploadProfilePicture))
	http.HandleFunc("/upload-avatar-registration", corsMiddleware(handlers.UploadProfilePictureForRegistration))
	http.HandleFunc("/uploads/", corsMiddleware(handlers.ServeImage))
	http.HandleFunc("/upload-post-image", corsMiddleware(handlers.UploadPostImage))
	http.HandleFunc("/uploads/posts/", corsMiddleware(handlers.ServePostImage))
	http.HandleFunc("/upload-comment-image", corsMiddleware(handlers.UploadCommentImage))
	http.HandleFunc("/uploads/comments/", corsMiddleware(handlers.ServeCommentImage))

	http.HandleFunc("/update-profile", corsMiddleware(handlers.UpdateUserProfileHandler))
	http.HandleFunc("/profile/update", corsMiddleware(handlers.UpdateUserProfileHandler))

	http.HandleFunc("/follow", corsMiddleware(followers.FollowHandler))
	http.HandleFunc("/unfollow", corsMiddleware(followers.UnfollowHandler))
	http.HandleFunc("/accept", corsMiddleware(followers.AcceptFollowHandler))
	http.HandleFunc("/decline", corsMiddleware(followers.DeclineFollowHandler))
	http.HandleFunc("/requests", corsMiddleware(handlers.GetAllRequestsHandler))
	http.HandleFunc("/follow-status", corsMiddleware(followers.FollowStatusHandler))
	http.HandleFunc("/followers/", corsMiddleware(handlers.GetFollowersHandler))
	http.HandleFunc("/following/", corsMiddleware(handlers.GetFollowingHandler))
	http.HandleFunc("/followers/me", corsMiddleware(handlers.GetMyFollowersHandler))

	http.HandleFunc("/all-nicknames", corsMiddleware(handlers.GetAllNicknamesHandler))
	http.HandleFunc("/messages", corsMiddleware(handlers.GetMessagesHandler))
	http.HandleFunc("/messages/store", corsMiddleware(handlers.StoreMessageHandler))
	http.HandleFunc("/messages/unread/count", corsMiddleware(handlers.GetUnreadMessageCountHandler))
	http.HandleFunc("/messages/unread/by-sender", corsMiddleware(handlers.GetUnreadMessageCountBySenderHandler))
	http.HandleFunc("/messages/mark-read", corsMiddleware(handlers.MarkMessagesAsReadHandler))

	http.HandleFunc("/creategroup", corsMiddleware(Auth.RequireAuth(handlers.CreateGroupHandler)))
	http.HandleFunc("/groups", corsMiddleware(Auth.RequireAuth(handlers.GetGroupsHandler)))
	http.HandleFunc("/group-members", corsMiddleware(Auth.RequireAuth(handlers.GetGroupMembersHandler)))
	http.HandleFunc("/group-messages", corsMiddleware(Auth.RequireAuth(handlers.GetGroupMessagesHandler)))
	http.HandleFunc("/upload-group-post-image", corsMiddleware(Auth.RequireAuth(handlers.UploadGroupPostImageHandler)))

	// Group Notifications
	http.HandleFunc("/group-notifications", corsMiddleware(Auth.RequireAuth(handlers.GetGroupNotificationsHandler)))
	http.HandleFunc("/mark-group-read", corsMiddleware(Auth.RequireAuth(handlers.MarkGroupAsReadHandler)))
	http.HandleFunc("/event-notifications", corsMiddleware(Auth.RequireAuth(handlers.GetEventNotificationsHandler)))
	http.HandleFunc("/mark-event-read", corsMiddleware(Auth.RequireAuth(handlers.MarkEventAsReadHandler)))

	http.HandleFunc("/group-events", corsMiddleware(Auth.RequireAuth(handlers.GetGroupEventsHandler)))
	http.HandleFunc("/create-group-event", corsMiddleware(Auth.RequireAuth(handlers.CreateGroupEventHandler)))
	http.HandleFunc("/respond-to-event", corsMiddleware(Auth.RequireAuth(handlers.RespondToEventHandler)))
	http.HandleFunc("/all-group-events", corsMiddleware(Auth.RequireAuth(handlers.GetAllGroupEventsHandler)))

	http.HandleFunc("/group-posts", corsMiddleware(Auth.RequireAuth(handlers.GetGroupPostsHandler)))
	http.HandleFunc("/create-group-post", corsMiddleware(Auth.RequireAuth(handlers.CreateGroupPostHandler)))
	http.HandleFunc("/like-group-post", corsMiddleware(Auth.RequireAuth(handlers.LikeGroupPostHandler)))
	http.HandleFunc("/delete-group-post/", corsMiddleware(Auth.RequireAuth(handlers.DeleteGroupPostHandler)))
	http.HandleFunc("/uploads/group_posts/", corsMiddleware(handlers.ServeGroupPostImages))

	http.HandleFunc("/group-post-comments", corsMiddleware(Auth.RequireAuth(handlers.GetGroupPostCommentsHandler)))
	http.HandleFunc("/add-group-post-comment", corsMiddleware(Auth.RequireAuth(handlers.AddGroupPostCommentHandler)))
	http.HandleFunc("/delete-group-post-comment/", corsMiddleware(Auth.RequireAuth(handlers.DeleteGroupPostCommentHandler)))

	http.HandleFunc("/request-join-group", corsMiddleware(Auth.RequireAuth(handlers.RequestJoinGroupHandler)))
	http.HandleFunc("/approve-group-request", corsMiddleware(Auth.RequireAuth(handlers.ApproveGroupRequestHandler)))
	http.HandleFunc("/reject-group-request", corsMiddleware(Auth.RequireAuth(handlers.RejectGroupRequestHandler)))
	http.HandleFunc("/group-join-requests", corsMiddleware(Auth.RequireAuth(handlers.ListGroupJoinRequestsHandler)))

	http.HandleFunc("/group-invite-requests", corsMiddleware(Auth.RequireAuth(handlers.GroupInviteRequestsHandler)))
	http.HandleFunc("/accept-group-invite", corsMiddleware(Auth.RequireAuth(handlers.AcceptGroupInviteHandler)))
	http.HandleFunc("/reject-group-invite", corsMiddleware(Auth.RequireAuth(handlers.RejectGroupInviteHandler)))

	http.HandleFunc("/chat/history", corsMiddleware(handlers.ChatHistoryHandler))
	http.HandleFunc("/chat/recent-users", corsMiddleware(handlers.ChatRecentUsersHandler))
	http.HandleFunc("/chat/can-access", corsMiddleware(handlers.CanAccessChatHandler))

	// Notification endpoints
	http.HandleFunc("/notifications", corsMiddleware(Auth.RequireAuth(handlers.GetNotificationsHandler)))
	http.HandleFunc("/notifications/mark-read", corsMiddleware(Auth.RequireAuth(handlers.MarkNotificationsAsReadHandler)))
	http.HandleFunc("/notifications/", corsMiddleware(Auth.RequireAuth(handlers.DeleteNotificationHandler)))

	fmt.Println("Starting server on http://localhost:8080")
	fmt.Println("✅ Unified WebSocket system ready!")
	fmt.Println("✅ Group membership system ready!")
	fmt.Println("✅ Group posts system ready!")
	fmt.Println("✅ Group invite system ready!")
	fmt.Println("📊 Database tables created automatically")

	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("Server failed to start: ", err)
	}
}

func corsMiddleware(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Expose-Headers", "Set-Cookie")
		w.Header().Set("Vary", "Origin")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		handler.ServeHTTP(w, r)
	}
}
