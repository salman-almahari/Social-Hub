import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useRouter } from 'next/navigation';

interface User {
  nickname: string;
  profilePicture?: string;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  authError: string | null;
  retryAuth: () => void;
  setIsLoggedIn: (loggedIn: boolean) => void;
  setUser: (user: User | null) => void;
  setIsLoading: (loading: boolean) => void; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const checkAuthStatus = async (retryCount = 0) => {
    try {
      if (!isLoggedIn) {
        setIsLoading(true);
      }      
      setAuthError(null);

      const response = await fetch('http://localhost:8080/auth/status', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        let profilePicture = undefined;

        try {
          const profileRes = await fetch('http://localhost:8080/profile', { credentials: 'include' });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            profilePicture = profileData.profilePicture;
          }
        } catch (e) {
          console.warn('Failed to fetch profile for avatar:', e);
        }

        setIsLoggedIn(true);
        setUser({ nickname: data.nickname, profilePicture });
      } else {
        const errorText = await response.text();
        setAuthError(`Auth check failed: ${response.status} ${errorText}`);
        setIsLoggedIn(false);
        setUser(null);
      }
    } catch (error) {
      let errorMessage = "Could not connect to server";
      if (error instanceof TypeError) {
        errorMessage = "Network error: Failed to fetch";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setAuthError(errorMessage);
      setIsLoggedIn(false);
      setUser(null);

      if (error instanceof TypeError && retryCount === 0) {
        setTimeout(() => checkAuthStatus(1), 2000);
        return;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const retryAuth = () => {
    checkAuthStatus();
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoggedIn, 
      isLoading,
      authError,
      retryAuth,
      setIsLoggedIn,
      setUser,
      setIsLoading 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/login');
    }
  }, [isLoading, isLoggedIn, router]);

  if (isLoading) return <div>Loading...</div>;

  return <>{children}</>;
}
