"use client"
import { useState, useEffect } from "react"
import { Search, Users, X, Check, User } from "lucide-react"
import { toast } from "sonner"

interface User {
  id: number
  nickname: string
  first_name: string
  last_name: string
  avatar_url?: string
}

interface UserSelectorProps {
  selectedUsers: User[]
  onUsersChange: (users: User[]) => void
  disabled?: boolean
}

export function UserSelector({ selectedUsers, onUsersChange, disabled = false }: UserSelectorProps) {
  const [users, setUsers] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Fetch available users for selection
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true)
      try {
        const response = await fetch("http://localhost:8080/post-permissions/users", {
          credentials: "include",
        })
        
        if (response.ok) {
          const data = await response.json()
          setUsers(data.users || [])
        } else {
          toast.error("Failed to load users")
        }
      } catch (error) {
        console.error("Error fetching users:", error)
        toast.error("Failed to load users")
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [])

  const filteredUsers = users.filter(user =>
    user.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleUserToggle = (user: User) => {
    const isSelected = selectedUsers.some(u => u.id === user.id)
    
    if (isSelected) {
      onUsersChange(selectedUsers.filter(u => u.id !== user.id))
    } else {
      onUsersChange([...selectedUsers, user])
    }
  }

  const removeUser = (userId: number) => {
    onUsersChange(selectedUsers.filter(u => u.id !== userId))
  }

  const isUserSelected = (userId: number) => {
    return selectedUsers.some(u => u.id === userId)
  }

  return (
    <div className="space-y-4">
      {/* Selected Users Display */}
      {selectedUsers.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Selected Users ({selectedUsers.length})</label>
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
              >
                <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.nickname}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-3 h-3 text-blue-600" />
                  )}
                </div>
                <span className="font-medium">{user.nickname}</span>
                <button
                  type="button"
                  onClick={() => removeUser(user.id)}
                  disabled={disabled}
                  className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Selection Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700">
              {selectedUsers.length === 0 
                ? "Select users for private post..." 
                : `${selectedUsers.length} user${selectedUsers.length === 1 ? '' : 's'} selected`
              }
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedUsers.length > 0 && (
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                {selectedUsers.length}
              </div>
            )}
            <div className={`w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
            {/* Search Input */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Users List */}
            <div className="max-h-48 overflow-y-auto">
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
        )}
      </div>

      {/* Help Text */}
      <p className="text-sm text-gray-500">
        Select the followers who can view this private post. Only selected users will be able to see the content.
      </p>
    </div>
  )
} 