import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JY Hotels Acquisition Map",
  description: "A Vercel-ready acquisition desk for UK hospitality property scouting."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
