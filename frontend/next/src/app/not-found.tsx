"use client";
import ErrorPage from "./components/ErrorPage";

export default function NotFound() {
  return (
    <ErrorPage
      errorCode={404}
      title="Page Not Found"
      message="The page you're looking for doesn't exist."
      description="It might have been moved, deleted, or you entered the wrong URL."
      showHomeButton={true}
      showBackButton={true}
      showRefreshButton={false}
    />
  );
} 