import ErrorPage from "../components/ErrorPage";

export default function Unauthorized() {
  return (
    <ErrorPage
      errorCode={401}
      title="Access Denied"
      message="You need to be logged in to access this page."
      description="Please sign in to your account to continue."
      showHomeButton={true}
      showBackButton={true}
      showRefreshButton={false}
    />
  );
} 