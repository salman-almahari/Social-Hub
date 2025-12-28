"use client";
import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, Image as ImageIcon, X, ArrowLeft, User, Calendar, Camera, AlertCircle, RefreshCw } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";

interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  nickname: string;
  profilePicture?: string;
  content: string;
  time: string;
  image_url?: string;
}

export function CommentsSection() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const postId = searchParams.get('id');
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // You'll need to get this from your auth context or props
  const currentUserId = 1;

  // Debug logging
  console.log("CommentsSection rendered with postId:", postId);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        if (!postId) {
          console.log("No postId available");
          return;
        }
        
        console.log("Fetching comments for postId:", postId);
        setLoading(true);
        setError(null);
        
        const url = `http://localhost:8080/comments?post_id=${postId}`;
        console.log("Fetch URL:", url);
        
        const response = await fetch(url);
        console.log("Fetch response:", response.status, response.statusText);
        
        if (!response.ok) {
          throw new Error(`Failed to load comments. Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Comments data received:", data);
        setComments(data || []);
      } catch (err) {
        console.log("Error fetching comments:", err);
        setError("Failed to load comments. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [postId]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, or GIF)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
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

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    console.log("Submit button clicked!");
    e.preventDefault();
    
    console.log("Form data:", {
      newComment: newComment,
      postId: postId,
      currentUserId: currentUserId
    });
    
    if (!newComment.trim() && !imageFile) {
      console.log("Empty comment and no image, not submitting");
      toast.error("Please write a comment or add an image");
      return;
    }
    
    if (!postId) {
      console.log("No postId, not submitting");
      return;
    }
    
    console.log("Starting comment submission...");
    setSubmitting(true);
    setError(null);
    
    try {
      let imageUrl = "";

      // Upload image if selected
      if (imageFile) {
        const formData = new FormData();
        formData.append('comment_image', imageFile);

        const uploadResponse = await fetch("http://localhost:8080/upload-comment-image", {
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

      const requestBody = {
        post_id: parseInt(postId),
        user_id: currentUserId,
        content: newComment.trim(),
        image_url: imageUrl,
      };
      
      console.log("Request body:", requestBody);
      
      const response = await fetch("http://localhost:8080/comments/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log("Submit response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log("Response error:", errorText);
        throw new Error(`Failed to add comment. Status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log("Submit result:", result);
      
      if (result.success) {
        console.log("Comment added successfully, refreshing comments...");
        
        // Refresh comments after successful submission
        const commentsResponse = await fetch(
          `http://localhost:8080/comments?post_id=${postId}`
        );
        
        if (commentsResponse.ok) {
          const data = await commentsResponse.json();
          console.log("Refreshed comments:", data);
          setComments(data || []);
        }
        
        setNewComment(""); // Clear the form
        setImageFile(null);
        setImagePreview(null);
        toast.success("Comment added successfully!");
        console.log("Comment form cleared");
      } else {
        console.log("Server returned success: false");
        toast.error("Failed to add comment");
      }
    } catch (err) {
      console.log("Error adding comment:", err);
      setError("Failed to add comment. Please try again.");
      toast.error("Failed to add comment. Please try again.");
    } finally {
      setSubmitting(false);
      console.log("Submit process completed");
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No timestamp';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-center items-center min-h-[40vh]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                <p className="mt-4 text-lg text-gray-600">Loading comments...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !comments.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-8 text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Comments</h3>
              <p className="text-red-600 mb-6">{error}</p>
              <div className="flex gap-4 justify-center">
                <button 
                  onClick={() => router.back()}
                  className="flex items-center gap-2 px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Go Back
                </button>
                <button 
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Posts</span>
              </button>
            </div>
            
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center gap-4">
                <div className="bg-blue-100 p-3 rounded-full">
                  <MessageCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Comments ({comments.length})
                  </h1>
                  <p className="text-gray-600">Join the conversation</p>
                </div>
              </div>
            </div>
          </div>

          {/* Add Comment Form */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add a Comment</h3>
            <form onSubmit={handleSubmitComment} className="space-y-4">
              <div>
                <textarea
                  value={newComment}
                  onChange={(e) => {
                    console.log("Comment text changed:", e.target.value);
                    setNewComment(e.target.value);
                  }}
                  placeholder="Share your thoughts..."
                  className="w-full p-4 border border-gray-300 rounded-3xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all"
                  rows={4}
                  disabled={submitting}
                  maxLength={500}
                />
                <div className="flex justify-between text-sm text-gray-500 mt-2">
                  <span>Express yourself</span>
                  <span className={newComment.length > 500 ? 'text-red-500' : ''}>{newComment.length}/500</span>
                </div>
              </div>

              {/* Image Upload Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-blue-600 transition-colors">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      accept="image/jpeg,image/png,image/gif"
                      className="hidden"
                      disabled={submitting}
                    />
                    <Camera className="w-5 h-5" />
                    <span className="font-medium">
                      {imageFile ? "Change Image" : "Add Image"}
                    </span>
                  </label>
                </div>
                
                {imagePreview && (
                  <div className="relative inline-block">
                    <div className="relative rounded-xl overflow-hidden">
                      <Image
                        src={imagePreview}
                        alt="Preview"
                        width={200}
                        height={150}
                        className="max-h-32 object-contain bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        disabled={submitting}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={(!newComment.trim() && !imageFile) || submitting}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all font-medium"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Add Comment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {error && (
            <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-6 mb-8">
              <div className="flex items-center gap-3 text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="mt-3 text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Comments List */}
          {comments.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">No comments yet</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Be the first to share your thoughts on this post!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment, index) => (
                <div 
                  key={comment.id} 
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow overflow-hidden"
                >
                  <div className="flex items-start gap-4">
                    {/* User Avatar */}
                    <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                      {comment.profilePicture ? (
                        <img
                          src={`http://localhost:8080${comment.profilePicture}`}
                          alt={comment.nickname}
                          className="w-12 h-12 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <User className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Comment Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-gray-900 break-words overflow-x-auto">
                            {comment.nickname || `User ${comment.user_id}`}
                          </h4>
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(comment.time)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Comment Content */}
                      {comment.content && (
                        <p className="text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap overflow-y-auto max-h-[150px] break-words">
                          {comment.content}
                        </p>
                      )}
                      
                      {/* Comment Image */}
                      {comment.image_url && (
                        <div className="mt-3">
                          <div className="relative rounded-xl overflow-hidden bg-gray-100 inline-block">
                            <Image
                              src={`http://localhost:8080${comment.image_url}`}
                              alt="Comment image"
                              width={300}
                              height={200}
                              className="max-h-64 object-contain"
                            />
                          </div>
                        </div>
                      )}
                    </div>
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