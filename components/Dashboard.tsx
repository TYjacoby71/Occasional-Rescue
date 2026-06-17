"use client";

import { C, display } from "@/lib/theme";
import { type OccasionTile } from "@/lib/occasions";
import { Flame } from "@/components/Flame";
import { Bell, Lock } from "lucide-react";

// Ported from the prototype's <Dashboard/>. Renders the carousel from the live occasion_config
// rows passed down from the server. The first (lowest display_order) tile is featured.
export function Dashboard({ occasions, onPick }: { occasions: OccasionTile[]; onPick: (o: OccasionTile) => void }) {
  const featured = occasions[0];
  const rest = occasions.slice(1);
  if (!featured) return null;

  return (
    <div style={{ padding: "26px 22px 40px" }}>
      <div className="orx-rise" style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 30 }}>
        <Flame size={20} />
        <span style={{ fontWeight: 700, letterSpacing: ".14em", fontSize: 12, color: C.muted, textTransform: "uppercase" }}>
          Occasion Rescue
        </span>
      </div>

      <div className="orx-rise" style={{ animationDelay: ".05s" }}>
        <p style={{ margin: 0, color: C.blush, fontWeight: 600, fontSize: 13 }}>Forgot something?</p>
        <h1 style={{ fontFamily: display, fontWeight: 500, fontSize: 40, lineHeight: 1.05, margin: "6px 0 0" }}>
          Breathe. We can fix this in three minutes.
        </h1>
      </div>

      <button
        onClick={() => onPick(featured)}
        className="orx-rise"
        style={{
          animationDelay: ".12s", width: "100%", textAlign: "left", marginTop: 26, padding: 22,
          borderRadius: 22, border: `1px solid ${C.line}`, color: C.ivory, position: "relative",
          overflow: "hidden", background: `linear-gradient(135deg,#34263F 0%,#241B33 60%),${C.panel}`,
        }}
      >
        <div style={{
          position: "absolute", right: -30, top: -30, width: 150, height: 150, borderRadius: "50%",
          background: "radial-gradient(circle,rgba(235,180,92,.35),transparent 70%)", animation: "orxGlow 1.2s ease both",
        }} />
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700,
          letterSpacing: ".12em", textTransform: "uppercase", color: C.ink, background: C.gold,
          padding: "5px 10px", borderRadius: 999,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: C.ink }} />{featured.date}
        </span>
        <h2 style={{ fontFamily: display, fontWeight: 500, fontSize: 30, margin: "14px 0 4px" }}>{featured.label}</h2>
        <p style={{ margin: 0, color: C.muted, fontSize: 14.5 }}>
          Last-minute? Start here. A keepsake they&apos;ll actually keep.
        </p>
        <span style={{ display: "inline-block", marginTop: 16, color: C.gold, fontWeight: 600, fontSize: 14 }}>
          Rescue this →
        </span>
      </button>

      <p style={{ margin: "30px 0 12px", fontSize: 12, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: C.muted }}>
        Other dates
      </p>
      <div className="orx-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", margin: "0 -22px", padding: "0 22px 6px" }}>
        {rest.map((o) => {
          const soon = !o.active;
          return (
            <button
              key={o.key}
              onClick={() => onPick(o)}
              aria-label={soon ? `${o.label} — coming soon, get notified` : o.label}
              style={{
                flex: "0 0 auto", width: 132, textAlign: "left", padding: 16, borderRadius: 18,
                position: "relative", color: soon ? C.muted : C.ivory,
                background: soon ? "transparent" : C.panel,
                border: soon ? `1px dashed ${C.line}` : `1px solid ${C.line}`,
                opacity: soon ? 0.78 : 1,
              }}
            >
              {soon && (
                <span style={{ position: "absolute", top: 10, right: 10, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted, border: `1px solid ${C.line}`, borderRadius: 999, padding: "2px 6px" }}>
                  <Lock size={9} /> Soon
                </span>
              )}
              <div style={{ width: 30, height: 30, borderRadius: 9, background: C.panel2, display: "grid", placeItems: "center", marginBottom: 12, color: soon ? C.muted : C.gold }}>
                <Flame size={15} glow={false} />
              </div>
              <div style={{ fontFamily: display, fontWeight: 500, fontSize: 19, lineHeight: 1.1, color: soon ? "#C9BFD4" : C.ivory }}>{o.label}</div>
              <div style={{ color: C.muted, fontSize: 12.5, marginTop: 4 }}>{o.date}</div>
              {soon
                ? <div style={{ color: C.blush, fontSize: 11, marginTop: 8, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}><Bell size={11} /> Notify me</div>
                : o.giftTarget && <div style={{ color: C.blush, fontSize: 11, marginTop: 6, fontWeight: 600 }}>Spouse or parent</div>}
            </button>
          );
        })}
      </div>

      <p style={{ marginTop: 26, color: C.muted, fontSize: 12.5, lineHeight: 1.5, textAlign: "center" }}>
        We only reach out before dates you ask us to remember. No spam, ever.
      </p>
    </div>
  );
}
