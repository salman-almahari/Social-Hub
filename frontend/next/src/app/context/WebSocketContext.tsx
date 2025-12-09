"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./auth";

let socket: WebSocket | null = null;

const ConnectWebsocket = (setLastMessage: React.Dispatch<React.SetStateAction<{ from: string; to: string; text: string; time: string; } | null>>, setIsConnected: (connected: boolean) => void, isLoggedIn: boolean) => {
  if (socket && socket.readyState === WebSocket.OPEN) return;

  console.log("Attempting to connect to WebSocket at ws://localhost:8080/ws");
  socket = new WebSocket("ws://localhost:8080/ws");

  socket.onopen = () => {
    console.log("✅ WebSocket connected successfully");
    setIsConnected(true);
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Message received:", message);
      if (message?.type === "chat") {
        setLastMessage(message.data);
      }
    } catch (err) {
      console.error("WebSocket parse error:", err);
    }
  };

  socket.onclose = () => {
    console.log("WebSocket disconnected");
    setIsConnected(false);
    socket = null;
    
    // Attempt to reconnect after 3 seconds
    setTimeout(() => {
      if (isLoggedIn) {
        console.log("Attempting to reconnect WebSocket...");
        ConnectWebsocket(setLastMessage, setIsConnected, isLoggedIn);
      }
    }, 3000);
  };

  socket.onerror = (err) => {
    // Only log the error if it's not a normal connection issue
    if (err && typeof err === 'object' && Object.keys(err).length > 0) {
      console.log("WebSocket connection error:", err);
    } else {
      console.log("WebSocket connection attempt failed - this is normal during development");
    }
    setIsConnected(false);
  };
};

const getSocket = () => socket;

const sendMessage = (to: string, message: string, time: string) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const payload = {
      type: "chat",
      data: {
        to: to,
        message: message,
        time: time, // ✅ Add this line
      },
    };
    socket.send(JSON.stringify(payload));
    console.log("Message sent:", payload);
  } else {
    console.warn("WebSocket not open.");
  }
};

const sendGroupMessage = (groupId: number, content: string) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const payload = {
      type: "group_chat",
      data: {
        groupId: groupId,
        content: content,
      },
    };
    socket.send(JSON.stringify(payload));
    console.log("Group message sent:", payload);
  } else {
    console.warn("WebSocket not open.");
  }
};

const subscribeToGroup = (groupId: number) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const payload = {
      type: "group_subscribe",
      data: {
        groupId: groupId,
      },
    };
    socket.send(JSON.stringify(payload));
    console.log("Subscribed to group:", groupId);
  } else {
    console.warn("WebSocket not open.");
  }
};

const unsubscribeFromGroup = (groupId: number) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const payload = {
      type: "group_unsubscribe",
      data: {
        groupId: groupId,
      },
    };
    socket.send(JSON.stringify(payload));
    console.log("Unsubscribed from group:", groupId);
  } else {
    console.warn("WebSocket not open.");
  }
};


interface WebSocketContextType {
  sendMessage: (to: string, text: string, time: string) => void;
  sendGroupMessage: (groupId: number, content: string) => void;
  subscribeToGroup: (groupId: number) => void;
  unsubscribeFromGroup: (groupId: number) => void;
  isConnected: boolean;
  lastMessage: { from: string; to: string; text: string; time: string } | null;
  onUserListUpdate: (callback: () => void) => void;
  offUserListUpdate: (callback: () => void) => void;
  pendingRequestsCount: number;
  onPendingRequestsUpdate: (callback: () => void) => void;
  offPendingRequestsUpdate: (callback: () => void) => void;
  refreshPendingRequestsCount: () => void;
  onNotification: (callback: (notification: any) => void) => void;
  offNotification: (callback: (notification: any) => void) => void;
  onGroupMessage: (callback: (message: any) => void) => void;
  offGroupMessage: (callback: (message: any) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketContextType["lastMessage"]>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const { isLoggedIn, user } = useAuth();
  const [userListUpdateCallbacks, setUserListUpdateCallbacks] = useState<(() => void)[]>([]);
  const [pendingRequestsUpdateCallbacks, setPendingRequestsUpdateCallbacks] = useState<(() => void)[]>([]);
  const [notificationCallbacks, setNotificationCallbacks] = useState<((notification: any) => void)[]>([]);
  const [groupMessageCallbacks, setGroupMessageCallbacks] = useState<((message: any) => void)[]>([]);

  const onUserListUpdate = useCallback((callback: () => void) => {
    setUserListUpdateCallbacks(prev => [...prev, callback]);
  }, []);

  const offUserListUpdate = useCallback((callback: () => void) => {
    setUserListUpdateCallbacks(prev => prev.filter(cb => cb !== callback));
  }, []);

  const onPendingRequestsUpdate = useCallback((callback: () => void) => {
    setPendingRequestsUpdateCallbacks(prev => [...prev, callback]);
  }, []);

  const offPendingRequestsUpdate = useCallback((callback: () => void) => {
    setPendingRequestsUpdateCallbacks(prev => prev.filter(cb => cb !== callback));
  }, []);

  const onNotification = useCallback((callback: (notification: any) => void) => {
    setNotificationCallbacks(prev => [...prev, callback]);
  }, []);

  const offNotification = useCallback((callback: (notification: any) => void) => {
    setNotificationCallbacks(prev => prev.filter(cb => cb !== callback));
  }, []);

  const onGroupMessage = useCallback((callback: (message: any) => void) => {
    setGroupMessageCallbacks(prev => [...prev, callback]);
  }, []);

  const offGroupMessage = useCallback((callback: (message: any) => void) => {
    setGroupMessageCallbacks(prev => prev.filter(cb => cb !== callback));
  }, []);

  // Function to fetch pending requests count
  const fetchPendingRequestsCount = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8080/requests', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const pendingCount = data.total_count || 0;
        setPendingRequestsCount(pendingCount);
        pendingRequestsUpdateCallbacks.forEach(callback => callback());
      }
    } catch (error) {
      console.error('Failed to fetch pending requests count:', error);
    }
  }, [pendingRequestsUpdateCallbacks]);

  useEffect(() => {
    if (isLoggedIn && !getSocket()) {
      // Small delay to avoid race conditions during development
      const timer = setTimeout(() => {
        ConnectWebsocket(setLastMessage, setIsConnected, isLoggedIn);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn]);

  // Separate effect for subscription to avoid timing issues
  useEffect(() => {
    if (isConnected && user?.nickname) {
      const sock = getSocket();
      if (sock && sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({
          type: "subscribe",
          nickname: user.nickname
        }));
        console.log("Subscribed to WebSocket as:", user.nickname);
      }
    }
  }, [isConnected, user?.nickname]);

  // Fetch pending requests count when user is logged in
  useEffect(() => {
    if (isLoggedIn) {
      fetchPendingRequestsCount();
    }
  }, [isLoggedIn, fetchPendingRequestsCount]);

  // Listen for user_list_update events
  useEffect(() => {
    const sock = getSocket();
    if (sock) {
      const handleMessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          console.log("WebSocket message received:", message);
          if (message?.type === "user_list_update") {
            console.log("User list update received, calling callbacks");
            userListUpdateCallbacks.forEach(callback => callback());
          } else if (message?.type === "follow_status_update") {
            console.log("Follow status update received, refreshing pending requests count");
            fetchPendingRequestsCount();
            // Also trigger user list update for sidebar and profile updates
            userListUpdateCallbacks.forEach(callback => callback());
          } else if (message?.type === "group_join_request" || message?.type === "group_invite") {
            console.log("Group request received, refreshing pending requests count");
            fetchPendingRequestsCount();
          } else if (message?.type === "notification") {
            console.log("Notification received:", message.data);
            notificationCallbacks.forEach(callback => callback(message.data));
          } else if (message?.type === "notification_update") {
            console.log("Notification update received:", message.data);
            // Trigger notification refresh for real-time updates
            notificationCallbacks.forEach(callback => callback(message.data));
          } else if (message?.type === "event_notification_update") {
            console.log("Event notification update received:", message.data);
            // Trigger notification refresh for real-time event updates
            notificationCallbacks.forEach(callback => callback(message.data));
          } else if (message?.type === "group_chat") {
            console.log("Group chat message received:", message.data);
            groupMessageCallbacks.forEach(callback => callback(message.data));
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      sock.addEventListener('message', handleMessage);
      return () => sock.removeEventListener('message', handleMessage);
    }
  }, [userListUpdateCallbacks, fetchPendingRequestsCount, notificationCallbacks, groupMessageCallbacks]);

  return (
    <WebSocketContext.Provider value={{ 
      sendMessage, 
      sendGroupMessage,
      subscribeToGroup,
      unsubscribeFromGroup,
      isConnected, 
      lastMessage, 
      onUserListUpdate, 
      offUserListUpdate,
      pendingRequestsCount,
      onPendingRequestsUpdate,
      offPendingRequestsUpdate,
      refreshPendingRequestsCount: fetchPendingRequestsCount,
      onNotification,
      offNotification,
      onGroupMessage,
      offGroupMessage
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return context;
};
