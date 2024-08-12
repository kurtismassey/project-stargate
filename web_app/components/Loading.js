"use client";
import Image from "next/image";
import { useRef, useEffect } from "react";
import gsap from "gsap";
import { Anton } from "next/font/google";

const anton = Anton({ weight: "400", subsets: ["latin"] });

export default function Loading() {
  const imageRef = useRef(null);

  useEffect(() => {
    gsap.to(imageRef.current, {
      scale: 1.1,
      duration: 1,
      ease: "power1.inOut",
      repeat: -1,
      yoyo: true,
    });
  }, []);

  return (
    <div className="w-full h-screen flex flex-col p-10 align-center text-center items-center justify-center">
      <Image
        ref={imageRef}
        width={75}
        height={75}
        src="/icon.png"
        alt="Project Stargate"
      ></Image>
      <h3 className={`mt-2 text-xs text-center uppercase ${anton.className}`}>
        Loading...
      </h3>
    </div>
  );
}
