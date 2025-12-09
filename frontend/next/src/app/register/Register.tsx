"use client";
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import type React from "react"
import { toast } from "sonner"
import { UserPlus, Lock, Mail, Globe, Camera, X, AlertCircle } from "lucide-react"

interface ValidationErrors {
  firstName?: string;
  lastName?: string;
  gender?: string;
  age?: string;
  email?: string;
  password?: string;
}

export function Register() {
  const [nickname, setNickname] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [gender, setGender] = useState("")
  const [age, setAge] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [aboutMe, setAboutMe] = useState("")
  const [isPublic, setIsPublic] = useState("public")
  const [isLoading, setIsLoading] = useState(false)
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Validation functions
  const validateFirstName = (value: string): string | undefined => {
    if (!value.trim()) return "First name is required";
    if (value.trim().length < 2) return "First name must be at least 2 characters";
    if (value.trim().length > 50) return "First name must be less than 50 characters";
    if (!/^[a-zA-Z\s]+$/.test(value.trim())) return "First name can only contain letters and spaces";
    return undefined;
  };

  const validateLastName = (value: string): string | undefined => {
    if (!value.trim()) return "Last name is required";
    if (value.trim().length < 2) return "Last name must be at least 2 characters";
    if (value.trim().length > 50) return "Last name must be less than 50 characters";
    if (!/^[a-zA-Z\s]+$/.test(value.trim())) return "Last name can only contain letters and spaces";
    return undefined;
  };

  const validateGender = (value: string): string | undefined => {
    if (!value) return "Please select a gender";
    return undefined;
  };

  const validateAge = (value: string): string | undefined => {
    if (!value) return "Age is required";
    const ageNum = parseInt(value);
    if (isNaN(ageNum)) return "Please enter a valid age";
    if (ageNum < 13) return "You must be at least 13 years old";
    if (ageNum > 120) return "Please enter a valid age";
    return undefined;
  };

  const validateEmail = (value: string): string | undefined => {
    if (!value.trim()) return "Email address is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value.trim())) return "Please enter a valid email address";
    return undefined;
  };

  const validatePassword = (value: string): string | undefined => {
    if (!value) return "Password is required";
    if (value.length < 6) return "Password must be at least 6 characters";
    if (value.length > 128) return "Password must be less than 128 characters";
    return undefined;
  };

  // Real-time validation
  const validateField = (field: string, value: string) => {
    let error: string | undefined;
    
    switch (field) {
      case 'firstName':
        error = validateFirstName(value);
        break;
      case 'lastName':
        error = validateLastName(value);
        break;
      case 'gender':
        error = validateGender(value);
        break;
      case 'age':
        error = validateAge(value);
        break;
      case 'email':
        error = validateEmail(value);
        break;
      case 'password':
        error = validatePassword(value);
        break;
    }

    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };

  // Handle field changes with validation
  const handleFieldChange = (field: string, value: string) => {
    // Update the field value
    switch (field) {
      case 'firstName':
        setFirstName(value);
        break;
      case 'lastName':
        setLastName(value);
        break;
      case 'gender':
        setGender(value);
        break;
      case 'age':
        setAge(value);
        break;
      case 'email':
        setEmail(value);
        break;
      case 'password':
        setPassword(value);
        break;
    }

    // Mark field as touched
    setTouched(prev => ({
      ...prev,
      [field]: true
    }));

    // Validate if field has been touched
    if (touched[field]) {
      validateField(field, value);
    }
  };

  // Handle field blur (when user leaves the field)
  const handleFieldBlur = (field: string, value: string) => {
    setTouched(prev => ({
      ...prev,
      [field]: true
    }));
    validateField(field, value);
  };

  // Validate all fields
  const validateAllFields = (): boolean => {
    const newErrors: ValidationErrors = {};
    
    newErrors.firstName = validateFirstName(firstName);
    newErrors.lastName = validateLastName(lastName);
    newErrors.gender = validateGender(gender);
    newErrors.age = validateAge(age);
    newErrors.email = validateEmail(email);
    newErrors.password = validatePassword(password);

    setErrors(newErrors);
    
    // Mark all fields as touched
    setTouched({
      firstName: true,
      lastName: true,
      gender: true,
      age: true,
      email: true,
      password: true
    });

    // Return true if no errors
    return !Object.values(newErrors).some(error => error !== undefined);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setProfilePicture(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeProfilePicture = () => {
    setProfilePicture(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    
    // Validate all fields before submission
    if (!validateAllFields()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    setIsLoading(true)

    try {
      let avatarUrl = "";

      // Upload profile picture if selected
      if (profilePicture) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('avatar', profilePicture);

        const uploadResponse = await fetch('http://localhost:8080/upload-avatar-registration', {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          avatarUrl = uploadData.avatar_url;
        } else {
          throw new Error('Failed to upload profile picture');
        }
        setIsUploading(false);
      }

      const response = await fetch("http://localhost:8080/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          first_name: firstName,
          last_name: lastName,
          gender,
          age: Number.parseInt(age),
          email,
          password,
          about_me: aboutMe,
          is_public: isPublic,
          avatar_url: avatarUrl,
        }),
      })

      if (response.ok) {
        const responseData = await response.json()
        if (responseData.generated_nickname) {
          toast.success(`Registered Successfully! Your generated nickname is: ${responseData.generated_nickname}`)
        } else {
          toast.success("Registered Successfully!")
        }
        router.push("/login")
      } else {
        const errorText = await response.text()
        toast.error(errorText || "Registration failed!")
      }
    } catch (error) {
      toast.error("An error occurred during registration. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to render error message
  const renderError = (field: keyof ValidationErrors) => {
    if (touched[field] && errors[field]) {
      return (
        <div className="flex items-center mt-1 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 mr-1" />
          {errors[field]}
        </div>
      );
    }
    return null;
  };

  // Helper function to get input border class
  const getInputBorderClass = (field: keyof ValidationErrors) => {
    if (touched[field] && errors[field]) {
      return "border-red-500 focus:ring-red-500 focus:border-red-500";
    }
    return "border-gray-300 focus:ring-sky-500 focus:border-transparent";
  };

  return (
    <div className="min-h-lvh bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="min-w-max max-h-fit">
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
          {/* Profile Picture Section */}
          <div className="flex flex-col items-center space-y-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profile Picture <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-200 bg-gray-100 flex items-center justify-center">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-8 h-8 text-gray-400" />
                )}
              </div>
              
              {previewUrl && (
                <button
                  type="button"
                  onClick={removeProfilePicture}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploading}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Camera className="w-4 h-4" />
              <span>{previewUrl ? 'Change Picture' : 'Choose Picture'}</span>
            </button>
          </div>

          {/* Personal Information */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nickname <span className="text-gray-500 text-xs">(Optional)</span>
              </label>
              <input
                type="text"
                name="nickname"
                placeholder="Choose a unique nickname (optional)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200 hover:border-gray-400"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => handleFieldChange('firstName', e.target.value)}
                  onBlur={(e) => handleFieldBlur('firstName', e.target.value)}
                  disabled={isLoading}
                  className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200 hover:border-gray-400 ${getInputBorderClass('firstName')}`}
                />
                {renderError('firstName')}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => handleFieldChange('lastName', e.target.value)}
                  onBlur={(e) => handleFieldBlur('lastName', e.target.value)}
                  disabled={isLoading}
                  className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200 hover:border-gray-400 ${getInputBorderClass('lastName')}`}
                />
                {renderError('lastName')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  name="gender"
                  value={gender}
                  onChange={(e) => handleFieldChange('gender', e.target.value)}
                  onBlur={(e) => handleFieldBlur('gender', e.target.value)}
                  disabled={isLoading}
                  className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200 hover:border-gray-400 ${getInputBorderClass('gender')}`}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {renderError('gender')}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="age"
                  placeholder="Enter your age"
                  value={age}
                  onChange={(e) => handleFieldChange('age', e.target.value)}
                  onBlur={(e) => handleFieldBlur('age', e.target.value)}
                  min="13"
                  max="120"
                  disabled={isLoading}
                  className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200 hover:border-gray-400 ${getInputBorderClass('age')}`}
                />
                {renderError('age')}
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  onBlur={(e) => handleFieldBlur('email', e.target.value)}
                  disabled={isLoading}
                  className={`w-full pl-12 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200 hover:border-gray-400 ${getInputBorderClass('email')}`}
                />
              </div>
              {renderError('email')}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  name="password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => handleFieldChange('password', e.target.value)}
                  onBlur={(e) => handleFieldBlur('password', e.target.value)}
                  disabled={isLoading}
                  className={`w-full pl-12 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200 hover:border-gray-400 ${getInputBorderClass('password')}`}
                />
              </div>
              {renderError('password')}
              <p className="text-sm text-gray-500 mt-2">Minimum 6 characters required</p>
            </div>
          </div>

          {/* About Me Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              About Me <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <textarea
              name="aboutMe"
              placeholder="Tell us a bit about yourself..."
              value={aboutMe}
              onChange={(e) => setAboutMe(e.target.value)}
              disabled={isLoading}
              rows={4}
              maxLength={500}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200 hover:border-gray-400 resize-none"
            />
            <p className="text-sm text-gray-500 mt-2">
              {aboutMe.length}/500 characters
            </p>
          </div>

          {/* Privacy Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profile Privacy</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                name="isPublic"
                value={isPublic}
                onChange={(e) => setIsPublic(e.target.value)}
                disabled={isLoading}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200 hover:border-gray-400"
              >
                <option value="public">Public Profile</option>
                <option value="private">Private Profile</option>
              </select>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {isPublic === "public" 
                ? "Your profile will be visible to everyone" 
                : "Only approved followers can see your profile"
              }
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || isUploading}
            className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold py-3 px-6 rounded-2xl hover:from-sky-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
          >
            {isLoading || isUploading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                {isUploading ? "Uploading Picture..." : "Creating Account..."}
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <UserPlus className="w-5 h-5 mr-2" />
                Create Account
              </div>
            )}
          </button>

          {/* Login Link */}
          <div className="text-center">
            <p className="text-gray-600">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="text-sky-600 hover:text-sky-700 font-medium transition-colors duration-200"
              >
                Sign in here
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}