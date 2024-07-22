'use client';
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { Anton } from "next/font/google";
import { useRouter } from 'next/navigation';

const anton = Anton({ weight: '400', subsets: ['latin'] });

export default function Introduction() {
    const logoRef = useRef(null);
    const projectRef = useRef(null);
    const stargateRef = useRef(null);
    const titleRef = useRef(null);
    const router = useRouter();

    useLayoutEffect(() => {
        const animateWord = (word, index) => {
            const colors = ["#065B84", "#FD4136", "#2283B0", "#01172C", "#FFFADC"];
            titleRef.current.innerHTML = "";
            for (let i = 0; i < word.length; i++) {
                const letterSpan = document.createElement('span');
                letterSpan.textContent = word.charAt(i);
                letterSpan.style.color = colors[i % colors.length];
                titleRef.current.appendChild(letterSpan);
                gsap.fromTo(letterSpan, 
                    { opacity: 0 }, 
                    { 
                        opacity: 1, 
                        duration: 0.8, 
                        delay: i * 0.05,
                        onComplete: () => {
                            letterSpan.style.color = "#FFFADC";
                            setTimeout(animateLogo, 1000);
                        }
                    }
                );
            }
        };

        const animateWords = () => {
            gsap.delayedCall(0, () => animateWord('PROJECT STARGATE', 0));
        };

        const animateLogo = () => {
            gsap.set(logoRef.current, { opacity: 0, scale: 0 });
            gsap.set([projectRef.current, stargateRef.current], { opacity: 0, y: 0 });

            gsap.to(logoRef.current, {
                opacity: 1,
                scale: 1,
                duration: 0.3,
                ease: "sine.in",
                onComplete: () => {
                    gsap.to(titleRef.current, { opacity: 0, duration: 0.3 });
                    gsap.to([projectRef.current, stargateRef.current], { opacity: 1, duration: 0.3 });
                    gsap.to(projectRef.current, { x: -105, duration: 0.15, ease: "expo.out" });
                    gsap.to(stargateRef.current, { x: 70, duration: 0.15, ease: "expo.out" });                    
                }
            });
        };

        gsap.set([logoRef.current, projectRef.current, stargateRef.current], { opacity: 0 });
        animateWords();

    }, [router]);

    return (
        <>
            <div className="absolute w-full h-screen p-5 flex flex-col justify-center items-center">
                <div className="absolute flex items-center">
                    <span ref={projectRef} className={`text-[35px] ${anton.className} absolute opacity-0`}>PROJECT</span>
                    <img ref={logoRef} src="/icon.png" alt="Project Stargate" className="w-[75px] opacity-0" />
                    <span ref={stargateRef} className={`text-[35px] ${anton.className} absolute opacity-0`}>STARGATE</span>
                </div>
                <h1 ref={titleRef} className={`text-[35px] p-0 m-0 ${anton.className}`}></h1>
            </div>
        </>
    );
};
