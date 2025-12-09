// testing salman's gitea account
"use client";
import { useEffect, useState } from "react";
import { Button } from "../components/button";
import { useRouter } from "next/navigation";
import { MessageCircle, Plus, RefreshCw, AlertCircle, Hash, Globe, Users, Lock } from "lucide-react";
import Image from "next/image";

interface Post {
  id: number;
  user_id: number;
  username: string;
  title: string;
  content: string;
  category: string[];
  created_at: string;
  image_url?: string;
  privacy_level?: string;
}

export function ShowPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("http://localhost:8080/posts", {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch posts: ${response.statusText}`);
        }
        const data: Post[] = await response.json();
        setPosts(data || []);
      } catch {
        setError('An error occurred while fetching posts');
        setPosts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, []);

  // Removed unused formatDate function

  const formatDateOnly = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return date.toLocaleDateString('en-US', { 
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const getPrivacyIcon = (level?: string) => {
    switch (level) {
      case "public": return <Globe className="w-4 h-4 text-green-600" />
      case "almost_private": return <Users className="w-4 h-4 text-yellow-600" />
      case "private": return <Lock className="w-4 h-4 text-red-600" />
      default: return <Globe className="w-4 h-4 text-green-600" />
    }
  };

  const getPrivacyLabel = (level?: string) => {
    switch (level) {
      case "public": return "Public"
      case "almost_private": return "Followers Only"
      case "private": return "Private"
      default: return "Public"
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
              <p className="mt-6 text-lg text-gray-600">Loading amazing posts...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="container mx-auto px-0 py-0">
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-8 text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Oops! Something went wrong</h3>
              <p className="text-red-600 mb-6">{error}</p>
              <Button 
                onClick={() => window.location.reload()}
                className="bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        {/* <div className="max-w-4xl mx-auto mb-12">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Community Posts</h1>
            <p className="text-lg text-gray-600">Discover amazing content from our community</p>
          </div>
          
         
          <div className="flex justify-between items-center bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <MessageCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {posts.length === 0 ? 'No posts yet' : `${posts.length} ${posts.length === 1 ? 'Post' : 'Posts'}`}
                </h3>
                <p className="text-sm text-gray-600">Share your thoughts with the community</p>
              </div>
            </div>
            <Button 
              onClick={() => router.push("/posts")}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white flex items-center gap-2 px-6 py-3 rounded-xl font-medium"
            >
              <Plus className="w-5 h-5" />
              Create Post
            </Button>
          </div>
        </div> */}

        {/* Posts Grid */}
        <div className="max-w-4xl mx-auto">
          {posts.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-12 text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">No posts yet</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Be the first to share something amazing with the community!
              </p>
              <Button 
                onClick={() => router.push("/create-post")}
                className="bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-700 hover:to-sky-600 text-white flex items-center gap-2 mx-auto px-8 py-3 rounded-xl font-medium"
              >
                <Plus className="w-5 h-5" />
                Create First Post
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {posts.map((post, index) => (
                <article 
                  key={post.id} 
                  className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  {/* Post Header */}
                  <div className="p-6 pb-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        {/* Username and Date */}
                        <div className="mb-2">
                          <button 
                            onClick={() => router.push(`/user/${post.username}`)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer hover:underline transition-colors"
                          >
                            @{post.username}
                          </button>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDateOnly(post.created_at)}
                          </div>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
                          {post.title}
                        </h2>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {/* Privacy Indicator */}
                          <div className="flex items-center gap-1">
                            {getPrivacyIcon(post.privacy_level)}
                            <span className="text-xs font-medium">
                              {getPrivacyLabel(post.privacy_level)}
                            </span>
                          </div>
                          
                          {/* Categories */}
                          {post.category && post.category.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Hash className="w-4 h-4" />
                              <div className="flex gap-1">
                                {post.category.slice(0, 3).map((cat, catIndex) => (
                                  <span 
                                    key={catIndex}
                                    className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium"
                                  >
                                    {cat}
                                  </span>
                                ))}
                                {post.category.length > 3 && (
                                  <span className="text-gray-400 text-xs">
                                    +{post.category.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Post Content */}
                    <div className="mb-4">
                      <p className="text-gray-700 leading-relaxed text-lg">
                        {truncateContent(post.content)}
                      </p>
                      {post.content.length > 200 && (
                        <button className="text-blue-600 hover:text-blue-700 font-medium text-sm mt-2">
                          Read more
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Post Image */}
                  {post.image_url && (
                    <div className="px-6 pb-4">
                      <div className="relative rounded-xl overflow-hidden bg-gray-100">
                        <Image
                          src={`http://localhost:8080${post.image_url}`}
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
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* <button className="flex items-center gap-2 text-gray-600 hover:text-red-500 transition-colors">
                          <Heart className="w-5 h-5" />
                          <span className="text-sm font-medium">Like</span>
                        </button> */}
                        <Button 
                          onClick={() => router.push(`/comments?id=${post.id}`)}
                          className="flex rounded-2xl items-center gap-2 text-gray-600 hover:text-sky-600 bg-transparent hover:bg-blue-50 border-none shadow-none p-2"
                        >
                          <MessageCircle className="w-5 h-5" />
                          <span className="text-sm font-medium">Comments</span>
                        </Button>
                        
                      </div>
                     
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Load More Section (for future pagination) */}
        {posts.length > 0 && (
          <div className="max-w-4xl mx-auto mt-12 text-center">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
              <p className="text-gray-600 mb-4">You&apos;ve seen all the latest posts!</p>
              <Button 
                onClick={() => window.location.reload()}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Posts
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}