import type { MetadataRoute } from "next";

// Web App Manifest — makes the app installable as a home-screen tile (standalone, no browser chrome).
// Served at /manifest.webmanifest and linked automatically by Next from the root metadata.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Occasion Rescue",
    short_name: "Rescue",
    description: "Forgot something? Breathe. We can fix this in three minutes.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0E0C16",
    theme_color: "#0E0C16",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
