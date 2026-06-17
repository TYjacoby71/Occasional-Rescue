"use client";

import { C, ui } from "@/lib/theme";
import { Dashboard } from "@/components/Dashboard";
import type { OccasionTile } from "@/lib/occasions";

// Phase 0 home. Renders the dashboard inside the prototype's phone frame.
// Tile tap is stubbed until Phase 2 wires the lead-intake flow + draft orders.
export default function Page() {
  function onPick(o: OccasionTile) {
    // Phase 2: active -> /[occasion] intake; inactive -> "coming soon" gift sheet.
    console.log("picked occasion:", o.key, "active:", o.active);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0E0C16", display: "flex", justifyContent: "center", fontFamily: ui }}>
      <div
        style={{
          width: "100%", maxWidth: 430, minHeight: "100vh", position: "relative", overflow: "hidden",
          background: `radial-gradient(120% 60% at 50% -10%, #2A2238 0%, ${C.ink} 46%, #110E1A 100%)`,
          color: C.ivory, boxShadow: "0 0 80px rgba(0,0,0,.6)",
        }}
      >
        <Dashboard onPick={onPick} />
      </div>
    </div>
  );
}
