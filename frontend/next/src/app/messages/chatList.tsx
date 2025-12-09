"use client";

import { useEffect, useState } from "react";
import { useWebSocket } from "../context/WebSocketContext";

type ChatMessage = {
  from: string;
  to: string;
  text: string;
  time: string;
};

export function ChatList({
  currentUser,
  onSelectUser,
}: {
  currentUser: string;
  onSelectUser: (user: string) => void;
}) {
  const { lastMessage } = useWebSocket();
  const [chatUsers, setChatUsers] = useState<string[]>([]);
  const [unreadBySender, setUnreadBySender] = useState<{ [sender: string]: number }>({});

  useEffect(() => {
    if (!currentUser) return;
    fetch(`http://localhost:8080/messages/unread/by-sender?user=${currentUser}`)
      .then(res => res.json())
      .then(data => setUnreadBySender(data || {}))
      .catch(() => setUnreadBySender({}));
  }, [currentUser, lastMessage]);

  useEffect(() => {
    if (!lastMessage) return;

    const message = lastMessage as ChatMessage;
    const { from, to } = message;

    const otherUser = from === currentUser ? to : from;

    setChatUsers((prev) => {
      const updated = prev.filter((user) => user !== otherUser);
      return [otherUser, ...updated];
    });
  }, [lastMessage]);

  // Merge chatUsers with all senders from unreadBySender
  const allChatUsers = Array.from(new Set([...chatUsers, ...Object.keys(unreadBySender)]));

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 h-full">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.678-.397c-.5-.217-.95-.567-1.297-1.014A9.009 9.009 0 014 15.875V9.25C4 4.832 7.582 1.25 12 1.25s8 3.582 8 7.75z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Recent Chats</h2>
          <p className="text-sm text-gray-500">Your conversations</p>
        </div>
      </div>

      {allChatUsers.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full p-6 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-6a2 2 0 012-2h8V4l4 4z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">No chats yet</h3>
          <p className="text-gray-500">Start a conversation to see it here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {allChatUsers.map((user) => (
            <div
              key={user}
              onClick={() => onSelectUser(user)}
              className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">
                    {user.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {user}
                  </h3>
                  <p className="text-sm text-gray-500">Click to open chat</p>
                </div>
              </div>
              
              {unreadBySender[user] > 0 && (
                <div className="bg-blue-500 text-white text-xs font-semibold rounded-full min-w-[24px] h-6 flex items-center justify-center px-2 animate-pulse">
                  {unreadBySender[user] > 99 ? '99+' : unreadBySender[user]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
