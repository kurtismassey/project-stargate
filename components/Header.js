"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { signInWithGoogle, signOut } from "@/firebase/auth.js";
import { useRouter, usePathname } from "next/navigation";
import { Anton } from "next/font/google";
import gsap from "gsap";
import Image from "next/image";
import { useAuth } from "@/components/AuthContextProvider";

const anton = Anton({ weight: "400", subsets: ["latin"] });

export default function Header() {
  const { user } = useAuth();
  console.log("user: ", user);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const router = useRouter();
  const signOutButtonRef = useRef();
  const fillRef = useRef();
  const pathname = usePathname();

  async function handleSignOut(event) {
    event.preventDefault();
    await signOut();
  }

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setScriptLoaded(true);
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (scriptLoaded) {
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: (response) => {
          console.log(response);
        },
      });
      window.google.accounts.id.prompt();
    }
  }, [scriptLoaded]);

  useEffect(() => {
    if (signOutButtonRef.current && fillRef.current) {
      gsap.set(fillRef.current, {
        scaleY: 0,
        transformOrigin: "bottom",
      });
    }
  }, []);

  const handleMouseEnter = () => {
    if (fillRef.current) {
      gsap.to(fillRef.current, {
        opacity: 0.3,
        scaleY: 1,
        duration: 0.5,
        ease: "power2.out",
      });
    }
  };

  const handleMouseLeave = () => {
    if (fillRef.current) {
      gsap.to(fillRef.current, {
        opacity: 0.3,
        scaleY: 0,
        duration: 0.5,
        ease: "power2.in",
      });
    }
  };

  return (
    <>
      {pathname !== "/" && (
        <div className="w-full bg-black top-0 z-50">
          <header className="w-screen flex items-center">
            <Link
              href="/"
              className="flex flex-grow flex-inline items-center justify-start pr-5 pl-5"
            >
              <div className={`text-[35px] ${anton.className}`}>PROJECT</div>
              <Image
                src="/icon.png"
                alt="Project Stargate"
                width={75}
                height={75}
              />
              <div className={`text-[35px] ${anton.className}`}>STARGATE</div>
            </Link>
            <div className="flex flex-grow justify-end pr-10 pl-5">
              <p className="p-3 mr-5 font-bold">{user?.displayName || ""}</p>
              <Link
                ref={signOutButtonRef}
                className="p-3 rounded-[15px] border-2 border-cornsilk text-cornsilk relative overflow-hidden group"
                href="/"
                onClick={handleSignOut}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <span className="relative z-10">Sign Out</span>
                <span
                  className="absolute inset-0 bg-cornsilk opacity-0"
                  ref={fillRef}
                ></span>
              </Link>
            </div>
          </header>
        </div>
      )}
    </>
  );
}
