"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";

interface PostPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: number;
}

interface Follower {
  id: number;
  nickname: string;
  firstName: string;
  lastName: string;
}

export function PostPermissionsModal({ isOpen, onClose, postId }: PostPermissionsModalProps) {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [permittedUsers, setPermittedUsers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchFollowers();
      fetchPermissions();
    }
  }, [isOpen, postId]);

  const fetchFollowers = async () => {
    try {
      const response = await fetch("http://localhost:8080/followers/me", {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setFollowers(data.followers || []);
      }
    } catch (error) {
      console.error("Error fetching followers:", error);
      toast.error("Failed to load followers");
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await fetch(`http://localhost:8080/post-permissions/get?post_id=${postId}`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setPermittedUsers(data.user_ids || []);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    }
  };

  const addPermission = async (userId: number) => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8080/post-permissions/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_id: postId,
          user_id: userId,
        }),
        credentials: "include",
      });

      if (response.ok) {
        setPermittedUsers(prev => [...prev, userId]);
        toast.success("User added to post permissions");
      } else {
        toast.error("Failed to add user to permissions");
      }
    } catch (error) {
      console.error("Error adding permission:", error);
      toast.error("Failed to add user to permissions");
    } finally {
      setLoading(false);
    }
  };

  const removePermission = async (userId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8080/post-permissions/remove?post_id=${postId}&user_id=${userId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        setPermittedUsers(prev => prev.filter(id => id !== userId));
        toast.success("User removed from post permissions");
      } else {
        toast.error("Failed to remove user from permissions");
      }
    } catch (error) {
      console.error("Error removing permission:", error);
      toast.error("Failed to remove user from permissions");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Manage Post Permissions</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-4">
          <h3 className="font-medium mb-2">Your Followers</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {followers.length === 0 ? (
              <p className="text-gray-500 text-sm">No followers yet</p>
            ) : (
              followers.map((follower) => {
                const isPermitted = permittedUsers.includes(follower.id);
                return (
                  <div
                    key={follower.id}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <div>
                      <p className="font-medium">{follower.nickname}</p>
                      <p className="text-sm text-gray-600">
                        {follower.firstName} {follower.lastName}
                      </p>
                    </div>
                    <button
                      onClick={() => isPermitted ? removePermission(follower.id) : addPermission(follower.id)}
                      disabled={loading}
                      className={`px-3 py-1 rounded text-sm ${
                        isPermitted
                          ? "bg-red-500 hover:bg-red-600 text-white"
                          : "bg-green-500 hover:bg-green-600 text-white"
                      } disabled:opacity-50`}
                    >
                      {isPermitted ? "Remove" : "Add"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <p>• Users with "Add" can view this private post</p>
          <p>• Users with "Remove" currently have access</p>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 