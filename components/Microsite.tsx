"use client";

import { useEffect, useState } from "react";
import { C, display, ui } from "@/lib/theme";
import { Flame } from "@/components/Flame";
import { lc } from "@/lib/story";
import type { ShareData } from "@/lib/modules/share";

// The public, unlocked share microsite at /s/[slug]. Composes the order's deliverables into one
// scrollable themed page (no watermark, no paywall). Read-only — rendered from persisted data.
export function Microsite({ data }: { data: ShareData }) {
  const kinds = data.kinds.length ? data.kinds : ["reel"];
  const who = data.pet || data.name || "you";

  return (
    <div style={{ minHeight: "100vh", background: "#0E0C16", display: "flex", justifyContent: "center", fontFamily: ui }}>
      <div style={{
        width: "100%", maxWidth: 430, minHeight: "100vh", position: "relative", overflow: "hidden",
        background: `radial-gradient(120% 60% at 50% -10%, #2A2238 0%, ${C.ink} 46%, #110E1A 100%)`,
        color: C.ivory, boxShadow: "0 0 80px rgba(0,0,0,.6)",
      }}>
        <div style={{ padding: "30px 22px 60px" }}>
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <Flame size={30} />
            <p style={{ color: C.blush, fontSize: 12, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", margin: "12px 0 0" }}>
              For {who}
            </p>
            <h1 style={{ fontFamily: display, fontWeight: 500, fontSize: 34, lineHeight: 1.1, margin: "6px 0 0" }}>
              A little something, made for you
            </h1>
          </div>

          {kinds.includes("reel") && <Reel data={data} />}
          {kinds.includes("poem") && data.poem && <Poem data={data} poem={data.poem} />}
          {kinds.includes("photobook") && data.story && <Book data={data} story={data.story} />}

          <p style={{ textAlign: "center", color: C.muted, fontSize: 12, marginTop: 40, lineHeight: 1.6 }}>
            Made with Occasion Rescue
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────  reel  ───────────────── */
function Reel({ data }: { data: ShareData }) {
  const slides: (string | null)[] = data.photos.length ? data.photos : [null, null, null];
  const captions = [
    data.story?.headline || "For you",
    data.reason ? `I love you because ${lc(data.reason)}` : "I love you, plainly",
    data.secret ? `Remember ${lc(data.secret)}?` : "Every ordinary day with you",
    "Happy anniversary",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 3600);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <div style={{ marginTop: 28, borderRadius: 22, overflow: "hidden", border: `1px solid ${C.line}`, position: "relative", aspectRatio: "4/5", background: "#0B0912" }}>
      {slides.map((s, i) => (
        <div key={i} style={{ position: "absolute", inset: 0, opacity: i === idx ? 1 : 0, transition: "opacity 1s ease" }}>
          {s
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={s} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", background: `linear-gradient(${140 + i * 40}deg,#3A2A45,#1A1426)` }} />}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(11,9,18,.1) 30%,rgba(11,9,18,.85))" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 24px 30px" }}>
            <p style={{ fontFamily: display, fontSize: 26, fontWeight: 500, lineHeight: 1.15, margin: 0 }}>{captions[i % captions.length]}</p>
          </div>
        </div>
      ))}
      <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 5 }}>
        {slides.map((_, i) => <span key={i} style={{ width: i === idx ? 16 : 5, height: 5, borderRadius: 999, background: i === idx ? C.gold : "rgba(246,240,232,.4)", transition: "all .3s" }} />)}
      </div>
    </div>
  );
}

/* ─────────────────  poem  ───────────────── */
function Poem({ data, poem }: { data: ShareData; poem: string[] }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ position: "relative", borderRadius: 18, padding: 8, background: `linear-gradient(145deg,${C.gold},#8A6A2E)` }}>
        <div style={{ position: "relative", borderRadius: 12, padding: "40px 28px 30px", background: `radial-gradient(120% 80% at 50% 0%,#241C32,#16111F)`, overflow: "hidden" }}>
          <div style={{ textAlign: "center" }}>
            <Flame size={22} />
            {poem.map((l, i) => l === ""
              ? <div key={i} style={{ height: 14 }} />
              : <p key={i} style={{ fontFamily: display, fontStyle: i === 0 ? "normal" : "italic", fontSize: i === 0 ? 15 : 19, letterSpacing: i === 0 ? ".18em" : "0", textTransform: i === 0 ? "uppercase" : "none", color: i === 0 ? C.blush : "#EDE5DA", margin: "4px 0", lineHeight: 1.5 }}>{l}</p>)}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.line}`, color: C.muted, fontSize: 12, letterSpacing: ".1em" }}>
              {(data.name || "YOU").toUpperCase()} · ANNIVERSARY
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────  book  ───────────────── */
function Book({ data, story }: { data: ShareData; story: { headline: string; body: string } }) {
  const cover = data.photos[0];
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ position: "relative", aspectRatio: "3/4", borderRadius: "6px 14px 14px 6px", overflow: "hidden", border: `1px solid ${C.line}`, boxShadow: "-6px 6px 0 rgba(0,0,0,.25)", background: C.panel }}>
        {cover
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(150deg,#3A2A45,#1A1426)" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(11,9,18,.35),rgba(11,9,18,.85))" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 28 }}>
          <span style={{ color: C.gold, letterSpacing: ".22em", fontSize: 11, textTransform: "uppercase" }}>Your Story</span>
          <h2 style={{ fontFamily: display, fontWeight: 500, fontSize: 30, lineHeight: 1.05, margin: "8px 0 8px" }}>The Story of Us</h2>
          <p style={{ color: "#EDE5DA", fontFamily: display, fontStyle: "italic", fontSize: 18, lineHeight: 1.5, margin: 0 }}>{story.body}</p>
        </div>
      </div>
    </div>
  );
}
