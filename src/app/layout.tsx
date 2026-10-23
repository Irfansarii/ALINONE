import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MySpace Vault — Your personal content, locally",
  description: "A private, local-first vault for photos, videos, documents, notes, links and code snippets.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
