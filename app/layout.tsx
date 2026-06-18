import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "./register-sw";

export const metadata: Metadata = {
  title: "Occasion Rescue",
  description: "Forgot something? Breathe. We can fix this in three minutes.",
  // Installable-tile metadata. `manifest` links the Web App Manifest; `appleWebApp` + the apple
  // touch icon let iOS "Add to Home Screen" launch it full-screen with the brand icon.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Rescue",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

// Mobile-first viewport: fit the device width, allow pinch-zoom for accessibility, paint the
// notch/status bar in the app's dark plum so the standalone tile feels native.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0E0C16",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
