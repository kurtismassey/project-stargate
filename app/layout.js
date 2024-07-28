import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { getTokens } from "next-firebase-auth-edge";
import { cookies } from "next/headers";
import { serverConfig, clientConfig } from "@/config";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Project Stargate",
  description: "ESP Research",
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function RootLayout({ children }) {
  
  const tokens = await getTokens(cookies(), {
    apiKey: clientConfig.apiKey,
    cookieName: serverConfig.cookieName,
    cookieSignatureKeys: serverConfig.cookieSignatureKeys,
    serviceAccount: serverConfig.serviceAccount,
  });

  return (
    <html lang="en">
      <body className={`w-screen max-h-screen ${inter.className}`}>
          <Header initialUser={tokens?.decodedToken} />
          {children}
      </body>
    </html>
  );
}
