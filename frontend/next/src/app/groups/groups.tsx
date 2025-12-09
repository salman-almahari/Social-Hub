"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "../components/button";
import { toast } from 'sonner';
import GroupChat from "./GroupChat";
import GroupEvents from "./GroupEvents";
import GroupPosts from "./GroupPosts";
import { useGroupNotifications } from "../context/GroupNotificationsContext";
import { useEventNotifications } from "../context/EventNotificationsContext";

interface Group {
  id: number;
  groupName: string;
  description: string;
  createdAt: string;
  isAdmin: boolean;
  isMember: boolean; 
  createdByUsername: string;
  upcomingEventsCount?: number;
}

interface GroupMember {
  username: string;
  isAdmin: boolean;
  joinedAt: string;
}

interface GroupInviteRequest {
  id: number;
  groupId: number;
  groupName: string;
  userId: number;
  username: string;
  status: string;
  createdAt: string;
}

interface GroupEvent {
  id: number;
  groupId: number;
  groupName: string;
  title: string;
  description: string;
  eventTime: string;
  createdBy: string;
  goingCount: number;
  notGoingCount: number;
  userResponse?: "going" | "not_going" | null;
}

export function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [showPosts, setShowPosts] = useState(false);
  const [showInvites, setShowInvites] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [groupInvites, setGroupInvites] = useState<GroupInviteRequest[]>([]);
  const [allGroupEvents, setAllGroupEvents] = useState<GroupEvent[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinRequestLoading, setJoinRequestLoading] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const { notifications, markGroupAsRead } = useGroupNotifications();
  const { notifications: eventNotifications, markEventAsRead } = useEventNotifications();

  useEffect(() => {
    fetchGroups();
    fetchGroupInvites();
    fetchAllGroupEvents();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await fetch("http://localhost:8080/groups", {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setGroups(data || []);
      } else {
        setError("Failed to fetch groups");
      }
    } catch (err) {
      setError("Error fetching groups");
    }
  };

  const fetchGroupInvites = async () => {
    try {
      const response = await fetch("http://localhost:8080/group-invite-requests", {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setGroupInvites(data || []);
      } else {
        console.error("Failed to fetch group invites");
      }
    } catch (err) {
      console.error("Error fetching group invites:", err);
    }
  };

  const fetchAllGroupEvents = async () => {
    try {
      const response = await fetch("http://localhost:8080/all-group-events", {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const eventsWithLocalTime = data && data.length > 0 
          ? data.map((event: GroupEvent) => ({
              ...event,
              eventTime: new Date(event.eventTime).toLocaleString()
            }))
          : [];
        setAllGroupEvents(eventsWithLocalTime);
      } else if (response.status === 404) {
        // Endpoint doesn't exist yet, silently handle
        console.log("All group events endpoint not available yet");
        setAllGroupEvents([]);
      } else {
        console.error("Failed to fetch all group events");
        setAllGroupEvents([]);
      }
    } catch (err) {
      console.error("Error fetching all group events:", err);
      setAllGroupEvents([]);
    }
  };

  const handleEventResponse = async (eventId: number, response: "going" | "not_going") => {
    try {
      const res = await fetch("http://localhost:8080/respond-to-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          response,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to submit response");
      }

      toast.success("Response submitted successfully");
      // Refresh events to get updated data
      fetchAllGroupEvents();
    } catch (error) {
      toast.error("Failed to submit response");
      console.error("Error submitting response:", error);
    }
  };

  const handleCreateGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const groupName = formData.get("groupName") as string;
    const groupDescription = formData.get("groupDescription") as string;

    try {
      const res = await fetch("http://localhost:8080/creategroup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          groupName,
          groupDescription,
        }),
        credentials: 'include'
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to create group");
      }

      const newGroup = await res.json();
      setGroups((prev) => [...(prev || []), newGroup]);
      
      if (formRef.current) {
        formRef.current.reset();
      }
      toast.success("Group created successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create group";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (groupId: number) => {
    try {
      const response = await fetch(`http://localhost:8080/group-members?group_id=${groupId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setMembers(data || []);
      } else {
        const errorText = await response.text();
        setError("Failed to fetch group members: " + errorText);
        toast.error("Failed to fetch group members");
      }
    } catch (err) {
      setError("Error fetching group members");
      toast.error("Error fetching group members");
    }
  };

  const handleInviteUser = async (groupId: number) => {
    if (!newUsername.trim()) {
      toast.error("Please enter a username");
      return;
    }

    if (!Number.isInteger(groupId) || groupId <= 0) {
      toast.error("Invalid group ID");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:8080/group-invite-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          groupId,
          username: newUsername.trim(),
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Successfully invited ${newUsername} to the group!`);
        fetchMembers(groupId);
        setNewUsername("");
      } else {
        const errorText = await response.text();
        toast.error("Failed to invite user: " + errorText);
      }
    } catch (err) {
      toast.error("Error inviting user to group");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (inviteId: number) => {
    try {
      const response = await fetch("http://localhost:8080/accept-group-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inviteId,
        }),
        credentials: 'include'
      });

      if (response.ok) {
        toast.success("Group invite accepted successfully!");
        fetchGroupInvites();
        fetchGroups();
        fetchAllGroupEvents(); // Refresh events when joining new group
      } else {
        const errorText = await response.text();
        toast.error("Failed to accept invite: " + errorText);
      }
    } catch (err) {
      toast.error("Error accepting group invite");
    }
  };

  const handleRejectInvite = async (inviteId: number) => {
    try {
      const response = await fetch("http://localhost:8080/reject-group-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inviteId,
        }),
        credentials: 'include'
      });

      if (response.ok) {
        toast.success("Group invite rejected");
        fetchGroupInvites();
      } else {
        const errorText = await response.text();
        toast.error("Failed to reject invite: " + errorText);
      }
    } catch (err) {
      toast.error("Error rejecting group invite");
    }
  };

  const handleJoinRequest = async (groupId: number, groupName: string) => {
    setJoinRequestLoading(groupId);
    
    try {
      const response = await fetch("http://localhost:8080/request-join-group", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          groupId,
          groupName,
          title: `Request to join ${groupName}`,
          description: `User wants to join the group "${groupName}"`
        }),
        credentials: 'include'
      });

      if (response.ok) {
        toast.success("Join request sent successfully! Group admins will review your request.");
      } else {
        const errorText = await response.text();
        if (errorText.includes("already sent") || errorText.includes("pending")) {
          toast.info("You have already sent a join request for this group.");
        } else {
          toast.error("Failed to send join request: " + errorText);
        }
      }
    } catch (err) {
      toast.error("Error sending join request");
    } finally {
      setJoinRequestLoading(null);
    }
  };

  const handleGroupClick = (group: Group) => {
    if (!group.isMember) {
      toast.error("You must be a member of the group to access the chat.");
      return;
    }
    setSelectedGroup(group);
    setShowMembers(false);
    setShowEvents(false);
    setShowPosts(false);
    setShowInvites(false);
    setShowAllEvents(false);
    // Mark the group as read when opened
    markGroupAsRead(group.id);
  };

  const handleManageMembers = (group: Group) => {
    if (!group.isMember) {
      toast.error("You must be a member of the group to manage members.");
      return;
    }
    setSelectedGroup(group);
    setShowMembers(true);
    setShowEvents(false);
    setShowPosts(false);
    setShowInvites(false);
    setShowAllEvents(false);
    fetchMembers(group.id);
  };

  const handleViewEvents = async (group: Group) => {
    if (!group.isMember) {
      toast.error("You must be a member of the group to view events.");
      return;
    }
    
    // Mark all events in this group as read
    const groupEventNotifications = eventNotifications.filter(n => n.group_id === group.id);
    for (const notification of groupEventNotifications) {
      await markEventAsRead(notification.event_id);
    }
    
    setSelectedGroup(group);
    setShowEvents(true);
    setShowMembers(false);
    setShowPosts(false);
    setShowInvites(false);
    setShowAllEvents(false);
  };

  const handleViewPosts = (group: Group) => {
    if (!group.isMember) {
      toast.error("You must be a member of the group to view posts.");
      return;
    }
    setSelectedGroup(group);
    setShowPosts(true);
    setShowMembers(false);
    setShowEvents(false);
    setShowInvites(false);
    setShowAllEvents(false);
  };

  const handleViewInvites = () => {
    setShowInvites(true);
    setShowMembers(false);
    setShowEvents(false);
    setShowPosts(false);
    setShowAllEvents(false);
    setSelectedGroup(null);
  };

  const handleViewAllEvents = () => {
    setShowAllEvents(true);
    setShowInvites(false);
    setShowMembers(false);
    setShowEvents(false);
    setShowPosts(false);
    setSelectedGroup(null);
  };

  // Separate events by response status
  const pendingEvents = allGroupEvents.filter(event => event.userResponse === null || event.userResponse === undefined);
  const respondedEvents = allGroupEvents.filter(event => event.userResponse === "going" || event.userResponse === "not_going");

  // All Group Events View
  if (showAllEvents) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => setShowAllEvents(false)}
            className="mb-6 flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Groups</span>
          </button>
          
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900">All Group Events</h2>
                <p className="text-gray-600">Events from all your groups in one place</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="bg-red-50 rounded-2xl p-6 text-center">
                <div className="text-3xl font-bold text-red-600 mb-2">{pendingEvents.length}</div>
                <div className="text-red-700 font-medium">Pending Response</div>
              </div>
              <div className="bg-blue-50 rounded-2xl p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">{respondedEvents.length}</div>
                <div className="text-blue-700 font-medium">Responded To</div>
              </div>
              <div className="bg-purple-50 rounded-2xl p-6 text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">{allGroupEvents.length}</div>
                <div className="text-purple-700 font-medium">Total Events</div>
              </div>
            </div>
          </div>

          {/* Pending Events Section */}
          {pendingEvents.length > 0 && (
            <div className="mb-8">
              <div className="bg-gradient-to-r from-red-600 to-pink-600 rounded-3xl p-6 mb-6">
                <div className="flex items-center space-x-3 text-white">
                  <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold">Pending Your Response ({pendingEvents.length})</h4>
                    <p className="text-red-100">Events waiting for your RSVP across all groups</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6">
                {pendingEvents.map((event) => (
                  <div key={event.id} className="bg-white rounded-3xl shadow-xl p-6 border-l-8 border-red-500">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h5 className="text-xl font-semibold text-gray-900">{event.title}</h5>
                          <span className="px-3 py-1 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 text-sm rounded-full font-medium">
                            {event.groupName}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-3 leading-relaxed">{event.description}</p>
                        <div className="flex items-center text-sm text-gray-500 space-x-4">
                          <div className="flex items-center space-x-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>Created by {event.createdBy}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{event.eventTime}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-1 text-green-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium">{event.goingCount}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-red-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium">{event.notGoingCount}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleEventResponse(event.id, "going")}
                        className={`flex-1 py-3 rounded-xl transition-all font-medium flex items-center justify-center space-x-2 ${
                          event.userResponse === "going"
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>Going</span>
                      </button>
                      <button
                        onClick={() => handleEventResponse(event.id, "not_going")}
                        className={`flex-1 py-3 rounded-xl transition-all font-medium flex items-center justify-center space-x-2 ${
                          event.userResponse === "not_going"
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span>Not Going</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Events Message */}
          {allGroupEvents.length === 0 && (
            <div className="text-center py-16">
              <div className="bg-gray-100 rounded-full p-8 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Events Found</h3>
              <p className="text-gray-500">There are no events across your groups yet</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Group Invites View
  if (showInvites) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setShowInvites(false)}
            className="mb-6 flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Groups</span>
          </button>
          
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Group Invitations
            </h2>
            <p className="text-gray-600">Manage your pending group invitations</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-8">
            {groupInvites.filter(invite => invite.status === 'pending').length === 0 ? (
              <p className="text-gray-500 text-center py-8">No pending invitations.</p>
            ) : (
              <div className="space-y-4">
                {groupInvites.filter(invite => invite.status === 'pending').map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-4 bg-sky-50 rounded-3xl">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-sky-500 to-sky-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">
                          {invite.groupName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{invite.groupName}</div>
                        <span className="text-sm text-gray-500">
                          Invited {new Date(invite.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAcceptInvite(invite.id)}
                        className="px-4 py-2 bg-gradient-to-r from-sky-600 to-sky-600 text-white rounded-lg hover:from-sky-700 hover:to-sky-700 transition-all font-medium"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectInvite(invite.id)}
                        className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-500 text-white rounded-lg hover:from-red-600 hover:to-red-600 transition-all font-medium"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Group Chat View
  if (selectedGroup && !showMembers && !showEvents && !showPosts) {
    return (
      <div>
        <div className="p-4">
          <button
            onClick={() => setSelectedGroup(null)}
            className="mb-4 flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Groups</span>
          </button>
        </div>
        <GroupChat groupId={selectedGroup.id} groupName={selectedGroup.groupName} />
      </div>
    );
  }

  // Members Management View
  if (showMembers && selectedGroup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => {
              setShowMembers(false);
              setSelectedGroup(null);
            }}
            className="mb-6 flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Groups</span>
          </button>

          <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Manage {selectedGroup.groupName}
            </h2>
            <p className="text-gray-600">Invite members and manage group access</p>
          </div>

          {selectedGroup.isAdmin && (
            <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Invite New Member</h3>
              <div className="flex space-x-4">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter username"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleInviteUser(selectedGroup.id);
                    }
                  }}
                />
                <button
                  onClick={() => handleInviteUser(selectedGroup.id)}
                  disabled={loading || !newUsername.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all disabled:from-gray-400 disabled:to-gray-400 font-medium"
                >
                  {loading ? "Inviting..." : "Send Invite"}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Group Members ({members.length})
            </h3>
            {members.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No members found.</p>
            ) : (
              <div className="space-y-4">
                {members.map((member, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-sky-500 to-sky-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">
                          {member.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900">{member.username}</span>
                          {member.isAdmin && (
                            <span className="px-2 py-1 bg-gradient-to-r from-orange-400 to-orange-400 text-white text-xs rounded-full font-medium">
                              Admin
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => {
                setShowMembers(false);
              }}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-500 text-white rounded-xl hover:from-green-600 hover:to-green-600 transition-all font-medium"
            >
              Open Group Chat
            </button>

            <button
              onClick={() => {
                setShowMembers(false);
                setShowEvents(true);
              }}
              className="px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-600 text-white rounded-xl hover:from-pink-700 hover:to-pink-700 transition-all font-medium"
            >
              View Events
            </button>

            <button
              onClick={() => {
                setShowMembers(false);
                setShowPosts(true);
              }}
              className="px-6 py-3 bg-gradient-to-r from-sky-600 to-sky-600 text-white rounded-xl hover:from-sky-700 hover:to-sky-700 transition-all font-medium"
            >
              View Posts
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Events View
  if (showEvents && selectedGroup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => {
              setShowEvents(false);
              setSelectedGroup(null);
            }}
            className="mb-6 flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Groups</span>
          </button>

          <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {selectedGroup.groupName} Events
            </h2>
            <p className="text-gray-600">Plan and organize group activities</p>
          </div>

          <GroupEvents groupId={selectedGroup.id} groupName={selectedGroup.groupName} />

          <div className="mt-8 flex flex-wrap gap-4">
            <button
              onClick={() => {
                setShowEvents(false);
              }}
               className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-500 text-white rounded-xl hover:from-green-600 hover:to-green-600 transition-all font-medium"
            >
              Open Group Chat
            </button>
            <button
              onClick={() => {
                setShowEvents(false);
                setShowMembers(true);
                fetchMembers(selectedGroup.id);
              }}
              className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-600 text-white rounded-xl hover:from-orange-700 hover:to-orange-700 transition-all font-medium"
            >
              Manage Members
            </button>
            <button
              onClick={() => {
                setShowEvents(false);
                setShowPosts(true);
              }}
              className="px-6 py-3 bg-gradient-to-r from-sky-600 to-sky-600 text-white rounded-xl hover:from-sky-700 hover:to-sky-700 transition-all font-medium"
            >
              View Posts
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Posts View
  if (showPosts && selectedGroup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => {
              setShowPosts(false);
              setSelectedGroup(null);
            }}
            className="mb-6 flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Groups</span>
          </button>
          
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {selectedGroup.groupName} Posts
            </h2>
            <p className="text-gray-600">Share ideas and discussions with your group</p>
          </div>

          <GroupPosts groupId={selectedGroup.id} groupName={selectedGroup.groupName} />

          <div className="mt-8 flex flex-wrap gap-4">
            <button
              onClick={() => {
                setShowPosts(false);
              }}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-medium"
            >
              Open Group Chat
            </button>
            <button
              onClick={() => {
                setShowPosts(false);
                setShowMembers(true);
                fetchMembers(selectedGroup.id);
              }}
              className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-600 text-white rounded-xl hover:from-orange-700 hover:to-orange-700 transition-all font-medium"
            >
              Manage Members
            </button>
            <button
              onClick={() => {
                setShowPosts(false);
                setShowEvents(true);
              }}
              className="px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-600 text-white rounded-xl hover:from-pink-700 hover:to-pink-700 transition-all font-medium"
            >
              View Events
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Your Groups</h1>
          <p className="text-xl text-gray-600">Connect, collaborate, and share with your communities</p>
        </div>

        {/* Quick Actions Bar */}
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-8">
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={handleViewAllEvents}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-medium flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>All Group Events</span>
              {pendingEvents.length > 0 && (
                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  {pendingEvents.length}
                </span>
              )}
            </button>
            
            {groupInvites.filter(invite => invite.status === 'pending').length > 0 && (
              <button
                onClick={handleViewInvites}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-xl hover:from-blue-700 hover:to-blue-700 transition-all font-medium flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Group Invites</span>
                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  {groupInvites.filter(invite => invite.status === 'pending').length}
                </span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center space-x-3">
              <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-red-700 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Create Group Form */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-12">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-sky-600 to-sky-600 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create New Group</h2>
              <p className="text-gray-600">Start a new community around shared interests</p>
            </div>
          </div>

          <form ref={formRef} onSubmit={handleCreateGroup} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Group Name</label>
              <input
                type="text"
                name="groupName"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                disabled={loading}
                placeholder="Choose a memorable name for your group"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                name="groupDescription"
                required
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                disabled={loading}
                placeholder="Describe what your group is about and what members can expect..."
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-sky-600 to-sky-600 text-white rounded-2xl hover:from-sky-700 hover:to-sky-700 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed font-medium text-lg"
            >
              {loading ? "Creating Group..." : "Create Group"}
            </button>
          </form>
        </div>

        {/* Groups List */}
        <div className="space-y-6">
          {groups.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-100 rounded-full p-8 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Groups Yet</h3>
              <p className="text-gray-500">Create your first group to get started!</p>
            </div>
          ) : (
            groups.map((group) => {
              // Get events for this specific group
              const groupEvents = allGroupEvents.filter(event => event.groupId === group.id);
              const groupPendingEvents = groupEvents.filter(event => event.userResponse === null || event.userResponse === undefined);
              const groupRespondedEvents = groupEvents.filter(event => event.userResponse === "going" || event.userResponse === "not_going");
              
              // Get notification data for this group
              const groupNotification = notifications.find(n => n.group_id === group.id);
              const unreadCount = groupNotification?.unread_count || 0;

              return (
                <div
                  key={group.id}
                  className="bg-white rounded-3xl shadow-xl p-8 hover:shadow-2xl transition-shadow relative"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-4">
                        <h3 className="text-2xl font-bold text-gray-900 relative">
                          {group.groupName}
                         
                        </h3>
                        <div className="flex space-x-2">
                          {group.isAdmin && (
                            <span className="px-3 py-1 bg-gradient-to-r from-orange-400 to-orange-400 text-white text-sm rounded-full font-medium">
                              Admin
                            </span>
                          )}
                          {group.isMember && !group.isAdmin && (
                            <span className="px-3 py-1 bg-gradient-to-r from-sky-400 to-sky-400 text-white text-sm rounded-full font-medium">
                              Member
                            </span>
                          )}
                          {!group.isMember && (
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full font-medium">
                              Not Member
                            </span>
                          )}
                          {groupPendingEvents.length > 0 && (
                            <span className="px-3 py-1 bg-gradient-to-r from-red-500 to-red-500 text-white text-sm rounded-full font-medium">
                              {groupPendingEvents.length} Pending
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-600 text-lg leading-relaxed mb-4">{group.description}</p>
                      <div className="flex items-center text-sm text-gray-500 space-x-4">
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>Created by {group.createdByUsername}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{new Date(group.createdAt).toLocaleDateString()}</span>
                        </div>
                        {groupEvents.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{groupEvents.length} events</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 ml-6">
                      {group.isMember ? (
                        <>
                        
                          <button
                            onClick={() => handleGroupClick(group)}
                            className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-600 text-white rounded-xl hover:from-green-700 hover:to-green-700 transition-all font-medium flex items-center space-x-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.678-.397c-.5-.217-.95-.567-1.297-1.014A9.009 9.009 0 014 15.875V9.25C4 4.832 7.582 1.25 12 1.25s8 3.582 8 7.75z" />
                            </svg>
                            <span>Chat</span>
                            
                            {unreadCount > 0 && (
                              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </span>
                            )}

                          </button>
                          <button
                            onClick={() => handleViewPosts(group)}
                            className="px-4 py-2 bg-gradient-to-r from-sky-600 to-sky-600 text-white rounded-xl hover:from-sky-700 hover:to-sky-700 transition-all font-medium flex items-center space-x-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>Posts</span>
                          </button>
                          <button
                            onClick={() => handleManageMembers(group)}
                            className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-600 text-white rounded-xl hover:from-orange-700 hover:to-orange-700 transition-all font-medium flex items-center space-x-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                            </svg>
                            <span>Members</span>
                          </button>
                          <button
                            onClick={() => handleViewEvents(group)}
                            className="px-4 py-2 bg-gradient-to-r from-pink-600 to-pink-600 text-white rounded-xl hover:from-pink-700 hover:to-pink-700 transition-all font-medium flex items-center space-x-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Events</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleJoinRequest(group.id, group.groupName)}
                          disabled={joinRequestLoading === group.id}
                          className="px-6 py-3 bg-gradient-to-r from-sky-200 to-sky-200 text-sky-600 rounded-xl hover:from-sky-400 hover:to-sky-400 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed font-medium flex items-center space-x-2"
                        >
                          {joinRequestLoading === group.id ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                              </svg>
                              <span>Request to Join</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Events Preview Section */}
                  {group.isMember && groupEvents.length > 0 && (
                    <div className="border-t border-gray-200 pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                          <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Recent Events</span>
                        </h4>
                        <div className="flex items-center space-x-4 text-sm">
                          {groupPendingEvents.length > 0 && (
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                              {groupPendingEvents.length} Pending
                            </span>
                          )}
                          {groupRespondedEvents.length > 0 && (
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                              {groupRespondedEvents.length} Responded
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {groupEvents.slice(0, 3).map((event) => (
                          <div key={event.id} className={`p-4 rounded-2xl border-l-4 ${
                            event.userResponse === null || event.userResponse === undefined
                              ? "bg-red-50 border-red-500"
                              : event.userResponse === "going"
                              ? "bg-green-50 border-green-500"
                              : "bg-gray-50 border-gray-500"
                          }`}>
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h5 className="font-semibold text-gray-900">{event.title}</h5>
                                  {event.userResponse && (
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      event.userResponse === "going" 
                                        ? "bg-green-100 text-green-800" 
                                        : "bg-red-100 text-red-800"
                                    }`}>
                                      {event.userResponse === "going" ? "✓ Going" : "✗ Not Going"}
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-600 text-sm mb-2">{event.description}</p>
                                <div className="flex items-center text-xs text-gray-500 space-x-3">
                                  <span>📅 {event.eventTime}</span>
                                  <span>👤 {event.createdBy}</span>
                                  <span>✅ {event.goingCount} going</span>
                                  <span>❌ {event.notGoingCount} not going</span>
                                </div>
                              </div>
                              
                              {(event.userResponse === null || event.userResponse === undefined) && (
                                <div className="flex space-x-2 ml-4">
                                  <button
                                    onClick={() => handleEventResponse(event.id, "going")}
                                    className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-medium"
                                  >
                                    ✓ Going
                                  </button>
                                  <button
                                    onClick={() => handleEventResponse(event.id, "not_going")}
                                    className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-medium"
                                  >
                                    ✗ Can't
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {groupEvents.length > 3 && (
                          <button
                            onClick={() => handleViewEvents(group)}
                            className="w-full py-2 text-pink-600 hover:text-pink-700 font-medium text-sm transition-colors"
                          >
                            View all {groupEvents.length} events →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* No Events Message for Members */}
                  {group.isMember && groupEvents.length === 0 && (
                    <div className="border-t border-gray-200 pt-6">
                      <div className="text-center py-6 text-gray-500">
                        <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">No events in this group yet</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
} 