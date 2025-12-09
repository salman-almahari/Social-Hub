"use client";

import { useState } from "react";
import { Login } from "./login";

function Show() {
    console.log("Rendering Show component");

    
    return (
        <div>
            <Login />
        </div>
    );
}

export default Show;
