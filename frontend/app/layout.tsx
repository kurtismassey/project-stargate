import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Project Stargate",
  description: "ESP Research",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} antialiased h-full`}>
        <Providers>
          <div className="h-screen flex flex-col">
            <header className="w-full px-4 py-3 flex-shrink-0">
              <Header />
            </header>
            <main className="flex-1 w-full px-4 min-h-0 mb-4">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
