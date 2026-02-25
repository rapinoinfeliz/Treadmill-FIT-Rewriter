import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-brand-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-brand-mono",
});

export const metadata: Metadata = {
  title: "Treadmill Corrector",
  description: "Rewrite treadmill speed and distance in .fit activity files.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body
        className={cn(
          sans.variable,
          mono.variable,
          "min-h-screen bg-background font-sans text-foreground antialiased"
        )}
      >
        <div className="min-h-screen">
          <main className="mx-auto w-full max-w-[1400px] p-4 md:p-7">{children}</main>
        </div>
      </body>
    </html>
  );
}
