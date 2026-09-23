import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Note to Post",
  description: "A Telegram bot that turns channel notes into LinkedIn drafts, delivered back in Telegram.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
