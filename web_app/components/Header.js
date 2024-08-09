"use client";
import { useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUserAuth } from "@/components/AuthContext";
import Link from "next/link";
import { Anton } from "next/font/google";
import Image from "next/image";
import gsap from "gsap";

const anton = Anton({ weight: "400", subsets: ["latin"] });

export default function Header() {
  const { user, loading, logOut } = useUserAuth();
  const router = useRouter();
  const signOutButtonRef = useRef();
  const fillRef = useRef();
  const pathname = usePathname();

  async function handleLogout() {
    try {
      await logOut();
    } catch (error) {
      console.error("Failed to log out", error);
    }
  }

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

  if (pathname.includes("mobile")) {
    return null;
  }

  return (
    <>
      {!user ? null : (
        <>
          <div className="w-full fixed top-0 z-50 p-3 bg-black">
            <header className="w-screen flex items-center">
              <Link
                href="/"
                className="flex flex-grow items-center justify-start pr-5 pl-5"
              >
                <div className={`text-[25px] ${anton.className}`}>PROJECT</div>
                <Image
                  src="/icon.png"
                  alt="Project Stargate"
                  width={55}
                  height={55}
                />
                <div className={`text-[25px] ${anton.className}`}>STARGATE</div>
              </Link>
              <div className="flex flex-grow justify-end pr-10 pl-5">
                <p className="p-3 mr-5 font-bold">{user?.displayName || ""}</p>
                <Link
                  ref={signOutButtonRef}
                  prefetch={false}
                  className="flex items-center justify-center px-3 py-1 rounded-[5px] border-2 border-cornsilk text-cornsilk relative overflow-hidden group"
                  href="/login"
                  onClick={(e) => {
                    e.preventDefault(); // Prevent default link behavior
                    handleLogout(); // Call handleLogout directly
                  }}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <span className="relative text-xs z-10">Sign Out</span>
                  <span
                    className="absolute inset-0 bg-cornsilk opacity-0"
                    ref={fillRef}
                  ></span>
                </Link>
              </div>
            </header>
          </div>
        </>
      )}
    </>
  );
}
