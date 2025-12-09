"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./auth";
import { useWebSocket } from "./WebSocketContext";

interface Notification {
  id: number;
  user_id: number;
  type: string;
  message: string;
  is_read: number;
  related_id?: number;
  created_at: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationIds: number[]) => Promise<void>;
  deleteNotification: (notificationId: number) => Promise<void>;
  addNotification: (notification: Notification) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();
  const websocket = useWebSocket();
  
  // Safety checks for context values
  const isLoggedIn = auth?.isLoggedIn || false;
  const isConnected = websocket?.isConnected || false;

  const unreadCount = notifications?.filter(n => n.is_read === 0).length || 0;

  const fetchNotifications = useCallback(async () => {
    if (!isLoggedIn) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8080/notifications', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(Array.isArray(data) ? data : []);
      } else {
        setError('Failed to fetch notifications');
      }
    } catch (err) {
      setError('Network error while fetching notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  const markAsRead = useCallback(async (notificationIds: number[]) => {
    if (!isLoggedIn || notificationIds.length === 0) return;

    try {
      const response = await fetch('http://localhost:8080/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ notification_ids: notificationIds }),
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev => 
          (prev || []).map(notification => 
            notificationIds.includes(notification.id) 
              ? { ...notification, is_read: 1 }
              : notification
          )
        );
      } else {
        setError('Failed to mark notifications as read');
      }
    } catch (err) {
      setError('Network error while marking notifications as read');
      console.error('Error marking notifications as read:', err);
    }
  }, [isLoggedIn]);

  const deleteNotification = useCallback(async (notificationId: number) => {
    if (!isLoggedIn) return;

    try {
      const response = await fetch(`http://localhost:8080/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        // Remove from local state
        setNotifications(prev => (prev || []).filter(n => n.id !== notificationId));
      } else {
        setError('Failed to delete notification');
      }
    } catch (err) {
      setError('Network error while deleting notification');
      console.error('Error deleting notification:', err);
    }
  }, [isLoggedIn]);

  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...(prev || [])]);
  }, []);

  // Memoize the WebSocket notification handler
  const handleNotification = useCallback((notification: any) => {
    addNotification(notification);
  }, [addNotification]);

  // Fetch notifications when user logs in
  useEffect(() => {
    if (isLoggedIn) {
      fetchNotifications();
    } else {
      setNotifications([]);
    }
  }, [isLoggedIn, fetchNotifications]);

  // Listen for WebSocket notification events
  useEffect(() => {
    if (!isConnected) return;

    websocket.onNotification(handleNotification);

    return () => {
      websocket.offNotification(handleNotification);
    };
  }, [isConnected, handleNotification]);

  // Ensure we have valid context values
  const contextValue: NotificationContextType = {
    notifications: notifications || [],
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    deleteNotification,
    addNotification,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}; 