package notify

// Global variable to store the broadcast function
var BroadcastUserListUpdate func()

// SetBroadcastFunction sets the broadcast function from main package
func SetBroadcastFunction(fn func()) {
	BroadcastUserListUpdate = fn
}

// BroadcastUserListUpdateWrapper calls the broadcast function if it's set
func BroadcastUserListUpdateWrapper() {
	if BroadcastUserListUpdate != nil {
		BroadcastUserListUpdate()
	}
}
