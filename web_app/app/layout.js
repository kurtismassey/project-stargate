import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthContext";
import ContentWrapper from "@/components/ContentWrapper";

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
      <body
        className={`max-h-screen h-screen w-screen bg-black ${inter.className}`}
      >
        <AuthProvider>
          <ContentWrapper>{children}</ContentWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
