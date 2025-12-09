"use client";

import { AuthProvider, useAuth } from "./context/auth";
import Sidebar from "./components/Sidebar"; 
import LogoutButton from "./components/logout";
import { useEffect, useState } from "react";
// import { ConnectWebsocket, getSocket } from "./websocket";
import { Toaster } from "sonner";
import "./globals.css";
import Topbar from "./components/topbar";
import { WebSocketProvider } from "./context/WebSocketContext";
import { NotificationProvider } from "./context/NotificationContext";
import { GroupNotificationsProvider } from "./context/GroupNotificationsContext";
import { EventNotificationsProvider } from "./context/EventNotificationsContext";
import ErrorBoundary from "./components/ErrorBoundary";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <ErrorBoundary>
          <AuthProvider>
            <WebSocketProvider>
              <NotificationProvider>
                <GroupNotificationsProvider>
                  <EventNotificationsProvider>
                    <AppLayout>{children}</AppLayout>
                  </EventNotificationsProvider>
                </GroupNotificationsProvider>
              </NotificationProvider>
            </WebSocketProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, setIsLoggedIn, authError, isLoading } = useAuth();
  const [isClient, setIsClient] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);   
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isClient || isLoading) {
    return null;
  }
  

  const pathname = typeof window !== 'undefined' ? window.location.pathname : "";

  if (!isLoggedIn) {
    if (pathname !== "/login" && pathname !== "/register") {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return null;
    }

    if (pathname === "/login" || pathname === "/register") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
          <main className="flex items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md">
              {children}
            </div>
          </main>
          <Toaster 
            position="top-right" 
            toastOptions={{
              style: {
                background: 'white',
                color: 'black',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
              },
            }}
          />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50">
      {authError && !isLoading && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white p-2 text-center">
          <span className="text-sm">
            ⚠️ Connection issue: {authError}. 
            <button 
              onClick={() => window.location.reload()} 
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </span>
        </div>
      )}
      
      <Topbar />
      
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <div className="flex pt-16">
        <div className={`
          fixed top-16 left-0 h-[calc(100vh-4rem)] bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <Sidebar />
        </div>
        
        <main className="flex-1 ml-0 lg:ml-80 transition-all duration-300 ease-in-out">
          <div className="min-h-[calc(100vh-4rem)]">
            {children}
          </div>
        </main>
      </div>
      
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: 'white',
            color: 'black',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          },
          classNames: {
            success: 'border border-green-500 bg-green-50',
            error: 'border border-red-500 bg-red-50',
          }
        }}
      />
    </div>
  );
}