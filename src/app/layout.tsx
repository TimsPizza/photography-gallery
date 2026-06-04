import type { Metadata } from "next";
import { Geist, Geist_Mono, LXGW_WenKai_TC } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const lxgw = LXGW_WenKai_TC({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-lxgw",
});

export const metadata: Metadata = {
  title: "Photography Gallery",
  description: "Personal photography gallery metadata intake.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} ${lxgw.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
