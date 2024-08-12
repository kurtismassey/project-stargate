"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUserAuth } from "@/components/AuthContext";
import { db } from "@/firebase/clientApp";
import { doc, setDoc } from "firebase/firestore";
import Sessions from "@/components/Sessions";

export default function Home() {
  const router = useRouter();
  const { user } = useUserAuth();
  const [isCreating, setIsCreating] = useState(false);

  const createNewSession = async () => {
    setIsCreating(true);

    try {
      const newSessionId = Date.now().toString();

      await setDoc(doc(db, "sessions", newSessionId), {
        userId: user.uid,
        createdAt: new Date(),
        lastUpdated: new Date(),
      });

      router.push(`/session/${newSessionId}`);
    } catch (error) {
      console.error("Error creating new session:", error);
      setIsCreating(false);
    }
  };

  return (
    <div className="mt-[80px] w-full h-screen flex flex-inline items-center justify-center">
      <div className="w-full h-full align-center px-14 my-5">
        <h1 className="text-2xl font-bold mb-4 text-white text-center">
          Sessions
        </h1>
        <button
          onClick={createNewSession}
          disabled={isCreating}
          className="w-full outline outline-white text-white font-bold my-2 mr-[50px] py-2 px-4 rounded hover:bg-white hover:text-black disabled:opacity-50"
        >
          {isCreating ? "CREATING..." : "START NEW SESSION"}
        </button>
        <Sessions />
      </div>
    </div>
  );
}
