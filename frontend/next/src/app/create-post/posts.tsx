"use client"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import type React from "react"
import { toast } from "sonner"
import Image from "next/image"
import { PenTool, ImageIcon, Globe, Users, Lock, X, Upload, Eye, Tag, Type, FileText, ArrowLeft } from "lucide-react"
import { UserSelector } from "../components/UserSelector"

export function CreatePost() {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [category, setCategory] = useState("")
  const [privacyLevel, setPrivacyLevel] = useState("public")
  const [selectedUsers, setSelectedUsers] = useState<Array<{id: number, nickname: string, first_name: string, last_name: string, avatar_url?: string}>>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, or GIF)')
      return
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setImageFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsUploading(true)

    try {
      let imageUrl = ""

      // Upload image if selected
      if (imageFile) {
        const formData = new FormData()
        formData.append('post_image', imageFile)

        const uploadResponse = await fetch("http://localhost:8080/upload-post-image", {
          method: "POST",
          body: formData,
          credentials: "include",
        })

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image")
        }

        const uploadData = await uploadResponse.json()
        imageUrl = uploadData.image_url
      }

      // Create post with image URL and privacy level
      const response = await fetch("http://localhost:8080/createpost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
            title,
            content,
            category: category.split(",").map((cat) => cat.trim()),
            image_url: imageUrl,
            privacy_level: privacyLevel,
            selected_users: selectedUsers.map(user => user.id),
          }),
        credentials: "include",
      })

      if (response.ok) {
        toast.success("Post created successfully!")
        setTitle("")
        setContent("")
        setCategory("")
        setPrivacyLevel("public")
        setSelectedUsers([])
        setImageFile(null)
        setImagePreview(null)
        setTimeout(() => {
          router.push("/ShowPosts")
        }, 1250);
      } else {
        toast.error("Failed to create post!")
      }
    } catch (error) {
      console.error("Error creating post:", error)
      toast.error("Failed to create post!")
    } finally {
      setIsUploading(false)
    }
  }

  const getPrivacyIcon = (level: string) => {
    switch (level) {
      case "public": return <Globe className="w-5 h-5 text-green-600" />
      case "almost_private": return <Users className="w-5 h-5 text-yellow-600" />
      case "private": return <Lock className="w-5 h-5 text-red-600" />
      default: return <Globe className="w-5 h-5 text-green-600" />
    }
  }

  const getPrivacyDescription = (level: string) => {
    switch (level) {
      case "public": 
        return "This post will be visible to everyone on the social network."
      case "almost_private": 
        return "This post will only be visible to users who follow you."
      case "private": 
        return "This post will only be visible to followers you specifically choose."
      default: 
        return ""
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.push("/ShowPosts")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Posts</span>
            </button>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <PenTool className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Create New Post</h1>
            <p className="text-lg text-gray-600">Share your thoughts and ideas with the community</p>
          </div>
        </div>

        {/* Main Form */}
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-8 space-y-8">
              
              {/* Title Section */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Type className="w-4 h-4 text-blue-600" />
                  Post Title
                </label>
                <input
                  type="text"
                  placeholder="Enter an engaging title for your post..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={isUploading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all text-lg"
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Make it catchy and descriptive</span>
                  <span className={title.length > 100 ? 'text-red-500' : ''}>{title.length}/100</span>
                </div>
              </div>

              {/* Content Section */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Post Content
                </label>
                <textarea
                  placeholder="What's on your mind? Share your thoughts, experiences, or insights..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  disabled={isUploading}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all resize-none"
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Express yourself freely</span>
                  <span className={content.length > 2000 ? 'text-red-500' : ''}>{content.length}/2000</span>
                </div>
              </div>

              {/* Categories Section */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Tag className="w-4 h-4 text-blue-600" />
                  Categories
                </label>
                <input
                  type="text"
                  placeholder="technology, lifestyle, travel, food, music..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  disabled={isUploading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
                />
                <p className="text-sm text-gray-500">Separate multiple categories with commas</p>
              </div>

              {/* Image Upload Section */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  Attach Image <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                
                {!imagePreview ? (
                  <div className="relative">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      accept="image/jpeg,image/png,image/gif"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      disabled={isUploading}
                    />
                    <div className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                      <Upload className="w-10 h-10 text-gray-400 mb-3" />
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG or GIF (MAX. 10MB)</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-lg overflow-hidden">
                    <div className="w-full h-64 bg-gray-100">
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
                      disabled={isUploading}
                      className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              {/* Privacy Level Section */}
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Lock className="w-4 h-4 text-blue-600" />
                  Post Privacy
                </label>
                <div className="grid gap-3">
                  {[
                    { value: "public", label: "Public", description: "All users can see this post" },
                    { value: "almost_private", label: "Almost Private", description: "Only followers can see this post" },
                    { value: "private", label: "Private", description: "Only selected followers can see this post" }
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${
                        privacyLevel === option.value
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="privacy"
                        value={option.value}
                        checked={privacyLevel === option.value}
                        onChange={(e) => setPrivacyLevel(e.target.value)}
                        disabled={isUploading}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <div className="ml-4 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getPrivacyIcon(option.value)}
                          <span className="font-medium text-gray-900">{option.label}</span>
                        </div>
                        <p className="text-sm text-gray-500">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 flex items-start gap-2">
                    <Eye className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{getPrivacyDescription(privacyLevel)}</span>
                  </p>
                </div>
              </div>

              {/* User Selector for Private Posts */}
              {privacyLevel === "private" && (
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Users className="w-4 h-4 text-blue-600" />
                    Select Users for Private Post
                  </label>
                  <UserSelector
                    selectedUsers={selectedUsers}
                    onUsersChange={setSelectedUsers}
                    disabled={isUploading}
                  />
                </div>
              )}

            </div>

            {/* Form Actions */}
            <div className="bg-gray-50 px-8 py-6 border-t border-gray-100">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => router.push("/ShowPosts")}
                  disabled={isUploading}
                  className="flex-1 py-3 px-6 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isUploading || !title.trim() || !content.trim()}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <PenTool className="w-5 h-5" />
                      <span>Publish Post</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}