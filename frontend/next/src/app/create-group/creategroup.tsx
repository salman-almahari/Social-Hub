"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../components/button';
import { toast } from 'sonner';
import GroupChat from "../groups/GroupChat";

interface Group {
  id: number;
  groupName: string;
  description: string;
  createdAt: string;
  isAdmin: boolean;
  createdByUsername: string;
}

interface GroupMember {
  username: string;
  joinedAt: string;
  isAdmin: boolean;
}

export function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null); // Add form reference

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await fetch("http://localhost:8080/groups", {
        credentials: "include",
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      
      const data: Group[] = await res.json();
      setGroups(data);
      setError("");
    } catch (err) {
      console.error("❌ Error fetching groups:", err);
      setError("Failed to load groups. Please try refreshing.");
    }
  };
    //     fetch('http://localhost:8080/creategroup', {
    //         method: 'POST',
    //         headers: {
    //             'Content-Type': 'application/json',
    //         },
    //         credentials: 'include',
    //         body: JSON.stringify({ groupName, groupDescription }),
    //     })
    //         .then(response => response.json())
    //         .then(data => {
    //             setGroups([...groups, data]);
    //             toast("Group Created Successfully!"); // Success toast
    //             router.push('/groups'); // Navigate to the groups page
    //         })
    //         .catch(error => {
    //             console.error('Error creating group:', error);
    //             toast("Failed to create group!"); // Error toast
    //         });
    // };

  const handleCreateGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const groupName = formData.get("groupName") as string;
    const groupDescription = formData.get("groupDescription") as string;

    try {
      const res = await fetch("http://localhost:8080/creategroup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ groupName, groupDescription }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const newGroup = await res.json();
      setGroups((prev) => [...prev, newGroup]);
      
      // Reset form using ref and show success
      if (formRef.current) {
        formRef.current.reset();
      }
      toast("Group Created Successfully!");
      setError("");
    } catch (err) {
      console.error("❌ Error creating group:", err);
      setError("Failed to create group: " + err);
      toast("Failed to create group!");
    }
  };

  const fetchMembers = async (groupId: number) => {
    try {
      const res = await fetch(`http://localhost:8080/group-members?group_id=${groupId}`, {
        credentials: "include",
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      
      const data: GroupMember[] = await res.json();
      setMembers(data);
    } catch (err) {
      console.error("❌ Error fetching members:", err);
      toast("Failed to fetch members: " + err);
    }
  };

  const handleAddUser = async (groupId: number) => {
    if (!newUsername.trim()) {
      toast("Please enter a username");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:8080/add-user-to-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          groupId: groupId,
          username: newUsername.trim(),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      toast("User added successfully!");
      setNewUsername("");
      fetchMembers(groupId); // Refresh members list
    } catch (err) {
      console.error("❌ Error adding user:", err);
      toast("Failed to add user: " + err);
    } finally {
      setLoading(false);
    }
  };

  const handleManageGroup = (group: Group) => {
    setSelectedGroup(group);
    setShowMembers(true);
    fetchMembers(group.id);
  };

  // Show group chat
  if (selectedGroup && !showMembers) {
    return (
      <div className="p-4">
        <button
          onClick={() => setSelectedGroup(null)}
          className="mb-4 text-sm text-gray-600 hover:underline"
        >
          ← Back to Groups
        </button>
        <GroupChat groupId={selectedGroup.id} groupName={selectedGroup.groupName} />
      </div>
    );
  }

  // Show group management
  if (showMembers && selectedGroup) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <button
          onClick={() => {
            setShowMembers(false);
            setSelectedGroup(null);
          }}
          className="mb-4 text-sm text-gray-600 hover:underline"
        >
          ← Back to Groups
        </button>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Manage Group: {selectedGroup.groupName}
        </h2>

        {selectedGroup.isAdmin && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Add New Member</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter username"
                className="flex-1 border px-4 py-2 rounded-md"
                disabled={loading}
              />
              <Button
                onClick={() => handleAddUser(selectedGroup.id)}
                disabled={loading || !newUsername.trim()}
                className="text-white"
              >
                {loading ? "Adding..." : "Add User"}
              </Button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Group Members</h3>
          <div className="space-y-2">
            {members.map((member, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <span className="font-medium">{member.username}</span>
                  {member.isAdmin && (
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      Admin
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  Joined: {new Date(member.joinedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <Button
            onClick={() => {
              setShowMembers(false);
              // Keep selectedGroup to open chat
            }}
            className="text-white"
          >
            Open Group Chat
          </Button>
        </div>
      </div>
    );
  }

  // Show groups list
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Groups</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form ref={formRef} onSubmit={handleCreateGroup} className="space-y-4 bg-white p-4 rounded-md shadow mb-8">
        <div>
          <label className="block text-sm font-medium mb-1">Group Name</label>
          <input
            type="text"
            name="groupName"
            required
            className="w-full border px-4 py-2 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            name="groupDescription"
            required
            rows={3}
            className="w-full border px-4 py-2 rounded-md"
          />
        </div>
        <Button type="submit" className="w-full text-white">
          Create Group
        </Button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.isArray(groups) && groups.length > 0 ? (
          groups.map((group) => (
            <div key={group.id} className="bg-white rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold text-gray-800">{group.groupName}</h3>
              <p className="text-sm text-gray-600">{group.description}</p>
              <p className="text-sm text-gray-500">
                Created by: {group.createdByUsername || "Unknown"}
              </p>
              <p className="text-sm text-gray-500">
                Created: {new Date(group.createdAt).toLocaleString()}
              </p>
              {group.isAdmin && (
                <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                  Admin
                </span>
              )}
              <div className="mt-4 space-x-2">
                <button
                  onClick={() => setSelectedGroup(group)}
                  className="text-blue-600 hover:underline"
                >
                  Open Chat
                </button>
                {group.isAdmin && (
                  <button
                    onClick={() => handleManageGroup(group)}
                    className="text-green-600 hover:underline"
                  >
                    Manage Group
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 col-span-2">No groups found. Create your first group!</p>
        )}
      </div>
    </div>
  );
}