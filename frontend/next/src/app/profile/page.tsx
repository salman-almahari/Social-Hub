"use client";

import { useEffect, useState } from "react";
import { Profile } from "./profile";

function ProfilePage() {
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        try {
            const response = await fetch('http://localhost:8080/profile', {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch profile data');
            const data = await response.json();
            console.log('Profile data received:', data);
            console.log('Posts data:', data.posts);
            setUserData(data);
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!userData) {
        return <div>Error loading profile</div>;
    }

    // Ensure posts is always an array
    const safeUserData = {
        ...userData,
        posts: Array.isArray(userData.posts) ? userData.posts : []
    };

    return (
        <div>
            <Profile {...safeUserData} onProfileUpdate={fetchUserData} />
        </div>
    );
}

export default ProfilePage;
