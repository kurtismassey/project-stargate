"use client";
import { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { Anton } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { useUserAuth } from "@/components/AuthContext";
import { ReactComponent as GoogleIcon } from "@/components/google.svg";

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
          href="/"
          onClick={handleGoogleSignIn}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="p-3 my-6"
        >
          <button className="gsi-material-button">
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  xmlnsXlink="http://www.w3.org/1999/xlink"
                  style={{ display: "block" }}
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  ></path>
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  ></path>
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  ></path>
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  ></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents">
                Sign in with Google
              </span>
              <span style={{ display: "none" }}>Sign in with Google</span>
            </div>
          </button>
        </Link>
      </div>
    </>
  );
}
