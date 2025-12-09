"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth";
import {
  LogIn,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Shield,
  UserCheck,
  Globe,
  AlertCircle,
} from "lucide-react";

interface ValidationErrors {
  email?: string;
  password?: string;
}

export function Login() {
  const { setIsLoggedIn, setUser, setIsLoading, isLoggedIn, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      router.push("/ShowPosts");
    }
  }, [isLoggedIn, isLoading, router]);

  if (isLoading || isLoggedIn) {
    return null;
  }

  // Validation functions
  const validateEmail = (value: string): string | undefined => {
    if (!value.trim()) return "Email address is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value.trim())) return "Please enter a valid email address";
    return undefined;
  };

  const validatePassword = (value: string): string | undefined => {
    if (!value) return "Password is required";
    if (value.length < 1) return "Password is required";
    return undefined;
  };

  // Real-time validation
  const validateField = (field: string, value: string) => {
    let error: string | undefined;
    
    switch (field) {
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

    // Clear server error when user starts typing
    if (error) {
      setError("");
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
    
    newErrors.email = validateEmail(email);
    newErrors.password = validatePassword(password);

    setErrors(newErrors);
    
    // Mark all fields as touched
    setTouched({
      email: true,
      password: true
    });

    // Return true if no errors
    return !Object.values(newErrors).some(error => error !== undefined);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    
    // Validate all fields before submission
    if (!validateAllFields()) {
      setError("Please fix the errors before submitting");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("http://localhost:8080/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();

        setIsLoggedIn(true);
        setUser({ nickname: data.nickname });
        setIsLoading(false); 

        if (data.nickname) {
          localStorage.setItem("nickname", data.nickname);
          console.log("Nickname saved:", data.nickname);
        } else {
          console.warn("No nickname found in response:", data);
        }

        router.push("/ShowPosts");
        console.log("Login successful");
      } else {
        // Handle different response types
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          try {
            const errorData = await response.json();
            // Check for both 'message' and 'error' fields (backend uses 'error')
            setError(errorData.error || errorData.message || "Invalid email or password");
          } catch (jsonError) {
            setError("Invalid email or password");
          }
        } else {
          // Handle plain text responses
          try {
            const errorText = await response.text();
            setError(errorText || "Invalid email or password");
          } catch (textError) {
            setError("Invalid email or password");
          }
        }
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Network error - please try again later");
    } finally {
      setIsSubmitting(false);
    }
  };

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
    <div className="flex items-center justify-center min-h-screen min-w-max p-4">
      <div className="min-w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-sky-600 to-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">
            Sign in to your account to continue your journey
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-red-500" />
                <span className="text-red-700 font-medium">{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
                  disabled={isSubmitting}
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
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => handleFieldChange('password', e.target.value)}
                  onBlur={(e) => handleFieldBlur('password', e.target.value)}
                  disabled={isSubmitting}
                  className={`w-full pl-12 pr-12 py-3 border rounded-2xl focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200 hover:border-gray-400 ${getInputBorderClass('password')}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {renderError('password')}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-sky-600 to-sky-600 text-white rounded-2xl hover:from-sky-700 hover:to-sky-700 transform hover:scale-[1.02] transition-all duration-200 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:transform-none font-medium text-lg flex items-center justify-center space-x-2 shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>

            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-gray-600 mb-3">Don't have an account?</p>
              <button
                type="button"
                onClick={() => router.push("/register")}
                disabled={isSubmitting}
                className="px-6 py-3 text-rose-500 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium transform hover:scale-[1.02]"
              >
                Create Account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
