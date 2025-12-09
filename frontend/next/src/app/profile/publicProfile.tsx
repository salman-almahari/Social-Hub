"use client";

import React, { useEffect, useState } from "react";
import { FollowersModal } from '../components/FollowersModal';
import { useAuth } from "../context/auth";
import { useWebSocket } from "../context/WebSocketContext";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface PublicProfileProps {
  nickname: string;
}

interface PublicProfileData {
  nickname: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  gender?: string;
  age?: number;
  about_me?: string;
  posts: any[];
  followers: number;
  following: number;
  profilePicture?: string;
  isPublic: string;
}

export function PublicProfile({ nickname }: PublicProfileProps) {
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [status, setStatus] = useState("Follow");
  const [visibility, setVisibility] = useState("");
  const [error, setError] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"followers" | "following">("followers");
  const { user } = useAuth();
  const { onUserListUpdate, offUserListUpdate } = useWebSocket();
  const router = useRouter();

  const updateFollowStatus = async () => {
    try {
      const followRes = await fetch(`http://localhost:8080/follow-status?target_nickname=${nickname}`, {
        credentials: "include",
      });
      if (followRes.ok) {
        const followData = await followRes.json();
        if (followData.status === "accepted") {
          setStatus("Following");
        } else if (followData.status === "pending") {
          setStatus("Pending");
        } else {
          setStatus("Follow");
        }
      }
    } catch (err) {
      console.error("Error fetching follow status:", err);
    }
  };

  const updateProfileData = async () => {
    try {
      const res = await fetch(`http://localhost:8080/user/${nickname}`, {
        credentials: "include",
      });

      if (!res.ok) {
        setError("❌ Failed to load profile.");
        return;
      }

      const data = await res.json();
      setProfile(data.profile || data);
      setVisibility(data.visibility || data.profileVisibility || "public");
      setError(""); // Clear any errors on successful load
    } catch (err) {
      setError("⚠️ Network error while fetching profile.");
      console.error(err);
    }
  };

  // Load profile data first
  useEffect(() => {
    updateProfileData();
    updateFollowStatus();
  }, [nickname]);

  // Listen for follow status updates from WebSocket
  useEffect(() => {
    const handleFollowStatusUpdate = () => {
      console.log("Follow status update received, refreshing follow status");
      updateFollowStatus();
      updateProfileData();
    };
    
    onUserListUpdate(handleFollowStatusUpdate);
    return () => offUserListUpdate(handleFollowStatusUpdate);
  }, [onUserListUpdate, offUserListUpdate]);

  const handleFollow = async () => {
    try {
      if (status === "Following") {
        // Handle unfollow
        const res = await fetch("http://localhost:8080/unfollow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ target_nickname: nickname }),
        });

        if (res.ok) {
          setStatus("Follow");
          await updateProfileData();
        } else {
          const errorData = await res.text();
          console.error("Unfollow request failed. Status:", res.status, "Error:", errorData);
          setError(`Failed to unfollow user: ${errorData}`);
          setTimeout(() => setError(""), 3000);
        }
      } else {
        // Handle follow - show loading state while waiting for response
        setIsFollowing(true);
        const res = await fetch("http://localhost:8080/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ target_nickname: nickname }),
        });

        if (res.ok) {
          console.log("Follow request successful, profile visibility:", profile?.isPublic);
          // Immediately update status to "Pending" for private profiles
          if (profile?.isPublic === "private") {
            console.log("Setting status to Pending for private profile");
            setStatus("Pending");
          } else {
            console.log("Setting status to Following for public profile");
            setStatus("Following");
          }
        } else {
          const errorData = await res.text();
          console.error("Follow request failed. Status:", res.status, "Error:", errorData);
          setError(`Failed to follow user: ${errorData}`);
          setTimeout(() => setError(""), 3000);
        }
        setIsFollowing(false);
      }
    } catch (err) {
      console.error("Network error:", err);
      setError("Network error while trying to follow/unfollow user");
      setTimeout(() => setError(""), 3000);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h2>
          <p className="text-red-600 font-medium">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Profile</h2>
          <p className="text-gray-600">Please wait while we fetch the profile...</p>
        </div>
      </div>
    );
  }

  const isPrivateAndNotFollowing = profile?.isPublic === "private" && status !== "Following";
  const canViewFollowLists = !isPrivateAndNotFollowing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-sky-600 to-sky-500 h-32 relative">
            <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
              <div className="relative">
                <img
                  src={profile.profilePicture ? `http://localhost:8080${profile.profilePicture}` : "https://www.w3schools.com/howto/img_avatar.png"}
                  alt="Profile Picture"
                  className="w-32 h-32 rounded-3xl border-4 border-white shadow-lg object-cover"
                />
                {/* {profile?.isPublic === "private" && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )} */}
              </div>
            </div>
          </div>
          
          <div className="pt-20 pb-6 px-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{profile.nickname}</h1>
            {(profile.firstName || profile.lastName) && (
              <p className="text-lg text-gray-600 mb-4">{profile.firstName} {profile.lastName}</p>
            )}
            
            {/* Profile Visibility Badge */}
            <div className="flex justify-center mb-6">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                profile?.isPublic === 'public' 
                  ? 'bg-green-100 text-green-500' 
                  : 'bg-red-100 text-red-500'
              }`}>
                {profile?.isPublic === 'public' ? (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                    </svg>
                    Public Profile
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Private Profile
                  </>
                )}
              </span>
            </div>
            
            {/* Profile Stats */}
            <div className="flex justify-center items-center space-x-8 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{Array.isArray(profile.posts) ? profile.posts.length : 0}</div>
                <div className="text-sm text-gray-500 uppercase tracking-wide">Posts</div>
              </div>
              <div 
                className={`text-center ${canViewFollowLists ? "cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors" : ""}`}
                onClick={() => {
                  if (!canViewFollowLists) return;
                  setModalType("followers");
                  setModalOpen(true);
                }}
              >
                <div className="text-2xl font-bold text-gray-900">{profile.followers}</div>
                <div className="text-sm text-gray-500 uppercase tracking-wide">Followers</div>
              </div>
              <div 
                className={`text-center ${canViewFollowLists ? "cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors" : ""}`}
                onClick={() => {
                  if (!canViewFollowLists) return;
                  setModalType("following");
                  setModalOpen(true);
                }}
              >
                <div className="text-2xl font-bold text-gray-900">{profile.following}</div>
                <div className="text-sm text-gray-500 uppercase tracking-wide">Following</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center space-x-3">
              <button
                onClick={handleFollow}
                disabled={status === "Pending" || isFollowing}
                className={`px-6 py-2 rounded-2xl font-medium transition-colors ${
                  status === "Pending" || isFollowing
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : status === "Following"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-sky-600 hover:bg-sky-700 text-white"
                }`}
              >
                {isFollowing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Following...
                  </>
                ) : status === "Following" ? "Unfollow" : status}
              </button>
              
              <button
                onClick={() => router.push(`/messages/${profile.nickname}`)}
                disabled={isPrivateAndNotFollowing}
                className={`px-6 py-2 rounded-2xl font-medium transition-colors 
                  ${isPrivateAndNotFollowing 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-green-600 text-white hover:bg-green-700'}`}
              >
                Message
              </button>
                
            </div>

            {/* Status Messages */}
            {status === "Pending" && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Follow request pending approval
                </p>
              </div>
            )}
          </div>
        </div>

        {/* About Me Section */}
        {profile.about_me && (
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">About {profile.nickname}</h2>
            <div className="bg-gray-50 rounded-xl p-6">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {profile.about_me}
              </p>
            </div>
          </div>
        )}

        {/* Posts Section */}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {profile.nickname}'s Posts
          </h2>
          
          {/* Private Profile Restriction */}
          {isPrivateAndNotFollowing ? (
            <div className="text-center py-12">
              <div className="bg-gray-100 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">This Account is Private</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Follow {profile.nickname} to see their posts and updates. Only approved followers can view this content.
              </p>
            </div>
          ) : Array.isArray(profile.posts) && profile.posts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profile.posts.map((post: any, idx: number) => (
                <div key={idx} className="bg-gray-50 rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                  {post.image_url && (
                    <Image
                    src={`http://localhost:8080${post.image_url}`}
                    alt={post.title}
                      width={400}
                       height={300}
                         className="w-full h-48 object-contain hover:scale-105 transition-transform duration-300 bg-white"
                    style={{ aspectRatio: 'auto' }}
                    />
                  )}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{post.title}</h3>
                    <p className="text-gray-600 text-sm mb-3 line-clamp-3">{post.content}</p>
                    
                    {post.category && post.category.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {post.category.map((cat: string, catIdx: number) => (
                          <span key={catIdx} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-md">
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="bg-gray-100 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Posts Yet</h3>
              <p className="text-gray-600">
                {profile.nickname} hasn't shared any posts yet. Check back later!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Followers Modal */}
      <FollowersModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        type={modalType}
        targetNickname={nickname}
        isPrivate={isPrivateAndNotFollowing}
      />
    </div>
  );
}