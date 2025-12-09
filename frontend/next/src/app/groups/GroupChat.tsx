"use client";

import { useEffect, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import { useGroupNotifications } from "../context/GroupNotificationsContext";
import { useWebSocket } from "../context/WebSocketContext";

interface Message {
  sender: string;
  content: string;
  timestamp: string;
}

interface Props {
  groupId: number;
  groupName: string;
}

export default function GroupChat({ groupId, groupName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { markGroupAsRead } = useGroupNotifications();
  const { sendGroupMessage, onGroupMessage, offGroupMessage, subscribeToGroup, unsubscribeFromGroup } = useWebSocket();

  useEffect(() => {
    fetch(`http://localhost:8080/group-messages?group_id=${groupId}`, {
      credentials: "include",
    })
      .then((res) => {
        if (res.status === 204) {
          const welcomeMessage: Message = {
            sender: "System",
            content: "Welcome to the group chat! Start the conversation.",
            timestamp: new Date().toISOString(),
          };
          setMessages([welcomeMessage]);
          return [];
        } else if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data: Message[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setMessages(data);
        }
      })
      .catch((err) => {
        console.error("Error loading messages:", err);
        setConnectionStatus("Failed to load messages");
        setMessages([]);
      });
  }, [groupId]);

  // Subscribe to group and listen for messages
  useEffect(() => {
    const handleGroupMessage = (messageData: any) => {
      if (messageData.groupId === groupId) {
        const msg: Message = {
          sender: messageData.sender,
          content: messageData.content,
          timestamp: messageData.timestamp
        };
        setMessages((prev) => [...prev, msg]);
      }
    };

    // Subscribe to the group
    subscribeToGroup(groupId);
    
    // Listen for group messages
    onGroupMessage(handleGroupMessage);

    return () => {
      // Unsubscribe from the group
      unsubscribeFromGroup(groupId);
      // Remove message listener
      offGroupMessage(handleGroupMessage);
    };
  }, [groupId, onGroupMessage, offGroupMessage, subscribeToGroup, unsubscribeFromGroup]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Mark group as read when component mounts
    markGroupAsRead(groupId);
  }, [groupId, markGroupAsRead]);

  const handleSend = () => {
    if (newMessage.trim() === "") return;

    try {
      sendGroupMessage(groupId, newMessage);
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Failed to send message");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "Connected": return "bg-green-500";
      case "Connecting...": return "bg-yellow-500 animate-pulse";
      default: return "bg-red-500";
    }
  };

  // const getStatusIcon = () => {
  //   switch (connectionStatus) {
  //     case "Connected": return "✓";
  //     case "Connecting...": return "⟳";
  //     default: return "⚠";
  //   }
  // };

  return (
    <div className="max-h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-full">
        
        <div className="bg-white rounded-3xl shadow-xl mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-600 px-8 py-6">
            <div className="flex items-center justify-between text-white">
              <div>
                <h1 className="text-2xl font-bold">{groupName}</h1>
                <p className="text-green-100 opacity-90">Group Chat</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  {/* <span className="text-lg">{getStatusIcon()}</span> */}
                  {/* <span className="text-sm font-medium">{connectionStatus}</span> */}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="h-[600px] overflow-y-auto p-6 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="bg-gray-200 rounded-full p-6 mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.678-.397c-.5-.217-.95-.567-1.297-1.014A9.009 9.009 0 014 15.875V9.25C4 4.832 7.582 1.25 12 1.25s8 3.582 8 7.75z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No messages yet</h3>
                <p className="text-gray-500">Be the first to start the conversation!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.sender === "System" ? "justify-center" : ""}`}>
                    {msg.sender === "System" ? (
                      <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl shadow-sm p-4 max-w-lg hover:shadow-md transition-shadow">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-8 h-8 bg-gradient-to-r from-sky-500 to-sky-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              {msg.sender.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-semibold text-gray-800">{msg.sender}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(msg.timestamp).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>
                        <p className="text-gray-700 leading-relaxed">{msg.content}</p>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
          
    
            <div className="flex space-x-4">
              <div className="flex-1 relative">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full h-16 p-4 border rounded-3xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Type your message..."
                />
              </div>

              <div 
                className="flex items-center cursor-pointer text-2xl text-gray-600 hover:text-blue-500 transition-colors"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
              >
                <span role="img" aria-label="emoji">😊</span>
              </div>
              {showEmojiPicker && (
                <div className="fixed bottom-14 right-4 ">
                  <EmojiPicker className="rounded-lg shadow-lg"
                    onEmojiClick={(emojiData) => setNewMessage((prev) => prev + emojiData.emoji)}
                    height={350}
                  />
                </div>
              )}

              <button
                onClick={handleSend}
                disabled={ newMessage.trim() === ""}
                className="px-6 py-3 bg-gradient-to-r from-sky-600 to-sky-600 text-white rounded-3xl hover:from-sky-700 hover:to-sky-700 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed font-medium flex items-center space-x-2 disabled:px-2"
              >
                <span>Send</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    // </div>
  );
}