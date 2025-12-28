"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from '../components/button';
import { toast } from 'sonner';
import Image from 'next/image';
import { X, Upload, ImageIcon, MessageCircle, Send } from 'lucide-react';

interface GroupPostComment {
  id: number;
  postId: number;
  content: string;
  authorUsername: string;
  authorId: number;
  createdAt: string;
  imageUrl?: string;
}

interface GroupPost {
  id: number;
  groupId: number;
  title: string;
  content: string;
  media: string[];
  categories: string[];
  authorUsername: string;
  authorId: number;
  createdAt: string;
  likesCount: number;
  userHasLiked: boolean;
  imageUrl?: string;
  comments?: GroupPostComment[];
  commentsCount?: number;
}

interface GroupPostsProps {
  groupId: number;
  groupName: string;
}

export default function GroupPosts({ groupId, groupName }: GroupPostsProps) {
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingPosts, setFetchingPosts] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [commentLoading, setCommentLoading] = useState<Record<number, boolean>>({});
  
  // Image upload states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [newPost, setNewPost] = useState({
    title: "",
    content: "",
    categories: "",
    media: [] as string[],
  });

  useEffect(() => {
    fetchCurrentUser();
    fetchPosts();
  }, [groupId]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch("http://localhost:8080/auth/status", {
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentUserId(data.userID || data.uid || data.id);
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  };

  const fetchPosts = async () => {
    setFetchingPosts(true);
    try {
      const response = await fetch(`http://localhost:8080/group-posts?groupId=${groupId}`, {
        method: "GET",
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.status}`);
      }
      
      const data = await response.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast.error("Failed to load posts");
      setPosts([]);
    } finally {
      setFetchingPosts(false);
    }
  };

  const fetchComments = async (postId: number) => {
    try {
      const response = await fetch(`http://localhost:8080/group-post-comments?postId=${postId}`, {
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status}`);
      }
      
      const comments = await response.json();
      
      // Update the specific post with comments
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, comments: Array.isArray(comments) ? comments : [] }
            : post
        )
      );
    } catch (error) {
      console.error("Error fetching comments:", error);
      toast.error("Failed to load comments");
    }
  };

  const toggleComments = async (postId: number) => {
    const isExpanded = expandedComments.has(postId);
    
    if (isExpanded) {
      setExpandedComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    } else {
      setExpandedComments(prev => new Set(prev).add(postId));
      // Fetch comments if not already loaded
      const post = posts.find(p => p.id === postId);
      if (!post?.comments) {
        await fetchComments(postId);
      }
    }
  };

  const handleAddComment = async (postId: number) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;

    setCommentLoading(prev => ({ ...prev, [postId]: true }));
    
    try {
      const response = await fetch("http://localhost:8080/add-group-post-comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId,
          content,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to add comment");
      }

      const newComment = await response.json();
      
      // Update posts with new comment
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                comments: [newComment, ...(post.comments || [])],
                commentsCount: (post.commentsCount || 0) + 1
              }
            : post
        )
      );
      
      // Clear input
      setCommentInputs(prev => ({ ...prev, [postId]: "" }));
      toast.success("Comment added successfully");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setCommentLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeleteComment = async (postId: number, commentId: number) => {
    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8080/delete-group-post-comment/${commentId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }

      // Update posts by removing the comment
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                comments: post.comments?.filter(comment => comment.id !== commentId) || [],
                commentsCount: Math.max((post.commentsCount || 0) - 1, 0)
              }
            : post
        )
      );
      
      toast.success("Comment deleted successfully");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  // Handle image selection
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Remove selected image
  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let imageUrl = "";

      // Upload image if selected
      if (imageFile) {
        const formData = new FormData();
        formData.append('group_post_image', imageFile);

        const uploadResponse = await fetch("http://localhost:8080/upload-group-post-image", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image");
        }

        const uploadData = await uploadResponse.json();
        imageUrl = uploadData.image_url;
      }

      const response = await fetch("http://localhost:8080/create-group-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          groupId,
          title: newPost.title,
          content: newPost.content,
          categories: newPost.categories.split(",").map((cat) => cat.trim()).filter(cat => cat),
          imageUrl: imageUrl,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to create post");
      }

      const newPostData = await response.json();
      setPosts(prevPosts => [newPostData, ...(prevPosts || [])]);
      
      toast.success("Post created successfully");
      setShowCreateForm(false);
      setNewPost({ title: "", content: "", categories: "", media: [] });
      setImageFile(null);
      setImagePreview(null);
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create post");
    } finally {
      setLoading(false);
    }
  };

  const handleLikePost = async (postId: number) => {
    try {
      const response = await fetch("http://localhost:8080/like-group-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ postId }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to like post");
      }

      setPosts(prevPosts => 
        (prevPosts || []).map(post => 
          post.id === postId 
            ? { 
                ...post, 
                userHasLiked: !post.userHasLiked,
                likesCount: post.userHasLiked ? post.likesCount - 1 : post.likesCount + 1
              }
            : post
        )
      );

      const post = (posts || []).find(p => p.id === postId);
      toast.success(post?.userHasLiked ? "Post unliked" : "Post liked");
    } catch (error) {
      toast.error("Failed to like post");
      console.error("Error liking post:", error);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm("Are you sure you want to delete this post?")) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8080/delete-group-post/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete post");
      }

      setPosts(prevPosts => (prevPosts || []).filter(post => post.id !== postId));
      toast.success("Post deleted successfully");
    } catch (error) {
      toast.error("Failed to delete post");
      console.error("Error deleting post:", error);
    }
  };

  if (fetchingPosts) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Group Posts</h3>
            <p className="text-gray-600 mt-1">Share ideas and discussions</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600">Loading posts...</p>
          </div>
        </div>
      </div>
    );
  }

  function handleCommentSubmit(id: number): void {
    const content = commentInputs[id]?.trim();
    if (!content) return;

    setCommentLoading(prev => ({ ...prev, [id]: true }));

    handleAddComment(id);
  }

  return (
    <div className="space-y-8 min-w-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Group Posts</h3>
          <p className="text-gray-600 mt-1">Share ideas and discussions with your group</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-6 py-3 bg-gradient-to-r from-sky-600 to-sky-600 text-white rounded-xl hover:from-sky-700 hover:to-sky-700 transition-all font-medium flex items-center space-x-2"
        >
          {showCreateForm ? (
            <>
              <X className="w-5 h-5" />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Create Post</span>
            </>
          )}
        </button>
      </div>

      {/* Create Post Form */}
      {showCreateForm && (
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h4 className="text-xl font-semibold text-gray-900">Create New Post</h4>
              <p className="text-gray-600">Share your thoughts with the group</p>
            </div>
          </div>

          <form onSubmit={handleCreatePost} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Post Title</label>
              <input
                type="text"
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
                maxLength={60}
                placeholder="What's your post about?"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
              <textarea
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={6}
                required
                disabled={loading}
                maxLength={2000}
                placeholder="Share your thoughts, ideas, or ask a question..."
              />
            </div>

            {/* Image Upload Section */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                Attach Image <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              
              {!imagePreview ? (
                <div className="relative">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    disabled={loading}
                  />
                  <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF or WebP (MAX. 10MB)</p>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden">
                  <div className="w-full h-48 bg-gray-100">
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={removeImage}
                    disabled={loading}
                    className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
              <input
                type="text"
                value={newPost.categories}
                onChange={(e) => setNewPost({ ...newPost, categories: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
                maxLength={100}
                placeholder="discussion, announcement, help, question"
              />
              <p className="text-sm text-gray-500 mt-2 flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 713 12V7a4 4 0 014-4z" />
                </svg>
                <span>Optional: Add categories separated by commas</span>
              </p>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? "Creating Post..." : "Create Post"}
            </button>
          </form>
        </div>
      )}

      {/* Posts Feed */}
      <div className="space-y-6">
        {!posts || posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-gray-100 rounded-full p-8 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Posts Yet</h3>
            <p className="text-gray-500 mb-6">Be the first to create a post in this group!</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all font-medium"
            >
              Create First Post
            </button>
          </div>
        ) : (
          posts.map((post) => (
            <article key={post.id} className="bg-white rounded-3xl shadow-xl p-8 hover:shadow-2xl transition-shadow">
              {/* Post Header */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg font-bold">
                      {post.authorUsername.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 break-words overflow-x-auto">{post.title}</h4>
                    <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                      <span className="font-medium">{post.authorUsername}</span>
                      <span>•</span>
                      <time>{new Date(post.createdAt).toLocaleDateString()}</time>
                      <span>•</span>
                      <time>{new Date(post.createdAt).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}</time>
                    </div>
                  </div>
                </div>
                
                {/* Delete button for post author */}
                {currentUserId && currentUserId === post.authorId && (
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium flex items-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete</span>
                  </button>
                )}
              </div>

              {/* Categories */}
              {post.categories && post.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {post.categories.map((category, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 text-sm rounded-full font-medium whitespace-pre-wrap overflow-x-auto max-w-full break-words"
                    >
                      #{category}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Post Content */}
              <div className="prose max-w-none mb-6">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-lg overflow-y-auto max-h-[300px] break-words">
                  {post.content}
                </p>
              </div>

              {/* Post Image */}
              {post.imageUrl && (
                <div className="mb-6 rounded-xl overflow-hidden">
                  <div className="relative w-full h-64 md:h-80">
                    <Image
                      src={`http://localhost:8080${post.imageUrl}`}
                      alt="Post image"
                      width={800}
                      height={600}
                      className="w-full max-h-96 object-contain hover:scale-105 transition-transform duration-300 bg-white"
                      style={{ aspectRatio: 'auto' }}
                    />
                  </div>
                </div>
              )}
              
              {/* Post Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handleLikePost(post.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all font-medium ${
                      post.userHasLiked 
                        ? "bg-red-50 text-red-600 hover:bg-red-100" 
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <div className="relative">
                      {post.userHasLiked ? (
                        <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-lg font-semibold">{post.likesCount}</span>
                    <span>{post.likesCount === 1 ? "Like" : "Likes"}</span>
                  </button>

                  <button
                    onClick={() => toggleComments(post.id)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl transition-all font-medium bg-gray-50 text-gray-600 hover:bg-gray-100"
                  >
                    <MessageCircle className="w-6 h-6" />
                    {/* <span className="text-lg font-semibold">{post.commentsCount || post.comments?.length || 0}</span> */}
                    <span>{(post.commentsCount || post.comments?.length || 0) === 1 ? "Comment" : "Comments"}</span>
                  </button>
                </div>
                
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 713 12V7a4 4 0 014-4z" />
                  </svg>
                  <span>Post #{post.id}</span>
                </div>
              </div>

              {/* Comments Section */}
              {expandedComments.has(post.id) && (
                <div className="mt-6 border-t border-gray-100 pt-6">
                  {/* Add Comment Form */}
                  <div className="mb-6">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-lg font-bold">
                          {currentUserId ? currentUserId.toString().charAt(0).toUpperCase() : "U"}
                        </span>
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={commentInputs[post.id] || ""}
                          onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                          placeholder="Add a comment..."
                          maxLength={500}
                        />
                      </div>
                      <button
                        onClick={() => handleCommentSubmit(post.id)}
                        className="px-4 py-2 text-sm font-semibold text-white bg-blue-500 rounded-xl hover:bg-blue-600"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                  
                  {/* Comments List */}
                    <div className="space-y-4 mt-4">
                    {post.comments?.map((comment) => (
                      <div key={comment.id} className="flex space-x-3 bg-gray-50 p-4 rounded-xl overflow-hidden">
                      <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex-shrink-0 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">
                        {comment.authorUsername.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900 break-words overflow-x-auto">{comment.authorUsername}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</span>
                          {currentUserId === comment.authorId && (
                          <button
                            onClick={() => handleDeleteComment(post.id, comment.id)}
                            className="text-red-500 hover:text-red-700 transition-colors p-1 hover:bg-red-50 rounded-full"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          )}
                        </div>
                        </div>
                        <p className="text-gray-700 whitespace-pre-wrap overflow-y-auto max-h-[150px] break-words">{comment.content}</p>
                      </div>
                      </div>
                    ))}
                    
                    {post.comments && post.comments.length === 0 && (
                      <div className="text-center py-6">
                      <p className="text-gray-500">No comments yet. Be the first to comment!</p>
                      </div>
                    )}
                    </div>
                  {post.comments && post.comments.length === 0 && (
                    <p className="text-gray-500 text-sm">No comments yet. Be the first to comment!</p>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}