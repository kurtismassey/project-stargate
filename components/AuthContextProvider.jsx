"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "@/firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { firebaseConfig } from "@/firebase/config";
import Loading from "./Loading";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const serializedFirebaseConfig = encodeURIComponent(
        JSON.stringify(firebaseConfig),
      );
      const serviceWorkerUrl = `/auth-service-worker.js?firebaseConfig=${serializedFirebaseConfig}`;
      navigator.serviceWorker
        .register(serviceWorkerUrl)
        .then((registration) => console.log("scope is: ", registration.scope))
        .catch((error) =>
          console.error("Service worker registration failed:", error),
        );
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((authUser) => {
      setUser(authUser)
      router.refresh()
      setLoading(false)
    })
  
    return () => unsubscribe()
  }, []);

  useEffect(() => {
    onAuthStateChanged((authUser) => {
      router.refresh()
      if (router.isReady) {
        if (!authUser && pathname !== "/") {
          router.push("/")
        }
      } else if (!authUser && !router.isReady && pathname !== "/") {
        window.location.replace("/")
      }
    })
  }, [user, router.isReady])

  return (
    <AuthContext.Provider value={{ user, setLoading }}>
      {loading ? (<Loading/>) : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
