import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOPSMMA Call Hub",
  description: "Cold call queue, pipeline and P&L tracker for TOPSMMA",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
