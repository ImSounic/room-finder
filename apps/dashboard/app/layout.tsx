import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Room Finder",
  description: "Enschede housing alerts",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">{children}</body>
    </html>
  );
}
