"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './WebSocketContext';

interface EventNotification {
  event_id: number;
  group_id: number;
  group_name: string;
  event_title: string;
  event_time: string;
  unread_count: number;
}

interface EventNotificationsContextType {
  notifications: EventNotification[];
  totalUnread: number;
  markEventAsRead: (eventId: number) => Promise<void>;
  fetchNotifications: () => Promise<void>;
}

const EventNotificationsContext = createContext<EventNotificationsContextType | undefined>(undefined);

export const EventNotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<EventNotification[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const { onNotification, offNotification } = useWebSocket();

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8080/event-notifications', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setTotalUnread(data.total_unread || 0);
      }
    } catch (error) {
      console.error('Failed to fetch event notifications:', error);
    }
  }, []);

  const markEventAsRead = useCallback(async (eventId: number) => {
    try {
      const response = await fetch('http://localhost:8080/mark-event-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_id: eventId }),
        credentials: 'include'
      });

      if (response.ok) {
        // Refresh notifications after marking as read
        await fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to mark event as read:', error);
    }
  }, [fetchNotifications]);

  // Fetch notifications on mount and set up polling
  useEffect(() => {
    fetchNotifications();
    
    // Poll for updates every 10 seconds as fallback
    const interval = setInterval(fetchNotifications, 10000);
    
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Listen for real-time event notification updates
  useEffect(() => {
    const handleEventNotificationUpdate = (notificationData: any) => {
      console.log('Real-time event notification update received:', notificationData);
      if (notificationData.action === 'new_event') {
        fetchNotifications();
      }
    };

    onNotification(handleEventNotificationUpdate);

    return () => {
      offNotification(handleEventNotificationUpdate);
    };
  }, [onNotification, offNotification, fetchNotifications]);

  return (
    <EventNotificationsContext.Provider value={{
      notifications,
      totalUnread,
      markEventAsRead,
      fetchNotifications
    }}>
      {children}
    </EventNotificationsContext.Provider>
  );
};

export const useEventNotifications = (): EventNotificationsContextType => {
  const context = useContext(EventNotificationsContext);
  if (!context) {
    throw new Error('useEventNotifications must be used within EventNotificationsProvider');
  }
  return context;
}; 