import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LINE + Qwen Secretary Bot",
  description: "A reusable Next.js LINE bot starter powered by Qwen.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
