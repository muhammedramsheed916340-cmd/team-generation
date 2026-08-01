import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "./tg-theme.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Team Generation — Dream11 Team Generator (GL/SL/H2H)",
  description: "India's best software to create Grand League winning teams in Dream11. Generate GL, SL, H2H teams with AI. Direct transfer to Dream11 & My11Circle.",
  keywords: ["team generation", "dream11", "team generator", "GL", "SL", "H2H", "grand league", "fantasy cricket"],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${geistSans.variable} antialiased bg-[#131314] text-[#e8eaed]`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
