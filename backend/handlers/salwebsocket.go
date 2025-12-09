package handlers

import (
	"fmt"
	"net/http"
	// "social-network/database"

	// "github.com/gorilla/websocket"
)

// var upgrader = websocket.Upgrader{
// 	ReadBufferSize:  1024,
// 	WriteBufferSize: 1024,
// 	CheckOrigin:     func(r *http.Request) bool { return true },
// }

// var clients = make(map[string]*websocket.Conn)

func HandleSalWebSocket(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Handling SAL WebSocket connection")

	// userCookie, err := r.Cookie("session_id")
	// if err != nil {
	// 	fmt.Println("Error retrieving session_id:", err)
	// 	http.Error(w, "Missing session", http.StatusUnauthorized)
	// 	return
	// }

	// sessionID := userCookie.Value

	// userID, err := database.GetUserIDBySession(sessionID)
	// if err != nil {
	// 	fmt.Println("Error getting user ID from session:", err)
	// 	http.Error(w, "Invalid session", http.StatusUnauthorized)
	// 	return
	// } 

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println("WebSocket upgrade failed:", err)
		return
	}
	defer conn.Close()

	fmt.Println("WebSocket connection established")
	for {
		// Read message from client
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			fmt.Println("Error reading message:", err)
			break
		}

		fmt.Printf("Received message: %s\n", msg)

		// Echo the message back to the client
		if err := conn.WriteMessage(messageType, msg); err != nil {
			fmt.Println("Error writing message:", err)
			break
		}
	}
	fmt.Println("WebSocket connection closed")
}
