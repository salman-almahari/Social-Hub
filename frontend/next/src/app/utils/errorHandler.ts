import { useRouter } from "next/navigation";

export interface ApiError {
  status: number;
  message: string;
  details?: string;
}

export const handleApiError = (error: any, router: any) => {
  console.error("API Error:", error);

  let status = 500;
  let message = "An unexpected error occurred";

  // Handle different types of errors
  if (error.status) {
    status = error.status;
  } else if (error.response?.status) {
    status = error.response.status;
  }

  // Set appropriate message based on status
  switch (status) {
    case 400:
      message = "Bad Request - Invalid data provided";
      break;
    case 401:
      message = "Unauthorized - Please log in to continue";
      router.push("/unauthorized");
      return;
    case 403:
      message = "Forbidden - You don't have permission to access this resource";
      break;
    case 404:
      message = "Not Found - The requested resource was not found";
      router.push("/not-found");
      return;
    case 409:
      message = "Conflict - The resource already exists";
      break;
    case 422:
      message = "Validation Error - Please check your input";
      break;
    case 429:
      message = "Too Many Requests - Please try again later";
      break;
    case 500:
      message = "Internal Server Error - Please try again later";
      break;
    case 502:
      message = "Bad Gateway - Service temporarily unavailable";
      break;
    case 503:
      message = "Service Unavailable - Please try again later";
      break;
    case 504:
      message = "Gateway Timeout - Request timed out";
      break;
    default:
      message = "An unexpected error occurred";
  }

  // For non-redirect errors, you might want to show a toast or modal
  // For now, we'll just log them
  console.error(`Error ${status}: ${message}`);
  
  return {
    status,
    message,
    details: error.message || error.details
  };
};

// Hook for handling API errors in components
export const useErrorHandler = () => {
  const router = useRouter();

  const handleError = (error: any) => {
    return handleApiError(error, router);
  };

  return { handleError };
};

// Function to check if an error is a network error
export const isNetworkError = (error: any): boolean => {
  return (
    error.message === "Network Error" ||
    error.message === "Failed to fetch" ||
    error.code === "NETWORK_ERROR" ||
    !navigator.onLine
  );
};

// Function to check if an error is a timeout error
export const isTimeoutError = (error: any): boolean => {
  return (
    error.message === "timeout of 5000ms exceeded" ||
    error.code === "ECONNABORTED" ||
    error.name === "TimeoutError"
  );
}; 