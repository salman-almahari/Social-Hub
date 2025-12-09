"use client";

import { useRouter } from "next/navigation";
import { Home, RefreshCw, ArrowLeft, AlertTriangle, Search, Shield } from "lucide-react";

interface ErrorPageProps {
  errorCode: number;
  title: string;
  message: string;
  description?: string;
  showHomeButton?: boolean;
  showRefreshButton?: boolean;
  showBackButton?: boolean;
}

export default function ErrorPage({
  errorCode,
  title,
  message,
  description,
  showHomeButton = true,
  showRefreshButton = true,
  showBackButton = true,
}: ErrorPageProps) {
  const router = useRouter();

  const getErrorIcon = () => {
    switch (errorCode) {
      case 404:
        return <Search className="w-16 h-16 text-gray-400" />;
      case 401:
        return <Shield className="w-16 h-16 text-red-400" />;
      case 500:
        return <AlertTriangle className="w-16 h-16 text-orange-400" />;
      default:
        return <AlertTriangle className="w-16 h-16 text-gray-400" />;
    }
  };

  const getErrorColor = () => {
    switch (errorCode) {
      case 404:
        return "text-gray-600";
      case 401:
        return "text-red-600";
      case 500:
        return "text-orange-600";
      default:
        return "text-gray-600";
    }
  };

  const getErrorBgColor = () => {
    switch (errorCode) {
      case 404:
        return "bg-gray-50";
      case 401:
        return "bg-red-50";
      case 500:
        return "bg-orange-50";
      default:
        return "bg-gray-50";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className={`${getErrorBgColor()} rounded-3xl shadow-xl p-8 text-center`}>
          {/* Error Icon */}
          <div className="mb-6">
            {getErrorIcon()}
          </div>

          {/* Error Code */}
          <div className={`text-6xl font-bold ${getErrorColor()} mb-4`}>
            {errorCode}
          </div>

          {/* Error Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            {title}
          </h1>

          {/* Error Message */}
          <p className="text-gray-600 mb-4">
            {message}
          </p>

          {/* Optional Description */}
          {description && (
            <p className="text-sm text-gray-500 mb-6">
              {description}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {showHomeButton && (
              <button
                onClick={() => router.push("/ShowPosts")}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-600 to-sky-500 text-white rounded-xl hover:from-sky-700 hover:to-sky-600 transition-all font-medium"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            )}

            {showBackButton && (
              <button
                onClick={() => router.back()}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
            )}

            {showRefreshButton && (
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 