# Error Handling System

This document explains the comprehensive error handling system implemented in the social network application.

## Overview

The error handling system provides:
- Custom error pages for different HTTP status codes
- Global error boundary for catching JavaScript errors
- Utility functions for handling API errors
- Automatic redirection to appropriate error pages

## Error Pages

### 1. 404 Not Found (`/not-found.tsx`)
- **Triggered**: When a page doesn't exist
- **Features**: Search icon, gray theme, home and back buttons
- **Usage**: Automatically triggered by Next.js for non-existent routes

### 2. 500 Internal Server Error (`/error.tsx`)
- **Triggered**: When JavaScript errors occur
- **Features**: Alert triangle icon, orange theme, all action buttons
- **Usage**: Automatically triggered by Next.js for unhandled errors

### 3. 401 Unauthorized (`/unauthorized/page.tsx`)
- **Triggered**: When users try to access protected resources
- **Features**: Shield icon, red theme, login redirect
- **Usage**: Manually triggered by error handler

## Components

### ErrorPage Component (`/components/ErrorPage.tsx`)
A reusable component for displaying error pages with:
- Customizable error code, title, and message
- Different icons and colors based on error type
- Configurable action buttons (Home, Back, Refresh)

### ErrorBoundary Component (`/components/ErrorBoundary.tsx`)
A React error boundary that:
- Catches JavaScript errors in the component tree
- Prevents the entire app from crashing
- Displays a user-friendly error page

## Utility Functions

### Error Handler (`/utils/errorHandler.ts`)
Provides functions for handling API errors:

```typescript
import { useErrorHandler } from '../utils/errorHandler';

function MyComponent() {
  const { handleError } = useErrorHandler();

  const fetchData = async () => {
    try {
      const response = await fetch('/api/data');
      if (!response.ok) {
        throw { status: response.status, message: response.statusText };
      }
      // Handle success
    } catch (error) {
      handleError(error); // Automatically redirects to appropriate error page
    }
  };
}
```

## Integration

### 1. Global Error Boundary
The ErrorBoundary is already integrated in the main layout:

```typescript
// In layout.tsx
<ErrorBoundary>
  <AuthProvider>
    {/* Your app components */}
  </AuthProvider>
</ErrorBoundary>
```

### 2. API Error Handling
Use the error handler in your components:

```typescript
import { useErrorHandler } from '../utils/errorHandler';

export function MyComponent() {
  const { handleError } = useErrorHandler();

  const handleApiCall = async () => {
    try {
      const response = await fetch('/api/endpoint');
      if (!response.ok) {
        throw { 
          status: response.status, 
          message: await response.text() 
        };
      }
      // Handle success
    } catch (error) {
      handleError(error);
    }
  };
}
```

### 3. Manual Error Page Navigation
Navigate to error pages manually:

```typescript
import { useRouter } from 'next/navigation';

const router = useRouter();

// Navigate to specific error pages
router.push('/not-found');        // 404
router.push('/unauthorized');     // 401
// 500 is handled automatically by Next.js
```

## Error Types and Handling

### HTTP Status Codes
- **400**: Bad Request - Invalid data
- **401**: Unauthorized - Redirects to `/unauthorized`
- **403**: Forbidden - Access denied
- **404**: Not Found - Redirects to `/not-found`
- **409**: Conflict - Resource already exists
- **422**: Validation Error - Invalid input
- **429**: Too Many Requests - Rate limited
- **500**: Internal Server Error - Server error
- **502**: Bad Gateway - Service unavailable
- **503**: Service Unavailable - Try again later
- **504**: Gateway Timeout - Request timeout

### Network Errors
- **Network Error**: No internet connection
- **Timeout Error**: Request took too long
- **CORS Error**: Cross-origin request blocked

## Customization

### Custom Error Page
Create a custom error page:

```typescript
import ErrorPage from '../components/ErrorPage';

export default function CustomError() {
  return (
    <ErrorPage
      errorCode={403}
      title="Access Forbidden"
      message="You don't have permission to access this resource."
      description="Please contact an administrator if you believe this is an error."
      showHomeButton={true}
      showBackButton={true}
      showRefreshButton={false}
    />
  );
}
```

### Custom Error Boundary
Create a custom error boundary:

```typescript
import ErrorBoundary from '../components/ErrorBoundary';

function MyCustomErrorPage() {
  return (
    <div>
      <h1>Custom Error Page</h1>
      <p>Something went wrong in this component.</p>
    </div>
  );
}

<ErrorBoundary fallback={<MyCustomErrorPage />}>
  <MyComponent />
</ErrorBoundary>
```

## Best Practices

1. **Always handle API errors**: Use try-catch blocks and the error handler
2. **Provide meaningful error messages**: Help users understand what went wrong
3. **Log errors**: Use console.error or a logging service for debugging
4. **Test error scenarios**: Ensure error pages work correctly
5. **Graceful degradation**: Don't let errors break the entire application

## Testing Error Pages

### Test 404
Navigate to a non-existent route: `http://localhost:3000/non-existent-page`

### Test 500
Add this to any component to trigger a JavaScript error:
```typescript
throw new Error('Test error');
```

### Test 401
Try to access a protected resource without authentication

### Test API Errors
Make API calls that return error status codes 