import type { Metadata } from "next";
import "./globals.css";
import {siteProfile} from "@/profile/site";

export const metadata: Metadata = {
  title: siteProfile.pageTitle,
  description: siteProfile.description,
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
