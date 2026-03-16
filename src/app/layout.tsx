import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next Hello",
  description: "Hello world app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
