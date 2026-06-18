"use client";

import { useEffect } from "react";

// Registers the service worker once on the client. The SW (plus the manifest + icons) is what makes
// the app installable as a home-screen tile on Android/Chrome. No-ops where SW is unsupported.
export function RegisterSW() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
