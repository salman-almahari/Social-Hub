"use client";

import React, { useState } from "react"; 
import { DefaultAvatar } from "./DefaultAvatar";
import ProfilePictureUpload from '../../components/ProfilePictureUpload';
import { FollowersModal } from '../components/FollowersModal';
import { PostPermissionsModal } from '../components/PostPermissionsModal';
import Image from "next/image";
import { Paperclip, PaperclipIcon } from "lucide-react";

interface Post {
    id: number;
    user_id: number;
    username: string;
    title: string;
    content: string;
    category: string[];
    image_url?: string;
    privacy_level?: string;
}

interface ProfileProps {
  nickname: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: string;
  age: number;
  about_me?: string;
  posts: Post[];
  followers: number;
  following: number;
  profilePicture: string;
  isPublic: string;
  onProfileUpdate?: () => void;
}

export function Profile({
  nickname,
  firstName,
  lastName,
  email,
  gender,
  age,
  about_me,
  posts,
  followers,
  following,
  profilePicture,
  isPublic,
  onProfileUpdate,
}: ProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [mail, setMail] = useState(email);
  const [sex, setSex] = useState(gender);
  const [years, setYears] = useState(age);
  const [aboutMe, setAboutMe] = useState(about_me || "");
  const [visibility, setVisibility] = useState(isPublic);
  const [newProfilePicture, setNewProfilePicture] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"followers" | "following">("followers");
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  console.log('Profile component received posts:', posts);
  const safePosts = Array.isArray(posts) ? posts : [];
  console.log('Safe posts after array check:', safePosts);

  const handleAvatarUpdate = (newAvatarUrl: string) => {
    setNewProfilePicture(newAvatarUrl);
  };

  const handleSave = async () => {
    const body = {
      firstName: first,
      lastName: last,
      email: mail,
      gender: sex,
      age: years,
      about_me: aboutMe,
      isPublic: visibility === "public" ? "public" : "private",
      avatar_url: newProfilePicture || profilePicture,
    };

    try {
      const res = await fetch("http://localhost:8080/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const responseText = await res.text();
      console.log("Response from server:", responseText);

      if (res.ok) {
        try {
          const data = JSON.parse(responseText);
          console.log("✅ Profile updated:", data);
          setIsEditing(false);
          setNewProfilePicture(null);
          if (onProfileUpdate) {
            onProfileUpdate();
          } else {
            window.location.reload();
          }
        } catch (e) {
          console.log("Failed to parse response:", e);
        }
      } else {
        console.log("❌ Failed to update profile:", responseText);
      }
    } catch (err) {
      console.log("❌ Request failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-sky-600 to-sky-500 h-32 relative">
            <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
              <div className="relative">
                <ProfilePictureUpload
                  currentAvatarUrl={
                    (newProfilePicture || profilePicture)?.startsWith('/uploads/')
                      ? `http://localhost:8080${newProfilePicture || profilePicture}`
                      : newProfilePicture || profilePicture
                  }
                  onAvatarUpdate={handleAvatarUpdate}
                  isEditing={isEditing}
                />
              </div>
            </div>
          </div>
          
          <div className="pt-20 pb-6 px-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{nickname}</h1>
            <p className="text-lg text-gray-600">{first} {last}</p>
            
            <div className="flex justify-center items-center space-x-8 mt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{safePosts.length}</div>
                <div className="text-sm text-gray-500 uppercase tracking-wide">Posts</div>
              </div>
              <div 
                className="text-center cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
                onClick={() => {
                  setModalType("followers");
                  setModalOpen(true);
                }}
              >
                <div className="text-2xl font-bold text-gray-900">{followers}</div>
                <div className="text-sm text-gray-500 uppercase tracking-wide">Followers</div>
              </div>
              <div 
                className="text-center cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
                onClick={() => {
                  setModalType("following");
                  setModalOpen(true);
                }}
              >
                <div className="text-2xl font-bold text-gray-900">{following}</div>
                <div className="text-sm text-gray-500 uppercase tracking-wide">Following</div>
              </div>
            </div>

            <div className="mt-6 flex justify-center items-center space-x-3">
              <span className="text-sm text-gray-600">Profile Visibility:</span>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  visibility === 'public' 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-red-100 text-red-600'
                }`}>
                  {visibility === 'public' ? 'Public' : 'Private'}
                </span>
                {isEditing && (
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Profile Information</h2>
            <div className="flex space-x-3">
              {isEditing ? (
                <>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave}
                    className="px-4 py-2 text-white bg-sky-600 rounded-2xl hover:bg-sky-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-white bg-sky-600 rounded-2xl hover:bg-sky-700 transition-colors"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">First Name</label>
              {isEditing ? (
                <input 
                  type="text"
                  value={first} 
                  onChange={(e) => setFirst(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  maxLength={50}
                />
              ) : (
                <p className="text-gray-900 py-2">{first}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Last Name</label>
              {isEditing ? (
                <input 
                  type="text"
                  value={last} 
                  onChange={(e) => setLast(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  maxLength={50}
                />
              ) : (
                <p className="text-gray-900 py-2">{last}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Email</label>
              {isEditing ? (
                <input 
                  type="email"
                  value={mail} 
                  onChange={(e) => setMail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  maxLength={255}
                />
              ) : (
                <p className="text-gray-900 py-2">{mail}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Gender</label>
              {isEditing ? (
                <select
                  value={sex} 
                  onChange={(e) => setSex(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              ) : (
                <p className="text-gray-900 py-2">{sex}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Age</label>
              {isEditing ? (
                <input
                  type="number"
                  value={years}
                  onChange={(e) => setYears(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              ) : (
                <p className="text-gray-900 py-2">{years}</p>
              )}
            </div>
          </div>

          {/* About Me Section */}
          <div className="mt-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">About Me</label>
              {isEditing ? (
                <textarea
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="Tell us a bit about yourself..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              ) : (
                <p className="text-gray-900 py-2">
                  {aboutMe || "No information provided"}
                </p>
              )}
              {isEditing && (
                <p className="text-sm text-gray-500 mt-1">
                  {aboutMe.length}/500 characters
                </p>
              )}
            </div>
          </div>

          {/* <div className="mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => alert("Account deletion isn't supported in demo. 😜")}
              className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete Account
            </button>
          </div> */}
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Posts</h2>
          {safePosts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📝</div>
              <p className="text-gray-500 text-lg">You haven't created any posts yet.</p>
              <p className="text-gray-400 text-sm mt-2">Share your thoughts with the world!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {safePosts.map((post, idx) => (
                <div key={idx} className="bg-gray-50 rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                  {post.image_url && (
                    <div className="relative bg-gray-100">
                      <Image
                        src={`http://localhost:8080${post.image_url}`}
                        alt={post.title}
                        width={400}
                        height={300}
                        className="w-full h-48 object-contain hover:scale-105 transition-transform duration-300 bg-white"
                        style={{ aspectRatio: 'auto' }}
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 break-words overflow-x-auto">{post.title}</h3>
                    <p className="text-gray-600 text-sm mb-3 whitespace-pre-wrap overflow-y-auto max-h-[150px] break-words">{post.content}</p>
               
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        post.privacy_level === 'public' ? 'bg-sky-100 text-sky-800' :
                        post.privacy_level === 'almost_private' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {post.privacy_level === 'public' ? '🌐 Public' :
                         post.privacy_level === 'almost_private' ? '👥 Almost Private' : '🔒 Private'}
                      </span>
                      
                      {post.privacy_level === 'private' && (
                        <button
                          onClick={() => {
                            setSelectedPostId(post.id);
                            setPermissionsModalOpen(true);
                          }}
                          className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full hover:bg-blue-200 transition-colors"
                        >
                          Manage Access
                        </button>
                      )}
                    </div>
                    
                    {post.category && post.category.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {post.category.map((cat, catIdx) => (
                          <span key={catIdx} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-md whitespace-pre-wrap overflow-x-auto max-w-full break-words">
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <FollowersModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        type={modalType}
        targetNickname={nickname}
        isPrivate={false}
      />

      {selectedPostId && (
        <PostPermissionsModal
          isOpen={permissionsModalOpen}
          onClose={() => {
            setPermissionsModalOpen(false);
            setSelectedPostId(null);
          }}
          postId={selectedPostId}
        />
      )}
    </div>
  );
}