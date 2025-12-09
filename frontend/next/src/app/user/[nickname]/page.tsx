"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PublicProfile } from "../../profile/publicProfile";

export default function PublicProfilePage() {
    const { nickname } = useParams();
    const [profile, setProfile] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!nickname) return;

        fetch(`http://localhost:8080/user/${nickname}`, {
            method: "GET",
            credentials: "include",
        })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to load profile");
                return res.json();
            })
            .then((data) => setProfile(data))
            .catch((err) => {
                console.error(err);
                setError("Profile not found or is private.");
            });
    }, [nickname]);

    if (error) return <div className="text-red-600 text-center mt-10">{error}</div>;
    if (!profile) return <div className="text-center mt-10">Loading profile...</div>;

    return (
        <PublicProfile
            nickname={profile.nickname}
        />
    );
}
