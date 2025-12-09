"use client";
import { useEffect, useState, useCallback } from "react";
import { useWebSocket } from "../context/WebSocketContext";

export interface Request {
    id?: number;
    title?: string;
    description?: string;
    createdAt?: string;
    status?: string;
    createdByUsername?: string;
    groupId?: number;
    groupName?: string;
    createdByUserId?: number;
    follower_id?: number;
    follower_name?: string;
}

export interface GroupJoinRequest {
    id: number;
    groupId: number;
    groupName: string;
    userId: number;
    username: string;
    status: string;
    createdAt: string;
}

export interface GroupJoinRequestsResponse {
    asRequester: GroupJoinRequest[];
    asAdmin: GroupJoinRequest[];
}

export interface GroupInviteRequest {
    id: number;
    groupId: number;
    groupName: string;
    userId: number;
    username: string;
    status: string;
    createdAt: string;
}

export default function RequestsPage() {
    const [followRequests, setFollowRequests] = useState<Request[]>([]);
    const [groupRequests, setGroupRequests] = useState<GroupJoinRequestsResponse>({ asRequester: [], asAdmin: [] });
    const [groupInvites, setGroupInvites] = useState<GroupInviteRequest[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { onUserListUpdate, offUserListUpdate, refreshPendingRequestsCount } = useWebSocket();

    const fetchAllRequests = useCallback(async () => {
        setLoading(true);
        setError("");
        
        try {
            const res = await fetch("http://localhost:8080/requests", {
                credentials: "include",
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text);
            }

            const data = await res.json();
            console.log("📍 All requests data:", data);
            
            // Set follow requests
            setFollowRequests(data.follow_requests || []);
            
            // Set group join requests (as admin)
            setGroupRequests({
                asRequester: [],
                asAdmin: data.group_join_requests || []
            });
            
            // Set group invites
            setGroupInvites(data.group_invites || []);
        } catch (err) {
            console.error("❌ Error fetching all requests:", err);
            setError("Failed to load requests.");
            setFollowRequests([]);
            setGroupRequests({ asRequester: [], asAdmin: [] });
            setGroupInvites([]);
        } finally {
            setLoading(false);
        }
    }, []);



    useEffect(() => {
        fetchAllRequests();
    }, [fetchAllRequests]);

    // WebSocket listener for real-time updates
    useEffect(() => {
        const handleRequestUpdate = () => {
            console.log("Request update received, refreshing all requests");
            fetchAllRequests();
        };
        
        onUserListUpdate(handleRequestUpdate);
        return () => offUserListUpdate(handleRequestUpdate);
    }, [onUserListUpdate, offUserListUpdate, fetchAllRequests]);

    const handleAccept = async (followerName: string) => {
        setActionLoading(followerName + "-accept");
        try {
            await fetch("http://localhost:8080/accept", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ follower_nickname: followerName }),
            });
            fetchAllRequests();
            refreshPendingRequestsCount();
        } catch (err) {
            alert("Failed to accept follow request.");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDecline = async (followerName: string) => {
        setActionLoading(followerName + "-decline");
        try {
            await fetch("http://localhost:8080/decline", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ follower_nickname: followerName }),
            });
            fetchAllRequests();
            refreshPendingRequestsCount();
        } catch (err) {
            alert("Failed to decline follow request.");
        } finally {
            setActionLoading(null);
        }
    };

    const handleApproveGroupRequest = async (requestId: number, requestUserId: number, groupId: number) => {
        setActionLoading(`group-${requestId}-approve`);
        try {
            const response = await fetch("http://localhost:8080/approve-group-request", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    requestId,
                    userId: requestUserId,
                    groupId 
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            fetchAllRequests();
            refreshPendingRequestsCount();
        } catch (err) {
            alert(`Failed to approve group join request: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectGroupRequest = async (requestId: number) => {
        setActionLoading(`group-${requestId}-reject`);
        try {
            const response = await fetch("http://localhost:8080/reject-group-request", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            fetchAllRequests();
            refreshPendingRequestsCount();
        } catch (err) {
            alert(`Failed to reject group join request: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleAcceptGroupInvite = async (inviteId: number) => {
        setActionLoading(`invite-${inviteId}-accept`);
        try {
            const response = await fetch("http://localhost:8080/accept-group-invite", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteId }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            fetchAllRequests();
            refreshPendingRequestsCount();
        } catch (err) {
            alert(`Failed to accept group invite: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectGroupInvite = async (inviteId: number) => {
        setActionLoading(`invite-${inviteId}-reject`);
        try {
            const response = await fetch("http://localhost:8080/reject-group-invite", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteId }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            fetchAllRequests();
            refreshPendingRequestsCount();
        } catch (err) {
            alert(`Failed to reject group invite: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setActionLoading(null);
        }
    };

    const renderFollowRequest = (request: Request) => (
        <li key={`follow-${request.follower_id}`}>
            <div className="p-4 bg-white shadow rounded border flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                    <span className="font-semibold text-blue-700">{request.follower_name}</span> wants to follow you.
                </div>
                <div className="mt-2 md:mt-0 flex gap-2">
                    <button
                        className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                        onClick={() => handleAccept(request.follower_name!)}
                        disabled={actionLoading === request.follower_name + "-accept"}
                    >
                        {actionLoading === request.follower_name + "-accept" ? "Accepting..." : "Accept"}
                    </button>
                    <button
                        className="px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                        onClick={() => handleDecline(request.follower_name!)}
                        disabled={actionLoading === request.follower_name + "-decline"}
                    >
                        {actionLoading === request.follower_name + "-decline" ? "Declining..." : "Decline"}
                    </button>
                </div>
            </div>
        </li>
    );

    const renderGroupRequest = (request: GroupJoinRequest, type: 'requester' | 'admin') => (
        <li key={`group-${request.id}-${type}`}>
            <div className="p-4 bg-white shadow rounded border">
                <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl font-semibold text-gray-800">
                        {type === 'requester' ? 'Your Group Join Request' : 'Group Join Request'}
                    </h2>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                        request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        request.status === 'approved' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                    }`}>
                        {request.status.toUpperCase()}
                    </span>
                </div>
                <div className="mb-3">
                    <p className="text-gray-700">
                        {type === 'requester' ? (
                            <>You requested to join <span className="font-semibold text-purple-700">"{request.groupName}"</span></>
                        ) : (
                            <><span className="font-semibold text-blue-700">{request.username}</span> wants to join <span className="font-semibold text-purple-700">"{request.groupName}"</span></>
                        )}
                    </p>
                </div>
                <div className="text-sm text-gray-500 mb-4">
                    <span>Date: {new Date(request.createdAt).toLocaleDateString()}</span>
                    <span className="ml-4">Group: <strong>{request.groupName}</strong></span>
                    {type === 'admin' && (
                        <span className="ml-4">Requested by: <strong>{request.username}</strong></span>
                    )}
                </div>
                
                {/* Show approval buttons only for pending requests when user is admin */}
                {type === 'admin' && request.status === 'pending' && (
                    <div className="flex gap-2">
                        <button
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                            onClick={() => handleApproveGroupRequest(request.id, request.userId, request.groupId)}
                            disabled={actionLoading === `group-${request.id}-approve`}
                        >
                            {actionLoading === `group-${request.id}-approve` ? "Approving..." : "Approve"}
                        </button>
                        <button
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                            onClick={() => handleRejectGroupRequest(request.id)}
                            disabled={actionLoading === `group-${request.id}-reject`}
                        >
                            {actionLoading === `group-${request.id}-reject` ? "Rejecting..." : "Reject"}
                        </button>
                    </div>
                )}
            </div>
        </li>
    );

    const renderGroupInvite = (invite: GroupInviteRequest) => (
        <li key={`invite-${invite.id}`}>
            <div className="p-4 bg-white shadow rounded border">
                <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl font-semibold text-gray-800">Group Invitation</h2>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                        invite.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                        invite.status === 'accepted' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                    }`}>
                        {invite.status.toUpperCase()}
                    </span>
                </div>
                <div className="mb-3">
                    <p className="text-gray-700">
                        You have been invited to join <span className="font-semibold text-purple-700">"{invite.groupName}"</span>
                    </p>
                </div>
                <div className="text-sm text-gray-500 mb-4">
                    <span>Date: {new Date(invite.createdAt).toLocaleDateString()}</span>
                    <span className="ml-4">Group: <strong>{invite.groupName}</strong></span>
                </div>
                
                {/* Show accept/reject buttons only for pending invites */}
                {invite.status === 'pending' && (
                    <div className="flex gap-2">
                        <button
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                            onClick={() => handleAcceptGroupInvite(invite.id)}
                            disabled={actionLoading === `invite-${invite.id}-accept`}
                        >
                            {actionLoading === `invite-${invite.id}-accept` ? "Accepting..." : "Accept"}
                        </button>
                        <button
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                            onClick={() => handleRejectGroupInvite(invite.id)}
                            disabled={actionLoading === `invite-${invite.id}-reject`}
                        >
                            {actionLoading === `invite-${invite.id}-reject` ? "Rejecting..." : "Reject"}
                        </button>
                    </div>
                )}
            </div>
        </li>
    );

    const hasAnyRequests = followRequests.length > 0 || 
                          (groupRequests?.asRequester?.length > 0) || 
                          (groupRequests?.asAdmin?.length > 0) ||
                          groupInvites.length > 0;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">Requests & Invitations</h1>
            
            {error && (
                <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
                    {error}
                </div>
            )}
            
            {loading ? (
                <div className="text-center py-8">
                    <p className="text-gray-600">Loading requests...</p>
                </div>
            ) : (
                <>
                    {hasAnyRequests ? (
                        <div className="space-y-8">
                            {/* Follow Requests */}
                            {followRequests.length > 0 && (
                                <div>
                                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">Follow Requests</h2>
                                    <ul className="space-y-4">
                                        {followRequests.map(renderFollowRequest)}
                                    </ul>
                                </div>
                            )}

                            {/* Group Invitations */}
                            {groupInvites.length > 0 && (
                                <div>
                                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">Group Invitations</h2>
                                    <ul className="space-y-4">
                                        {groupInvites.map(renderGroupInvite)}
                                    </ul>
                                </div>
                            )}

                            {/* Group Join Requests - As Admin */}
                            {groupRequests?.asAdmin?.length > 0 && (
                                <div>
                                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">Group Join Requests (As Admin)</h2>
                                    <ul className="space-y-4">
                                        {groupRequests.asAdmin.map(request => renderGroupRequest(request, 'admin'))}
                                    </ul>
                                </div>
                            )}

                            {/* Group Join Requests - As Requester */}
                            {groupRequests?.asRequester?.length > 0 && (
                                <div>
                                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">Your Group Join Requests</h2>
                                    <ul className="space-y-4">
                                        {groupRequests.asRequester.map(request => renderGroupRequest(request, 'requester'))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-gray-600">No requests or invitations found.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}