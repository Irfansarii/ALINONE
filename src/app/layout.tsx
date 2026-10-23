import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MySpace Vault — Your personal content, locally",
  description: "A private, local-first vault for photos, videos, documents, notes, links and code snippets.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MySpace Vault",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#6366f1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
