"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { C, ui } from "@/lib/theme";
import { Dashboard } from "@/components/Dashboard";
import { GiftSheet } from "@/components/GiftSheet";
import type { OccasionTile } from "@/lib/occasions";

// Client shell for the dashboard. Occasions are fetched on the server (live occasion_config)
// and passed in; active tiles route into the rescue flow, inactive ones open the sheet.
export function Home({ occasions }: { occasions: OccasionTile[] }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<OccasionTile | null>(null);

  function onPick(o: OccasionTile) {
    if (o.active) router.push(`/${o.key}`);
    else setSheet(o);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0E0C16", display: "flex", justifyContent: "center", fontFamily: ui }}>
      <div style={{
        width: "100%", maxWidth: 430, minHeight: "100vh", position: "relative", overflow: "hidden",
        background: `radial-gradient(120% 60% at 50% -10%, #2A2238 0%, ${C.ink} 46%, #110E1A 100%)`,
        color: C.ivory, boxShadow: "0 0 80px rgba(0,0,0,.6)",
      }}>
        <Dashboard occasions={occasions} onPick={onPick} />
        {sheet && <GiftSheet occ={sheet} onClose={() => setSheet(null)} />}
      </div>
    </div>
  );
}
