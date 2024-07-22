'use client'
import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
	signInWithGoogle,
	signOut,
	onAuthStateChanged
} from "@/firebase/auth.js";
import { useRouter } from "next/navigation";
import { firebaseConfig } from "@/firebase/config";
import { Anton } from "next/font/google";

const anton = Anton({ weight: '400', subsets: ['latin'] });

export function useUserSession(initialUser) {
	const [user, setUser] = useState(initialUser);
	const router = useRouter();

	useEffect(() => {
		if ("serviceWorker" in navigator) {
			const serializedFirebaseConfig = encodeURIComponent(JSON.stringify(firebaseConfig));
			const serviceWorkerUrl = `/auth-service-worker.js?firebaseConfig=${serializedFirebaseConfig}`
		
		  navigator.serviceWorker
			.register(serviceWorkerUrl)
			.then((registration) => console.log("scope is: ", registration.scope));
		}
	  }, []);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged((authUser) => {
			setUser(authUser)
		})

		return () => unsubscribe()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		onAuthStateChanged((authUser) => {
			if (user === undefined) return

			if (user?.email !== authUser?.email) {
				router.refresh()
			}
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user])

	return user;
}

export default function Header({currentUser}) {
  const user = useUserSession(currentUser) ;
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const router = useRouter();

	const handleSignOut = event => {
		event.preventDefault();
		signOut();
		router.push("/")
	};

	const handleSignIn = event => {
		event.preventDefault();
		signInWithGoogle();
		router.push("/onboarding")
	};

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
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
          console.log(response)
        }
      });
      window.google.accounts.id.prompt()
    }
  }, [scriptLoaded])


	return (
		<>
			{user ? (
				<header className="w-screen flex items-center">
				<Link href="/" className="flex flex-grow flex-inline items-center justify-start pr-5 pl-5">
				<div className={`text-[35px] ${anton.className}`}>PROJECT</div>
				<img src="/icon.png" alt="Project Stargate" className="w-[75px]" />
				<div className={`text-[35px] ${anton.className}`}>STARGATE</div>
            	</Link>
				<div className="flex flex-grow justify-end pr-10 pl-5">
					<p className="p-3 mr-5 font-bold">{user.displayName}</p>
					<Link className="p-3 rounded-[15px] hover:font-bold" style={{ backgroundColor: "cornsilk", color: "black" }} href="/" onClick={handleSignOut}>
						Sign Out
					</Link>
				</div>
				</header>
			) : (
				<header className="w-full flex items-center">
				<div className="w-full flex justify-end pr-5 pl-5 mt-3">
					<Link href="/" onClick={handleSignIn} className="p-3 rounded-[15px] hover:font-bold" style={{ backgroundColor: "cornsilk", color: "black" }}>
					Sign In with Google
					</Link>
				</div>
				</header>
			)}
		</>
	);
}