"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWebSocket } from './WebSocketContext';

interface GroupNotification {
  group_id: number;
  group_name: string;
  unread_count: number;
}

interface GroupNotificationsContextType {
  notifications: GroupNotification[];
  totalUnread: number;
  refreshNotifications: () => void;
  markGroupAsRead: (groupId: number) => void;
  forceRefresh: () => void;
}

const GroupNotificationsContext = createContext<GroupNotificationsContextType | undefined>(undefined);

export const useGroupNotifications = () => {
  const context = useContext(GroupNotificationsContext);
  if (context === undefined) {
    throw new Error('useGroupNotifications must be used within a GroupNotificationsProvider');
  }
  return context;
};

interface GroupNotificationsProviderProps {
  children: ReactNode;
}

export const GroupNotificationsProvider: React.FC<GroupNotificationsProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<GroupNotification[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const { onNotification, offNotification } = useWebSocket();

  const fetchNotifications = async () => {
    try {
      const response = await fetch('http://localhost:8080/group-notifications', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setTotalUnread(data.total_unread || 0);
      }
    } catch (error) {
      console.error('Failed to fetch group notifications:', error);
    }
  };

  const markGroupAsRead = async (groupId: number) => {
    try {
      const response = await fetch(`http://localhost:8080/mark-group-read?group_id=${groupId}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        // Refresh notifications after marking as read
        await fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to mark group as read:', error);
    }
  };

  const refreshNotifications = () => {
    fetchNotifications();
  };

  // Force refresh notifications (useful for immediate updates)
  const forceRefresh = () => {
    fetchNotifications();
  };

  useEffect(() => {
    fetchNotifications();

    // Set up polling to refresh notifications every 10 seconds for more responsive updates
    const interval = setInterval(fetchNotifications, 10000);

    return () => clearInterval(interval);
  }, []);

  // Listen for real-time notification updates from WebSocket
  useEffect(() => {
    const handleNotificationUpdate = (notificationData: any) => {
      console.log('Real-time notification update received:', notificationData);
      // Immediately refresh notifications when we receive a WebSocket update
      fetchNotifications();
    };

    onNotification(handleNotificationUpdate);

    return () => {
      offNotification(handleNotificationUpdate);
    };
  }, [onNotification, offNotification]);

  const value: GroupNotificationsContextType = {
    notifications,
    totalUnread,
    refreshNotifications,
    markGroupAsRead,
    forceRefresh,
  };

  return (
    <GroupNotificationsContext.Provider value={value}>
      {children}
    </GroupNotificationsContext.Provider>
  );
}; 