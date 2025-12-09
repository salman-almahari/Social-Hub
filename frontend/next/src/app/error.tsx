"use client";

import { useEffect } from "react";
import ErrorPage from "./components/ErrorPage";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error caught:", error);
  }, [error]);

  return (
    <ErrorPage
      errorCode={500}
      title="Something went wrong!"
      message="We're experiencing technical difficulties. Please try again later."
      description="Our team has been notified and is working to fix the issue."
      showHomeButton={true}
      showBackButton={true}
      showRefreshButton={true}
    />
  );
} 