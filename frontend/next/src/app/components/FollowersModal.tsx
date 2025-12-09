"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

interface User {
  id: number;
  nickname: string;
  profilePicture?: string;
}

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "followers" | "following";
  targetNickname: string;
  isPrivate?: boolean;
}

export function FollowersModal({ isOpen, onClose, type, targetNickname, isPrivate = false }: FollowersModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && !isPrivate) {
      fetchUsers();
    }
  }, [isOpen, type, targetNickname, isPrivate]);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    
    try {
      const endpoint = type === "followers" ? "followers" : "following";
      const url = `http://localhost:8080/${endpoint}/${targetNickname}`;
      
      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch ${type}: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(`Failed to load ${type}`);
      console.error(`Error fetching ${type}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (nickname: string) => {
    // Navigate to user profile
    window.location.href = `/user/${nickname}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800 capitalize">
            {type} of {targetNickname}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {isPrivate ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              This profile is private. You cannot view {type}.
            </p>
          </div>
        ) : loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading {type}...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-500">{error}</p>
            <button
              onClick={fetchUsers}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Try Again
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No {type} found.</p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-96">
            {users.map((user) => (
              <div
                key={user.id}
                onClick={() => handleUserClick(user.nickname)}
                className="flex items-center p-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors"
              >
                <img
                  src={user.profilePicture ? `http://localhost:8080${user.profilePicture}` : "https://www.w3schools.com/howto/img_avatar.png"}
                  alt={user.nickname}
                  className="w-10 h-10 rounded-full mr-3"
                />
                <span className="text-gray-800 font-medium">{user.nickname}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 