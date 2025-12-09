"use client";

import { CreatePost } from "./posts";
import { Button } from "../components/button";
import { useRouter } from "next/navigation";

function Show() {
    const router = useRouter();
    console.log("Rendering Show component");
    
    return (
        <>
            <CreatePost />
        </>
    );
}

export default Show;
