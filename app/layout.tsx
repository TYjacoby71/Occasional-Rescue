import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Occasion Rescue",
  description: "Forgot something? Breathe. We can fix this in three minutes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
