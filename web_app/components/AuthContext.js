"use client";
import { createContext, useState, useContext, useEffect } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { auth } from "@/firebase/clientApp";
import { useRouter } from "next/navigation";
import Loading from "@/components/Loading";

export const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js", { scope: "/" })
        .then((reg) => {
          console.log("Service Worker registered with scope:", reg.scope);
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener("message", async (event) => {
        if (event.data.type === "REDIRECT") {
          setLoading(true);
          try {
            window.location.href = event.data.url;
          } finally {
            setLoading(false);
          }
        }
      });
    }

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      setLoading(false);
      router.refresh();
    });

    return () => unsubscribe();
  }, [router]);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      window.location.href = "/";
    } catch (error) {
      console.error("Error signing in: ", error);
    } finally {
      setLoading(false);
    }
  };

  const logOut = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.error("Error logging out: ", error);
    } finally {
      setLoading(false);
    }
  };

  const authValue = {
    user,
    signInWithGoogle,
    logOut,
    loading,
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
  );
}

export function useUserAuth() {
  return useContext(AuthContext);
}
