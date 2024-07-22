import { Inter } from "next/font/google";
import "./globals.css";
import { getAuthenticatedAppForUser } from "@/firebase/serverApp";
import Header from "@/components/Header";
import { cloneElement } from "react";

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: "Project Stargate",
  description: "ESP Research",
  icons: {
    icon: '/favicon.ico'
  }
};

export default async function RootLayout({ children }) {
  const { currentUser } = await getAuthenticatedAppForUser();

  return (
    <html lang="en">
      <body className={`w-screen max-h-screen ${inter.className}`}>
      <Header currentUser={currentUser?.toJSON()} />
      {cloneElement(children, { user: currentUser?.toJSON() })}
      </body>
    </html>
  );
}
