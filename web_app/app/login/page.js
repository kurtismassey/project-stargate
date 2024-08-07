"use client";
import { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { Anton } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { useUserAuth } from "@/components/AuthContext";

const anton = Anton({ weight: "400", subsets: ["latin"] });

export default function Login() {
  const { signInWithGoogle, user } = useUserAuth();
  const containerRef = useRef(null);
  const logoRef = useRef(null);
  const projectRef = useRef(null);
  const stargateRef = useRef(null);
  const titleRef = useRef(null);
  const signInButtonRef = useRef(null);
  const fillRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (
      logoRef.current &&
      projectRef.current &&
      stargateRef.current &&
      titleRef.current
    ) {
      const tl = gsap.timeline();

      const animateWord = (word) => {
        if (titleRef.current) {
          const colors = [
            "#065B84",
            "#FD4136",
            "#2283B0",
            "#01172C",
            "#FFFADC",
          ];
          titleRef.current.innerHTML = "";
          const letters = [];
          for (let i = 0; i < word.length; i++) {
            const letterSpan = document.createElement("span");
            letterSpan.textContent = word.charAt(i);
            letterSpan.style.color = colors[i % colors.length];
            titleRef.current.appendChild(letterSpan);
            letters.push(letterSpan);

            tl.fromTo(
              letterSpan,
              { opacity: 0 },
              { opacity: 1, duration: 0.1 },
              i * 0.05,
            );
          }

          tl.to(letters, {
            color: "#FFFADC",
            duration: 0.3,
            stagger: 0.02,
          });

          return letters;
        }
      };

      const letters = animateWord("PROJECT STARGATE");

      tl.to(letters, {
        opacity: 0,
        duration: 0.3,
        stagger: 0.02,
        onComplete: () => {
          gsap.set(titleRef.current, { display: "none" });
        },
      });

      gsap.set([projectRef.current, stargateRef.current], {
        opacity: 0,
        x: 0,
      });
      gsap.set(logoRef.current, {
        opacity: 0,
        scale: 0,
      });

      tl.to(logoRef.current, {
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: "back.out(1.7)",
      })
        .to(
          [projectRef.current, stargateRef.current],
          {
            opacity: 0,
            duration: 0.3,
          },
          "-=0.2",
        )
        .to(
          projectRef.current,
          {
            x: -105,
            opacity: 1,
            duration: 0.5,
            ease: "power4.out",
          },
          "-=0.1",
        )
        .to(
          stargateRef.current,
          {
            x: 115,
            opacity: 1,
            duration: 0.5,
            ease: "power4.out",
          },
          "<",
        );
    }
  }, []);

  useEffect(() => {
    if (signInButtonRef.current && fillRef.current) {
      gsap.set(fillRef.current, { scaleY: 0, transformOrigin: "bottom" });
    }
  }, []);

  async function handleGoogleSignIn(event) {
    event.preventDefault();
    setError("");

    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e.message);
    }
  }

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
      <div className="absolute w-full h-screen p-5 flex flex-col justify-center items-center">
        <div
          ref={containerRef}
          className="relative flex items-center justify-center w-full"
        >
          <h1
            ref={titleRef}
            className={`text-[35px] p-0 m-0 ${anton.className} absolute`}
          ></h1>
          <span
            ref={projectRef}
            className={`text-[42px] ${anton.className} absolute opacity-0 text-[#FFFADC]`}
          >
            PROJECT
          </span>
          <Image
            ref={logoRef}
            src="/icon.png"
            alt="Project Stargate"
            className="opacity-0 z-10"
            width={90}
            height={90}
          />
          <span
            ref={stargateRef}
            className={`text-[42px] ${anton.className} absolute opacity-0 text-[#FFFADC]`}
          >
            STARGATE
          </span>
        </div>
        <Link
          ref={signInButtonRef}
          href="/onboarding"
          prefetch={false}
          onClick={handleGoogleSignIn}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="p-3 px-6 rounded-full border-2 border-[#FFFADC] text-[#FFFADC] relative overflow-hidden group mt-8"
        >
          <span className="relative z-10">Sign In with Google</span>
          <span
            className="absolute inset-0 bg-[#FFFADC] opacity-0"
            ref={fillRef}
          ></span>
        </Link>
      </div>
    </>
  );
}
