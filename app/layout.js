import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { AuthProvider } from "@/components/AuthContextProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Project Stargate",
  description: "ESP Research",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`w-screen max-h-screen ${inter.className}`}>
      <AuthProvider>
          <Header />
          {children}
      </AuthProvider>
      </body>
    </html>
  );
}
