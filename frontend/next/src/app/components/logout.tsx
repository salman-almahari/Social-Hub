"use client";

import { useRouter } from 'next/navigation';
import { Button } from '../components/button';
import { useAuth } from '../context/auth';

export default function LogoutButton() {
    const { setIsLoggedIn, setUser } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            const response = await fetch('http://localhost:8080/logout', {
                method: 'POST',
                credentials: 'include',
            });

            if (response.ok) {
                localStorage.removeItem("nickname");
                setIsLoggedIn(false);
                setUser(null);
                router.push('/login');
            }
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return (
        <Button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
        >
            Logout
        </Button>
    );
}
