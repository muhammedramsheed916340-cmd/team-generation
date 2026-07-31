import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TeamGen — AI Fantasy Cricket Team Generator + Direct Transfer",
  description: "Advanced AI team generation (GL/SL/H2H) with live match sync, toss-based regeneration, and direct fantasy transfer to Dream11 & My11Circle.",
  keywords: ["fantasy cricket", "team generator", "Dream11", "My11Circle", "GL", "SL", "H2H", "AI"],
  authors: [{ name: "TeamGen" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
