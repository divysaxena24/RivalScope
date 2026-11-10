import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RivalScope - AI-Powered Competitive Intelligence",
  description: "Track competitor pricing, packaging shifts, and feature updates in real time with AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 font-sans">
        {children}
      </body>
    </html>
  );
}
