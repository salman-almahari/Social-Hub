"use client"
import { useState, useEffect } from "react"
import { Settings, Users, Lock, Globe, X, Check, User, Save, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface User {
  id: number
  nickname: string
  first_name: string
  last_name: string
  avatar_url?: string
}

interface PostPrivacyManagerProps {
  postId: number
  currentPrivacyLevel: string
  onPrivacyChange: (privacyLevel: string, selectedUsers: User[]) => void
  disabled?: boolean
}

export function PostPrivacyManager({ 
  postId, 
  currentPrivacyLevel, 
  onPrivacyChange, 
  disabled = false 
}: PostPrivacyManagerProps) {
  const [privacyLevel, setPrivacyLevel] = useState(currentPrivacyLevel)
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Fetch current permissions and available users
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Fetch current permissions
        const permissionsResponse = await fetch(`http://localhost:8080/post-permissions/get?post_id=${postId}`, {
          credentials: "include",
        })
        
        if (permissionsResponse.ok) {
          const permissionsData = await permissionsResponse.json()
          const userIds = permissionsData.user_ids || []
          
          // Fetch available users
          const usersResponse = await fetch("http://localhost:8080/post-permissions/users", {
            credentials: "include",
          })
          
          if (usersResponse.ok) {
            const usersData = await usersResponse.json()
            const allUsers = usersData.users || []
            setAvailableUsers(allUsers)
            
            // Set selected users based on current permissions
            const selected = allUsers.filter((user: User) => userIds.includes(user.id))
            setSelectedUsers(selected)
          }
        }
      } catch (error) {
        console.error("Error fetching post permissions:", error)
        toast.error("Failed to load post permissions")
      } finally {
        setIsLoading(false)
      }
    }

    if (isOpen) {
      fetchData()
    }
  }, [postId, isOpen])

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("http://localhost:8080/post-permissions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          post_id: postId,
          user_ids: selectedUsers.map(user => user.id),
          replace_mode: true
        }),
      })

      if (response.ok) {
        toast.success("Post privacy updated successfully!")
        onPrivacyChange(privacyLevel, selectedUsers)
        setIsOpen(false)
      } else {
        toast.error("Failed to update post privacy")
      }
    } catch (error) {
      console.error("Error updating post privacy:", error)
      toast.error("Failed to update post privacy")
    } finally {
      setIsLoading(false)
    }
  }

  const getPrivacyIcon = (level: string) => {
    switch (level) {
      case "public": return <Globe className="w-4 h-4 text-green-600" />
      case "almost_private": return <Users className="w-4 h-4 text-yellow-600" />
      case "private": return <Lock className="w-4 h-4 text-red-600" />
      default: return <Globe className="w-4 h-4 text-green-600" />
    }
  }

  const getPrivacyDescription = (level: string) => {
    switch (level) {
      case "public": 
        return "This post is visible to everyone on the social network."
      case "almost_private": 
        return "This post is only visible to users who follow you."
      case "private": 
        return "This post is only visible to followers you specifically choose."
      default: 
        return ""
    }
  }

  const filteredUsers = availableUsers.filter(user =>
    user.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleUserToggle = (user: User) => {
    const isSelected = selectedUsers.some(u => u.id === user.id)
    
    if (isSelected) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id))
    } else {
      setSelectedUsers([...selectedUsers, user])
    }
  }

  const removeUser = (userId: number) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId))
  }

  const isUserSelected = (userId: number) => {
    return selectedUsers.some(u => u.id === userId)
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
      >
        <Settings className="w-4 h-4" />
        <span>Privacy Settings</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Post Privacy Settings</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Privacy Level Selection */}
              <div className="space-y-4">
                <label className="text-sm font-semibold text-gray-700">Privacy Level</label>
                <div className="grid gap-3">
                  {[
                    { value: "public", label: "Public", description: "All users can see this post" },
                    { value: "almost_private", label: "Followers Only", description: "Only followers can see this post" },
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
                        disabled={isLoading}
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
              </div>

              {/* User Selection for Private Posts */}
              {privacyLevel === "private" && (
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-gray-700">Select Users for Private Post</label>
                  
                  {/* Selected Users Display */}
                  {selectedUsers.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600">Selected Users ({selectedUsers.length})</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedUsers.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                          >
                            <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center">
                              {user.avatar_url ? (
                                <img
                                  src={user.avatar_url}
                                  alt={user.nickname}
                                  className="w-5 h-5 rounded-full object-cover"
                                />
                              ) : (
                                <User className="w-3 h-3 text-blue-600" />
                              )}
                            </div>
                            <span className="font-medium">{user.nickname}</span>
                            <button
                              type="button"
                              onClick={() => removeUser(user.id)}
                              disabled={isLoading}
                              className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User Search and Selection */}
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                      {isLoading ? (
                        <div className="p-4 text-center text-gray-500">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                          Loading users...
                        </div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          {searchTerm ? "No users found" : "No users available"}
                        </div>
                      ) : (
                        filteredUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleUserToggle(user)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {user.avatar_url ? (
                                <img
                                  src={user.avatar_url}
                                  alt={user.nickname}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <User className="w-4 h-4 text-gray-600" />
                              )}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium text-gray-900">{user.nickname}</div>
                              <div className="text-sm text-gray-500">
                                {user.first_name} {user.last_name}
                              </div>
                            </div>
                            {isUserSelected(user.id) && (
                              <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Privacy Description */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{getPrivacyDescription(privacyLevel)}</span>
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isLoading}
                  className="flex-1 py-2 px-4 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isLoading || (privacyLevel === "private" && selectedUsers.length === 0)}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 