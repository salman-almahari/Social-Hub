"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWebSocket } from "../context/WebSocketContext";
import EmojiPicker from "emoji-picker-react";
import { v4 as uuidv4 } from "uuid";

export function Messages({ targetNickname }: { targetNickname?: string }) {
  const { sendMessage, isConnected, lastMessage } = useWebSocket();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [recentUsers, setRecentUsers] = useState<string[]>([]);
  const contactParam = searchParams.get("to") || targetNickname || "";
  // Find the correct case from recentUsers if possible
  const normalizedContact = recentUsers.find(u => u.toLowerCase() === contactParam.toLowerCase()) || contactParam;
  const [selectedContact, setSelectedContact] = useState<string>(normalizedContact);
  const [messages, setMessages] = useState<
    { message_id: string; from: string; text: string; time: string }[]
  >([]);
  const [unreadBySender, setUnreadBySender] = useState<{ [sender: string]: number }>({});
  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const currentUser = typeof window !== "undefined" ? localStorage.getItem("nickname") : null;

  useEffect(() => {
    if (!currentUser) return;
    fetch(`http://localhost:8080/messages/unread/by-sender?user=${currentUser}`)
      .then(res => res.json())
      .then(data => setUnreadBySender(data || {}))
      .catch(() => setUnreadBySender({}));
  }, [currentUser, lastMessage]);

  // When fetching recent users, always use the backend's case
  useEffect(() => {
    if (!currentUser) return;

    fetch(`http://localhost:8080/chat/recent-users?user=${currentUser}`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error("Failed to fetch recent users:", text);
          return;
        }
        return res.json();
      })
      .then((users) => {
        if (Array.isArray(users)) {
          setRecentUsers(users);
          // If selectedContact is set, update it to the correct case
          if (contactParam) {
            const correctCase = users.find(u => u.toLowerCase() === contactParam.toLowerCase());
            if (correctCase && correctCase !== selectedContact) {
              setSelectedContact(correctCase);
            }
          }
        }
      })
      .catch((err) => {
        console.error("Network error fetching recent users:", err);
      });
  }, [currentUser]);

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (!selectedContact || !currentUser) return;

    // Debug: log the values being sent to the backend
    console.log("Checking access for:", { currentUser, selectedContact });

    // Allow chat if the contact is in recent users (previous interaction)
    if (recentUsers.includes(selectedContact)) {
      setHasAccess(true);
      return;
    }

    fetch(`http://localhost:8080/chat/can-access?user=${currentUser}&target=${selectedContact}`)
      .then((res) => {
        if (!res.ok) throw new Error("Forbidden");
        return res.json();
      })
      .then(() => setHasAccess(true))
      .catch((err) => {
        console.warn("Access denied to chat:", err);
        setHasAccess(false);
      });
  }, [selectedContact, currentUser, recentUsers]);
  

  useEffect(() => {
    if (!selectedContact || !currentUser) return;

    fetch(`http://localhost:8080/chat/history?user1=${currentUser}&user2=${selectedContact}`)
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;

        const formatted = data.map((msg) => ({
          message_id: msg.message_id?.toString() || uuidv4(),
          from: msg.sender === currentUser ? "me" : selectedContact,
          text: msg.message,
          time: new Date(msg.timestamp.replace(/\+03:00$/, "Z")).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));

        const uniqueMessages = Array.from(
          new Map(formatted.map((msg) => [msg.message_id, msg])).values()
        );

        setMessages(uniqueMessages);
      })
      .catch((err) => {
        console.error("Error fetching chat history:", err);
      });
  }, [selectedContact]);

  useEffect(() => {
    if (!lastMessage || !currentUser) return;

    const msg = lastMessage as any;
    if (!msg.from || !msg.message) return;

    const fromUser = msg.from;
    const toUser = msg.to;
    const otherUser = fromUser === currentUser ? toUser : fromUser;
    const id = msg.message_id?.toString() || uuidv4();

    const parsedTime = msg.timestamp
      ? new Date(msg.timestamp.replace(/\+03:00$/, "Z"))
      : null;

    const formattedTime =
      parsedTime && !isNaN(parsedTime.getTime())
        ? parsedTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "Unknown time";

    setRecentUsers((prev) => {
      const filtered = prev.filter((user) => user !== otherUser);
      const updated = [otherUser, ...filtered];
      console.log("Updated recent users after message:", updated);
      return updated;
    });

    if (selectedContact !== otherUser) return;

    setMessages((prevMessages) => {
      const exists = prevMessages.some(
        (m) => m.text === msg.message && m.time === formattedTime
      );
      if (exists) return prevMessages;

      return [
        ...prevMessages,
        {
          message_id: id,
          from: fromUser === currentUser ? "me" : otherUser,
          text: msg.message,
          time: formattedTime,
        },
      ];
    });
  }, [lastMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedContact) return;

    const now = new Date().toISOString();
    const localId = uuidv4();

    setMessages((prev) => [
      ...prev,
      {
        message_id: localId,
        from: "me",
        text: input.trim(),
        time: new Date(now).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    setRecentUsers((prev) => {
      const filtered = prev.filter((user) => user !== selectedContact);
      const updated = [selectedContact, ...filtered];
      console.log("✉️ Sent message — updated recent users:", updated);
      return updated;
    });

    sendMessage(selectedContact, input.trim(), now);
    setInput("");
    setShowEmojiPicker(false);
  };

  const addEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
  };

  const markMessagesAsRead = (user: string) => {
    if (!currentUser || !user) return;
    fetch('http://localhost:8080/messages/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: currentUser, sender: user })
    })
      .then(() => {
        setUnreadBySender(prev => ({
          ...prev,
          [user]: 0
        }));
      })
      .catch((err) => console.error('Failed to mark messages as read:', err));
  };

  // When selecting a user from the sidebar, use the exact case
  const selectUser = (user: string) => {
    setSelectedContact(user);
    setHasAccess(null); 
    router.push(`?to=${user}`);
    markMessagesAsRead(user);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Messages</h1>
          <p className="text-gray-600">Stay connected with your network</p>
        </div>

        <div className="flex gap-6 h-[calc(100vh-200px)]">
          <aside className="w-80 bg-white rounded-2xl shadow-lg p-6 overflow-y-auto">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-6a2 2 0 012-2h8V4l4 4z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900">Recent Chats</h2>
            </div>

            {recentUsers.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-gray-100 rounded-full p-6 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-6a2 2 0 012-2h8V4l4 4z" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">No conversations yet</h3>
                <p className="text-xs text-gray-500">Start chatting to see your conversations here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentUsers.map((user) => (
                  <div
                    key={user}
                    onClick={() => selectUser(user)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all hover:bg-gray-50 ${user === selectedContact ? "bg-blue-50 border-2 border-blue-200" : ""
                      }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold">
                          {user.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className={`font-medium ${user === selectedContact ? "text-blue-700" : "text-gray-900"}`}>
                          {user}
                        </h3>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <section className="flex-1 bg-white rounded-2xl shadow-lg flex flex-col overflow-hidden">
            {selectedContact && hasAccess === true ? (
              <>
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold">
                        {selectedContact.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">{selectedContact}</h3>
                  </div>
                </div>

                <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-gray-50">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="bg-white rounded-full p-6 w-16 h-16 mx-auto mb-4 flex items-center justify-center shadow-sm">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.678-.397c-.5-.217-.95-.567-1.297-1.014A9.009 9.009 0 014 15.875V9.25C4 4.832 7.582 1.25 12 1.25s8 3.582 8 7.75z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-700 mb-2">Start the conversation</h3>
                      <p className="text-gray-500">Send a message to {selectedContact}</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.message_id}
                        className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${msg.from === "me"
                            ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                            : "bg-white text-gray-800 border border-gray-200"
                            }`}
                        >
                          <p className="text-sm leading-relaxed">{msg.text}</p>
                          <div className={`text-xs mt-2 ${msg.from === "me" ? "text-blue-100" : "text-gray-500"}`}>
                            {msg.time}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-6 border-t border-gray-200 bg-white">
                  <form onSubmit={handleSubmit} className="relative">
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker((prev) => !prev)}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-xl">😊</span>
                      </button>

                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Type your message..."
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={!input.trim()}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:from-blue-600 hover:to-purple-700 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span>Send</span>
                      </button>
                    </div>

                    {showEmojiPicker && (
                      <div className="absolute bottom-16 left-4 z-10">
                        <EmojiPicker
                          onEmojiClick={(emojiData) => addEmoji(emojiData.emoji)}
                          height={350}
                        />
                      </div>
                    )}
                  </form>
                </div>
              </>
            ) : selectedContact && hasAccess === false ? (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-sm mx-auto">
                  <div className="bg-white rounded-full p-8 w-24 h-24 mx-auto mb-6 flex items-center justify-center shadow-sm">
                    <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Access Denied</h3>
                  <p className="text-gray-500">You cannot chat with this user.</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <div className="bg-white rounded-full p-8 w-24 h-24 mx-auto mb-6 flex items-center justify-center shadow-sm">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.678-.397c-.5-.217-.95-.567-1.297-1.014A9.009 9.009 0 014 15.875V9.25C4 4.832 7.582 1.25 12 1.25s8 3.582 8 7.75z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Select a conversation</h3>
                  <p className="text-gray-500">Choose a contact from the sidebar to start chatting</p>
                </div>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
