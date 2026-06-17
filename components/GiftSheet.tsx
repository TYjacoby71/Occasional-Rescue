"use client";

import { useState } from "react";
import { C, display, btnGold } from "@/lib/theme";
import type { OccasionTile } from "@/lib/occasions";

// "Coming soon" sheet for occasions that aren't active yet. Mother's/Father's also
// capture the spouse-vs-parent gift target (the seam for that flow when they go live).
export function GiftSheet({ occ, onClose }: { occ: OccasionTile; onClose: () => void }) {
  const [choice, setChoice] = useState<string | null>(null);
  const pw = occ.key === "mothers_day" ? "mom" : occ.key === "fathers_day" ? "dad" : "parent";
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(8,6,14,.6)", display: "flex", alignItems: "flex-end", zIndex: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="orx-rise" style={{ width: "100%", background: C.panel, borderRadius: "26px 26px 0 0", padding: "26px 22px 30px", border: `1px solid ${C.line}` }}>
        <div style={{ width: 40, height: 4, borderRadius: 999, background: C.line, margin: "0 auto 18px" }} />
        <h2 style={{ fontFamily: display, fontWeight: 500, fontSize: 27, margin: "0 0 4px" }}>{occ.label}</h2>
        {occ.giftTarget ? (
          <>
            <p style={{ color: C.muted, fontSize: 14.5, marginTop: 0 }}>Who&apos;s this one for?</p>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {[{ k: "spouse", t: "My spouse" }, { k: "parent", t: `My ${pw}` }].map((o) => (
                <button key={o.k} onClick={() => setChoice(o.k)} style={{ flex: 1, padding: "16px", borderRadius: 14, border: `1px solid ${choice === o.k ? C.gold : C.line}`, background: choice === o.k ? "rgba(235,180,92,.08)" : C.panel2, color: C.ivory, fontFamily: display, fontSize: 19, fontWeight: 500 }}>{o.t}</button>
              ))}
            </div>
          </>
        ) : (
          <p style={{ color: C.muted, fontSize: 14.5, marginTop: 0 }}>{occ.date}</p>
        )}
        <div style={{ marginTop: 22, padding: 16, borderRadius: 14, background: C.panel2, border: `1px solid ${C.line}` }}>
          <p style={{ margin: 0, fontSize: 14 }}>We&apos;re starting with <b style={{ color: C.gold }}>anniversaries</b>. {occ.label} is coming soon.</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: C.muted }}>Want a heads-up before it? One text — no spam.</p>
        </div>
        <button onClick={onClose} style={{ ...btnGold, marginTop: 16, fontSize: 15 }}>Remind me before {occ.label}</button>
      </div>
    </div>
  );
}
