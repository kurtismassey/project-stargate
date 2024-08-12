"use client";

import { usePathname } from "next/navigation";
import { useUserAuth } from "@/components/AuthContext";
import Header from "@/components/Header";

export default function ContentWrapper({ children }) {
  const { user, loading } = useUserAuth();
  const pathname = usePathname();

  const showHeader = user && pathname !== "/login";

  return (
    <main className="flex-grow">
      {showHeader && <Header />}
      {children}
    </main>
  );
}
