'use client';

import { useState, useEffect, useMemo, ChangeEvent, useCallback } from 'react';
import debounce from 'lodash/debounce';
import Link from "next/link";
import { useAuth } from "../context/auth";
import { useWebSocket } from "../context/WebSocketContext";
import { Search, Users, User, MessageCircle, UserPlus, Loader, Plus } from "lucide-react";

type User = {
  nickname: string;
  profilePicture?: string;
};

export default function Sidebar() {
  const [search, setSearch] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { onUserListUpdate, offUserListUpdate } = useWebSocket();

  const fetchUsers = useCallback(() => {
    console.log("Fetching users...");
    setIsLoading(true);
    setError(null);
    
    fetch('http://localhost:8080/getUsersHandler')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
      })
      .then((data: { users: User[] }) => {
        const userArray = Array.isArray(data?.users) ? data.users : [];
        // Remove current user from the list
        const filteredUsers = user ? userArray.filter(u => u.nickname !== user.nickname) : userArray;
        console.log("Users fetched:", filteredUsers.length, "users");
        setUsers(filteredUsers);
        setFiltered(filteredUsers);
      })
      .catch((err) => {
        console.error("Failed to fetch users:", err);
        setError("Failed to load users");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [user]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Listen for real-time user list updates
  useEffect(() => {
    const handleUserListUpdate = () => {
      console.log("User list update received in sidebar");
      fetchUsers();
    };
    
    onUserListUpdate(handleUserListUpdate);
    return () => offUserListUpdate(handleUserListUpdate);
  }, [fetchUsers]);

  const handleSearch = (value: string) => {
    const result = users.filter((u) =>
      u.nickname.toLowerCase().includes(value.toLowerCase())
    );
    setFiltered(result);
  };

  const debouncedSearch = useMemo(() => debounce(handleSearch, 300), [users]);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    debouncedSearch(value);
  };

  const clearSearch = () => {
    setSearch('');
    setFiltered(users);
  };

  return (
    <aside className="w-80 min-h-0 bg-white border-r border-gray-200 flex flex-col shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-purple-50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-sky-500 to-sky-500 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Community</h2>
          </div>
        </div>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={onChange}
            placeholder="Search members..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm"
          />
          {search && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>
        
        {/* Search Results Count */}
        {search && (
          <p className="text-xs text-gray-500 mt-2">
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'} found
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-gray-600">Loading members...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-red-600 mb-3">{error}</p>
            <button
              onClick={fetchUsers}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {search ? <Search className="w-8 h-8 text-gray-400" /> : <Users className="w-8 h-8 text-gray-400" />}
            </div>
            <p className="text-gray-600 mb-2">
              {search ? 'No members found' : 'No members available'}
            </p>
            <p className="text-sm text-gray-500">
              {search ? 'Try a different search term' : 'Check back later for new members'}
            </p>
          </div>
        ) : (
          <div className="p-4">
            <div className="space-y-2">
              {filtered.map((userObj, index) => (
                <Link key={index} href={`/user/${userObj.nickname}`}>
                  <div className="group flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-all cursor-pointer border border-transparent hover:border-blue-100">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 overflow-hidden flex-shrink-0">
                      {userObj.profilePicture ? (
                        <img
                          src={`http://localhost:8080${userObj.profilePicture}`}
                          alt={userObj.nickname}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                        {userObj.nickname}
                      </p>
                      <p className="text-xs text-gray-500">Click to view profile</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      
    </aside>
  );
}