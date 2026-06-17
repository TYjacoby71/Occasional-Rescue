"use client";

import { useState } from "react";
import { Bell, Check, Mail, MessageCircle } from "lucide-react";
import { C, display, btnGold } from "@/lib/theme";
import type { OccasionTile } from "@/lib/occasions";
import { joinWaitlist } from "@/lib/modules/onboarding";

// "Coming soon" sheet for occasions that aren't active yet. Captures an email or phone so we can
// reach out when the occasion launches (and remind ahead of the date). Mother's/Father's also
// note the spouse-vs-parent gift target (the seam for that flow when they go live).
export function GiftSheet({ occ, onClose }: { occ: OccasionTile; onClose: () => void }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pw = occ.key === "mothers_day" ? "mom" : occ.key === "fathers_day" ? "dad" : "parent";

  async function submit() {
    setBusy(true);
    setError(null);
    const isEmail = channel === "email";
    const res = await joinWaitlist({
      occasionType: occ.key,
      email: isEmail ? contact : undefined,
      phone: isEmail ? undefined : contact,
      emailOptIn: isEmail,
      smsOptIn: !isEmail,
    }).catch(() => ({ ok: false, reason: "Something went wrong. Try again." }));
    setBusy(false);
    if (res.ok) setDone(true);
    else setError(res.reason ?? "Couldn't save your contact.");
  }

  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(8,6,14,.6)", display: "flex", alignItems: "flex-end", zIndex: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="orx-rise" style={{ width: "100%", background: C.panel, borderRadius: "26px 26px 0 0", padding: "26px 22px 30px", border: `1px solid ${C.line}` }}>
        <div style={{ width: 40, height: 4, borderRadius: 999, background: C.line, margin: "0 auto 18px" }} />

        {done ? (
          <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
            <div style={{ width: 56, height: 56, margin: "0 auto 14px", borderRadius: 999, display: "grid", placeItems: "center", background: "radial-gradient(circle,rgba(235,180,92,.25),transparent 70%)" }}><Check size={30} color={C.gold} /></div>
            <h2 style={{ fontFamily: display, fontWeight: 500, fontSize: 25, margin: "0 0 6px" }}>You&apos;re on the list</h2>
            <p style={{ color: C.muted, fontSize: 14.5, margin: "0 auto", maxWidth: 280, lineHeight: 1.5 }}>
              We&apos;ll reach out the moment <b style={{ color: C.ivory }}>{occ.label}</b> is ready — and again before the date so you&apos;re never caught off guard.
            </p>
            <button onClick={onClose} style={{ ...btnGold, marginTop: 20, fontSize: 15 }}>Done</button>
          </div>
        ) : (
          <>
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

            <div style={{ marginTop: 20, padding: 16, borderRadius: 14, background: C.panel2, border: `1px solid ${C.line}` }}>
              <p style={{ margin: 0, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <Bell size={15} color={C.gold} /> We&apos;re starting with <b style={{ color: C.gold }}>anniversaries</b>. {occ.label} is coming soon.
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: C.muted }}>
                Leave a text or email and we&apos;ll tell you the moment it&apos;s live — no spam.
              </p>
            </div>

            {/* channel toggle */}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {([{ k: "email", t: "Email", Icon: Mail }, { k: "sms", t: "Text", Icon: MessageCircle }] as const).map((o) => {
                const on = channel === o.k;
                return (
                  <button key={o.k} onClick={() => { setChannel(o.k); setError(null); }} style={{ flex: 1, padding: "10px", borderRadius: 11, border: `1px solid ${on ? C.gold : C.line}`, background: on ? "rgba(235,180,92,.08)" : "transparent", color: on ? C.goldSoft : C.muted, fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <o.Icon size={15} />{o.t}
                  </button>
                );
              })}
            </div>

            <input
              value={contact}
              onChange={(e) => { setContact(e.target.value); setError(null); }}
              inputMode={channel === "email" ? "email" : "tel"}
              type={channel === "email" ? "email" : "tel"}
              placeholder={channel === "email" ? "you@example.com" : "(555) 123-4567"}
              style={{ width: "100%", marginTop: 10, padding: "14px 16px", borderRadius: 14, border: `1px solid ${error ? C.blush : C.line}`, background: C.panel, color: C.ivory, fontSize: 16 }}
            />
            {error && <p style={{ color: C.blush, fontSize: 12.5, margin: "8px 2px 0" }}>{error}</p>}

            <button onClick={submit} disabled={busy || !contact.trim()} style={{ ...btnGold, marginTop: 16, fontSize: 15, opacity: busy || !contact.trim() ? 0.6 : 1 }}>
              {busy ? "Saving…" : `Notify me about ${occ.label}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
