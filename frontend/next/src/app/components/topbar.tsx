"use client";

import { useState, useEffect } from "react";
import { Home, User, MessageCircle, Users, Bell, Plus, Search, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import LogoutButton from "./logout";
import { useWebSocket } from "../context/WebSocketContext";
import { useAuth } from "../context/auth";

import { useGroupNotifications } from "../context/GroupNotificationsContext";
import { useEventNotifications } from "../context/EventNotificationsContext";

const Topbar = () => {
  const { pendingRequestsCount, isConnected, lastMessage } = useWebSocket();
  const pathname = usePathname();
  const { user } = useAuth();
  const { totalUnread: groupTotalUnread } = useGroupNotifications();
  const { totalUnread: eventTotalUnread } = useEventNotifications();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Fetch unread message count
  const fetchUnreadMessageCount = async () => {
    if (!user?.nickname) return;
    
    try {
      const response = await fetch(`http://localhost:8080/messages/unread/count?user=${user.nickname}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadMessageCount(data.unread || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread message count:', error);
    }
  };

  // Fetch unread count when user changes
  useEffect(() => {
    if (user?.nickname) {
      fetchUnreadMessageCount();
    }
  }, [user?.nickname]);

  // Update unread count when receiving new messages via WebSocket
  useEffect(() => {
    if (lastMessage && user?.nickname) {
      // Check if the message is for the current user
      if (lastMessage.to === user.nickname) {
        // Increment the count immediately for better UX
        setUnreadMessageCount(prev => prev + 1);
      }
    }
  }, [lastMessage, user?.nickname]);

  // Reset unread count when user is on messages page
  useEffect(() => {
    if (pathname === '/messages') {
      setUnreadMessageCount(0);
    }
  }, [pathname]);

  const navItems = [
    { href: "/ShowPosts", label: "Home", icon: <Home size={20} /> },
    { href: "/profile", label: "Profile", icon: <User size={20} /> },
    { 
      href: "/messages", 
      label: "Messages", 
      icon: <MessageCircle size={20} />,
      badge: unreadMessageCount
    },
    { 
      href: "/groups", 
      label: "Groups", 
      icon: <Users size={20} />,
      badge: groupTotalUnread + eventTotalUnread
    },
    { 
      href: "/requests", 
      label: "Requests", 
      icon: <Bell size={20} />,
      badge: pendingRequestsCount
    },
  ];

  const Badge = ({ count, color = "red" }: { count: number; color?: "red" | "blue" }) => {
    if (count === 0) return null;
    const bgColor = color === "blue" ? "bg-blue-500" : "bg-red-500";
    return (
      <span className={`absolute -top-1 -right-1 ${bgColor} text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium`}>
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  return (
    <>
      {/* Main Topbar */}
      <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            
            {/* Left section - Logo & Brand */}
            <div className="flex items-center gap-6">
              <Link href="/ShowPosts" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-sky-600 to-sky-500 rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-sky-600 to-sky-500 bg-clip-text text-transparent">
                  SocialHub
                </span>
              </Link>
              
              {/* Connection Status - Desktop Only */}
              {/* <div className="hidden md:flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                <span className={`font-medium ${isConnected ? "text-green-600" : "text-red-600"}`}>
                  {isConnected ? "Online" : "Offline"}
                </span>
              </div> */}
            </div>

            {/* Center section - Navigation (Desktop) */}
            <nav className="hidden lg:flex items-center gap-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <button
                      className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                        isActive
                          ? "bg-sky-50 text-sky-600 shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <span className="relative">
                        {item.icon}
                        <Badge 
                          count={item.badge || 0} 
                          color="blue"
                        />
                      </span>
                      <span className="hidden xl:block">{item.label}</span>
                    </button>
                  </Link>
                );
              })}
              
              {/* Create Post Button */}
              <Link href="/create-post">
                <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-sky-500 text-white rounded-xl hover:from-sky-700 hover:to-sky-600 transition-all shadow-sm font-medium ml-2">
                  <Plus size={18} />
                  <span className="hidden xl:block">Create</span>
                </button>
              </Link>
            </nav>

            {/* Right section - User & Actions */}
            <div className="flex items-center gap-4">
              
              {/* Search Button - Mobile */}
              <button className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <Search size={20} />
              </button>
              

              
              {/* User Profile */}
              <div className="hidden sm:flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 overflow-hidden">
                  {user?.profilePicture ? (
                    <img
                      src={`http://localhost:8080${user.profilePicture}`}
                      alt={user.nickname || "User"}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <User size={18} className="text-gray-400" />
                  )}
                </div>
                <div className="hidden md:block">
                  <p className="font-medium text-gray-900">
                    {user?.nickname ? user.nickname : (user ? "User" : "Loading...")}
                  </p>
                  {/* <p className="text-xs text-gray-500">Welcome back!</p> */}
                </div>
              </div>
              
              {/* Logout Button - Desktop */}
              <div className="hidden sm:block">
                <LogoutButton />
              </div>
              
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="container mx-auto px-4 py-4">
              <nav className="space-y-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                          isActive
                            ? "bg-blue-50 text-blue-600"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <span className="relative">
                          {item.icon}
                          <Badge 
                            count={item.badge || 0} 
                            color="blue"
                          />
                        </span>
                        <span>{item.label}</span>
                      </button>
                    </Link>
                  );
                })}
                
                {/* Mobile Create Post */}
                <Link href="/posts">
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-sky-600 to-sky-500 text-white rounded-xl font-medium"
                  >
                    <Plus size={20} />
                    <span>Create Post</span>
                  </button>
                </Link>
              </nav>
              
              {/* Mobile User Section */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100 overflow-hidden">
                    {user?.profilePicture ? (
                      <img
                        src={`http://localhost:8080${user.profilePicture}`}
                        alt={user.nickname || "User"}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <User size={20} className="text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {user?.nickname ? user.nickname : (user ? "User" : "Loading...")}
                    </p>
                    {/* <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                      <span className={isConnected ? "text-green-600" : "text-red-600"}>
                        {isConnected ? "Online" : "Offline"}
                      </span>
                    </div> */}
                  </div>
                </div>
                <LogoutButton />
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
};

export default Topbar;
