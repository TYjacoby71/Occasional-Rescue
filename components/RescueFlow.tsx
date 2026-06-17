"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Copy, Check, Bell, MessageCircle, Mail, ImagePlus, X,
  Play, Pause, Download, Gift as GiftIcon, Ticket, RefreshCw, Lock,
} from "lucide-react";
import { C, display, ui, btnGold } from "@/lib/theme";
import { priceFor } from "@/lib/config";
import { buildStory, buildPoem, FREE_POEM_REWORKS, lc, cap, type Tone } from "@/lib/story";
import { GIFTS, TIERS, giftByKey, giftsByTier, isAvailable, isPrint, needsCheckout, type GiftKey } from "@/lib/gifts";
import { daysUntil, computedEventDate, leadLabel } from "@/lib/occasion/lead-time";
import { Flame } from "@/components/Flame";
import { Paywall } from "@/components/Paywall";
import { PrintOrder } from "@/components/PrintOrder";
import type { OccasionType } from "@/lib/database.types";
import { createDraftOrder, saveIntake, logEvent } from "@/lib/modules/intake";
import { generateDeliverables, reworkPoem as requestPoemRework } from "@/lib/modules/generation";
import { uploadAsset } from "@/lib/modules/assets";
import { publishShare } from "@/lib/modules/share";
import { setupReminder } from "@/lib/modules/onboarding";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Occasion = { key: OccasionType; label: string; dateRule: string; giftTarget?: boolean };
type FlowScreen = "intake" | "gen" | "preview" | "done";
type Data = {
  name: string; pet: string; eventDate: string; photos: string[];
  secret: string; reason: string; tone: Tone; picks: GiftKey[];
};

export function RescueFlow({ occasion }: { occasion: Occasion }) {
  const router = useRouter();
  const [screen, setScreen] = useState<FlowScreen>("intake");
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>({
    name: "", pet: "", eventDate: "", photos: [], secret: "", reason: "", tone: "heartfelt", picks: [],
  });
  const [story, setStory] = useState<ReturnType<typeof buildStory> | null>(null);
  const [poem, setPoem] = useState<string[] | null>(null);
  const [poemVariant, setPoemVariant] = useState(0); // which draft index is showing
  const [poemReworks, setPoemReworks] = useState(0); // free reworks spent before the paywall
  const [reworking, setReworking] = useState(false); // an LLM rework is in flight
  const [active, setActive] = useState<GiftKey>("reel");
  const [unlocked, setUnlocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const orderId = useRef<string | null>(null);

  // Holiday occasions (Valentine's, Mother's/Father's Day) have a computed date — prefill it so
  // the date step is read-only. 'user' occasions (anniversary, birthday) leave it blank to ask.
  const computedDate = computedEventDate(occasion.dateRule);
  const dateIsFixed = computedDate !== null;

  const set = <K extends keyof Data>(k: K, v: Data[K]) => setData((d) => ({ ...d, [k]: v }));
  const togglePick = (k: GiftKey) =>
    setData((d) => ({ ...d, picks: d.picks.includes(k) ? d.picks.filter((x) => x !== k) : [...d.picks, k] }));

  // Days of runway until the event — drives which deliverables the picker offers (the neck-down).
  const days = daysUntil(data.eventDate || computedDate || "");

  // Create the anonymous draft order on entry (no signup); prefill a computed holiday date.
  useEffect(() => {
    if (computedDate) set("eventDate", computedDate);
    createDraftOrder({ occasionType: occasion.key })
      .then(({ orderId: id }) => { orderId.current = id; })
      .catch((e) => console.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occasion.key]);

  function addPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 8 - data.photos.length);
    const baseIndex = data.photos.length;
    // Local object URLs drive the in-session preview; the real files upload to the assets bucket
    // in the background so the persisted share page (and later renders) have durable photos.
    set("photos", [...data.photos, ...files.map((f) => URL.createObjectURL(f))]);
    files.forEach((f, i) => {
      const fd = new FormData();
      fd.append("orderId", orderId.current ?? "");
      fd.append("file", f);
      fd.append("position", String(baseIndex + i));
      void uploadAsset(fd).catch((err) => console.error(err));
    });
  }
  function removePhoto(i: number) {
    set("photos", data.photos.filter((_, idx) => idx !== i));
  }

  async function generate() {
    setScreen("gen");
    // Only the digital BUNDLE picks (reel/poem) are synthesized + ride the combo paywall. Commerce
    // items (gift card / experience) and print keepsakes are their own single-item orders.
    const digitalPicks = data.picks.filter((k) => !needsCheckout(k));
    void saveIntake({
      orderId: orderId.current ?? "",
      intake: {
        name: data.name, pet: data.pet, secret: data.secret,
        reason: data.reason, photo_count: data.photos.length,
        event_date: data.eventDate || null, days_until: days,
      },
      tone: data.tone,
      giftKeys: data.picks,
    }).catch((e) => console.error(e));

    // Only the digital deliverables are synthesized; print keepsakes are real shippable orders.
    const [res] = await Promise.all([
      generateDeliverables({
        orderId: orderId.current ?? "",
        intake: { name: data.name, pet: data.pet, secret: data.secret, reason: data.reason },
        tone: data.tone,
        giftKeys: digitalPicks,
      }).catch(() => ({ story: buildStory(data), poem: buildPoem(data) })),
      delay(1500),
    ]);

    setStory(res.story);
    setPoem(res.poem);
    setPoemVariant(0);
    setPoemReworks(0);
    setActive(data.picks[0] || "reel");
    setUnlocked(false);
    setScreen("preview");
    void logEvent({ name: "generated", orderId: orderId.current ?? undefined });
  }

  // The Poem is the free-to-try hook: 1 free rework, then it locks until the digital bundle is
  // paid. Paying (unlocked) lifts the cap. Each rework regenerates via the model server-side.
  async function reworkPoem() {
    if (reworking) return;
    if (!unlocked && poemReworks >= FREE_POEM_REWORKS) return; // locked — paywall takes over
    const next = poemVariant + 1;
    setReworking(true);
    try {
      const { poem: fresh } = await requestPoemRework({
        orderId: orderId.current ?? "",
        intake: { name: data.name, pet: data.pet, secret: data.secret, reason: data.reason },
        tone: data.tone,
        variant: next,
      });
      setPoemVariant(next);
      setPoem(fresh);
      if (!unlocked) setPoemReworks((n) => n + 1);
      void logEvent({ name: "poem_reworked", orderId: orderId.current ?? undefined });
    } catch (e) {
      console.error(e);
    } finally {
      setReworking(false);
    }
  }

  // Publish the share microsite (persist an unguessable slug + token, flip to delivered),
  // then land on the Done screen with the real, sendable link.
  async function handleSend() {
    let url = "";
    try {
      const { slug, token } = await publishShare({ orderId: orderId.current ?? "" });
      const base = typeof window !== "undefined" ? window.location.origin : "";
      url = `${base}/s/${slug}?t=${token}`;
    } catch (e) {
      console.error(e);
    }
    setShareUrl(url);
    setScreen("done");
  }

  return (
    <Frame>
      {screen === "intake" && (
        <Intake
          data={data} step={step} setStep={setStep} set={set} togglePick={togglePick}
          days={days} dateIsFixed={dateIsFixed} occasionLabel={occasion.label}
          onBack={() => (step === 0 ? router.push("/") : setStep(step - 1))}
          fileRef={fileRef} removePhoto={removePhoto} onGenerate={generate}
        />
      )}
      {screen === "gen" && <Generating />}
      {screen === "preview" && story && poem && (
        <Preview
          data={data} story={story} poem={poem} active={active} setActive={setActive}
          orderId={orderId.current ?? ""} days={days}
          onRework={reworkPoem} reworksLeft={Math.max(0, FREE_POEM_REWORKS - poemReworks)} reworking={reworking}
          unlocked={unlocked} onBack={() => setScreen("intake")}
          onUnlock={() => { setUnlocked(true); void logEvent({ name: "paid", orderId: orderId.current ?? undefined }); }}
          onSend={handleSend}
        />
      )}
      {screen === "done" && (
        <Done
          data={data} shareUrl={shareUrl} copied={copied} occasionKey={occasion.key}
          orderId={orderId.current ?? ""}
          onCopy={() => { if (shareUrl) { navigator.clipboard?.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); } }}
          onRestart={() => router.push("/")}
        />
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={addPhotos} />
    </Frame>
  );
}

/* ─────────────────  phone frame  ───────────────── */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0E0C16", display: "flex", justifyContent: "center", fontFamily: ui }}>
      <div style={{
        width: "100%", maxWidth: 430, minHeight: "100vh", position: "relative", overflow: "hidden",
        background: `radial-gradient(120% 60% at 50% -10%, #2A2238 0%, ${C.ink} 46%, #110E1A 100%)`,
        color: C.ivory, boxShadow: "0 0 80px rgba(0,0,0,.6)",
      }}>
        {children}
      </div>
    </div>
  );
}

/* ─────────────────  intake  ───────────────── */
function Intake({ data, step, setStep, set, togglePick, days, dateIsFixed, occasionLabel, onBack, fileRef, removePhoto, onGenerate }: {
  data: Data; step: number; setStep: (n: number) => void;
  set: <K extends keyof Data>(k: K, v: Data[K]) => void; togglePick: (k: GiftKey) => void;
  days: number; dateIsFixed: boolean; occasionLabel: string;
  onBack: () => void; fileRef: React.RefObject<HTMLInputElement | null>;
  removePhoto: (i: number) => void; onGenerate: () => void;
}) {
  const STEPS = 6;
  const next = () => setStep(Math.min(step + 1, STEPS - 1));
  const hasPrint = data.picks.some(isPrint);
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 22px 0" }}>
        <button onClick={onBack} aria-label="Back" style={{ background: "none", border: "none", color: C.ivory, padding: 4 }}><ArrowLeft size={22} /></button>
        <div style={{ display: "flex", gap: 7 }}>{Array.from({ length: STEPS }).map((_, i) => <Flame key={i} size={16} glow={i <= step} />)}</div>
      </div>
      <div key={step} className="orx-rise" style={{ flex: 1, padding: "34px 24px 24px", display: "flex", flexDirection: "column" }}>
        {step === 0 && <>
          <Eyebrow>Step 1</Eyebrow><Q>Who&apos;s the lucky one?</Q>
          <Field label="Their name" value={data.name} onChange={(v) => set("name", v)} placeholder="Maya" />
          <Field label="What you call them" value={data.pet} onChange={(v) => set("pet", v)} placeholder="my love, Mays…" />
          <Spacer /><Primary onClick={next} disabled={!data.name.trim()}>Continue</Primary>
        </>}
        {step === 1 && <DateStep data={data} set={set} days={days} dateIsFixed={dateIsFixed} occasionLabel={occasionLabel} onNext={next} />}
        {step === 2 && <>
          <Eyebrow>Step 3</Eyebrow><Q>Add a few of your photos</Q>
          <p style={{ color: C.muted, marginTop: -6, fontSize: 14.5 }}>Real moments make every gift land harder.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 18 }}>
            {data.photos.map((p, i) => (
              <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 14, overflow: "hidden", border: `1px solid ${C.line}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => removePhoto(i)} aria-label="Remove" style={{ position: "absolute", top: 5, right: 5, background: "rgba(14,12,22,.7)", border: "none", borderRadius: 999, color: C.ivory, width: 22, height: 22, display: "grid", placeItems: "center" }}><X size={13} /></button>
              </div>
            ))}
            {data.photos.length < 8 && <button onClick={() => fileRef.current?.click()} style={{ aspectRatio: "1", borderRadius: 14, border: `1px dashed ${C.muted}`, background: "transparent", color: C.muted, display: "grid", placeItems: "center", gap: 6 }}><ImagePlus size={22} /><span style={{ fontSize: 11 }}>Add</span></button>}
          </div>
          <Spacer /><Primary onClick={next}>{data.photos.length ? "Continue" : "Skip for now"}</Primary>
        </>}
        {step === 3 && <>
          <Eyebrow>Step 4</Eyebrow><Q>One thing only the two of you would get</Q>
          <Area value={data.secret} onChange={(v) => set("secret", v)} placeholder="The diner on 8th. The way you say 'okay okay okay.'" />
          <Spacer /><Primary onClick={next}>Continue</Primary>
        </>}
        {step === 4 && <>
          <Eyebrow>Step 5</Eyebrow><Q style={{ fontStyle: "italic" }}>Finish this: <span style={{ color: C.gold }}>I love you because…</span></Q>
          <Area value={data.reason} onChange={(v) => set("reason", v)} placeholder="you make the hard days feel survivable." />
          <Spacer /><Primary onClick={next} disabled={!data.reason.trim()}>Continue</Primary>
        </>}
        {step === 5 && <GiftStep data={data} days={days} togglePick={togglePick} set={set} />}
        {step === 5 && (
          <div style={{ padding: "0 24px 28px" }}>
            <Primary onClick={onGenerate} disabled={!data.picks.length}>
              {hasPrint && data.picks.every(isPrint) ? "Review your keepsake" : data.picks.length > 1 ? `Make ${data.picks.length} gifts` : "Make it"}
            </Primary>
          </div>
        )}
      </div>
    </div>
  );
}

/* When is the event — drives the neck-down. Computed-date holidays show read-only. */
function DateStep({ data, set, days, dateIsFixed, occasionLabel, onNext }: {
  data: Data; set: <K extends keyof Data>(k: K, v: Data[K]) => void;
  days: number; dateIsFixed: boolean; occasionLabel: string; onNext: () => void;
}) {
  const todayISO = new Date().toISOString().slice(0, 10);
  return (
    <>
      <Eyebrow>Step 2</Eyebrow>
      <Q>When&apos;s the big day?</Q>
      <p style={{ color: C.muted, marginTop: -6, fontSize: 14.5 }}>
        This decides what we can still get to you in time.
      </p>

      {dateIsFixed ? (
        <div style={{ marginTop: 22, padding: "18px 18px", borderRadius: 16, border: `1px solid ${C.line}`, background: C.panel }}>
          <span style={{ color: C.muted, fontSize: 13 }}>{occasionLabel} lands on</span>
          <div style={{ fontFamily: display, fontSize: 26, fontWeight: 500, margin: "4px 0 2px" }}>{fmtDate(data.eventDate)}</div>
          <span style={{ color: C.gold, fontSize: 13.5, fontWeight: 600 }}>{leadLabel(days)}</span>
        </div>
      ) : (
        <>
          <label style={{ display: "block", marginTop: 20 }}>
            <span style={{ display: "block", color: C.muted, fontSize: 13, marginBottom: 7, fontWeight: 600 }}>The date</span>
            <input type="date" value={data.eventDate} min={todayISO} onChange={(e) => set("eventDate", e.target.value)}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `1px solid ${C.line}`, background: C.panel, color: C.ivory, fontSize: 16 }} />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => set("eventDate", todayISO)} style={{ flex: 1, padding: "11px", borderRadius: 12, border: `1px solid ${data.eventDate === todayISO ? C.gold : C.line}`, background: data.eventDate === todayISO ? "rgba(235,180,92,.08)" : "transparent", color: data.eventDate === todayISO ? C.goldSoft : C.muted, fontSize: 13.5, fontWeight: 600 }}>It&apos;s today 😬</button>
          </div>
          {data.eventDate && <p style={{ color: C.gold, fontSize: 13.5, fontWeight: 600, marginTop: 12 }}>{leadLabel(days)}</p>}
        </>
      )}

      <Spacer />
      <Primary onClick={onNext} disabled={!data.eventDate}>Continue</Primary>
    </>
  );
}

/* The neck-down gift picker. Available (premium-first) up top; out-of-window items shown locked. */
function GiftStep({ data, days, togglePick, set }: {
  data: Data; days: number; togglePick: (k: GiftKey) => void;
  set: <K extends keyof Data>(k: K, v: Data[K]) => void;
}) {
  const availableCount = GIFTS.filter((g) => isAvailable(g.key, days)).length;
  return (
    <>
      <Eyebrow>Last step</Eyebrow><Q>Choose your gift</Q>
      <p style={{ color: C.muted, marginTop: -6, fontSize: 14.5 }}>
        {leadLabel(days)} — {availableCount} option{availableCount === 1 ? "" : "s"} we can deliver in time.
      </p>

      {TIERS.map((tier) => {
        const items = giftsByTier(tier.key);
        if (items.length === 0) return null;
        const anyAvailable = items.some((g) => isAvailable(g.key, days));
        return (
          <div key={tier.key} style={{ marginTop: 22, opacity: anyAvailable ? 1 : 0.85 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 0 10px" }}>
              <span style={{ color: anyAvailable ? C.goldSoft : C.muted, fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>{tier.label}</span>
              <span style={{ color: C.muted, fontSize: 11.5 }}>{tier.blurb}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {items.map((g) => {
                const inTime = isAvailable(g.key, days);
                const on = data.picks.includes(g.key);
                if (!inTime) {
                  return (
                    <div key={g.key} style={{ padding: "13px 16px", borderRadius: 14, border: `1px dashed ${C.line}`, background: "transparent", color: C.muted, display: "flex", alignItems: "center", gap: 14, opacity: 0.7 }}>
                      <span style={{ width: 36, height: 36, borderRadius: 10, background: C.panel, display: "grid", placeItems: "center", flex: "0 0 auto" }}><g.Icon size={17} /></span>
                      <span style={{ flex: 1 }}>
                        <span style={{ fontFamily: display, fontSize: 17, fontWeight: 500, display: "block", color: "#C9BFD4" }}>{g.label}</span>
                        <span style={{ fontSize: 12.5 }}>Order {g.minLeadDays}+ days ahead — we&apos;ll remind you next time</span>
                      </span>
                    </div>
                  );
                }
                return (
                  <button key={g.key} onClick={() => togglePick(g.key)} style={{ textAlign: "left", padding: "15px 16px", borderRadius: 16, border: `1px solid ${on ? C.gold : C.line}`, background: on ? "rgba(235,180,92,.08)" : C.panel, color: C.ivory, display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ width: 42, height: 42, borderRadius: 12, background: C.panel2, display: "grid", placeItems: "center", color: on ? C.gold : C.muted, flex: "0 0 auto" }}><g.Icon size={20} /></span>
                    <span style={{ flex: 1 }}>
                      <span style={{ fontFamily: display, fontSize: 21, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>{g.label}
                        {g.fulfillment === "print"
                          ? <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.blush, border: `1px solid ${C.line}`, borderRadius: 999, padding: "2px 7px" }}>Ships</span>
                          : g.key === "poem"
                            ? <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 999, padding: "2px 7px" }}>Free to try</span>
                            : g.checkout === "order" && <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.goldSoft, border: `1px solid ${C.line}`, borderRadius: 999, padding: "2px 7px" }}>Instant</span>}
                      </span>
                      <span style={{ color: C.muted, fontSize: 13 }}>{g.desc}</span>
                      <span style={{ color: g.checkout === "order" ? C.goldSoft : C.muted, fontSize: 12.5, fontWeight: 600, display: "block", marginTop: 3 }}>
                        {g.checkout === "order"
                          ? `$${(g.priceCents / 100).toFixed(0)} · ${g.shipNote}`
                          : g.key === "poem" ? "Free preview + 1 rework · unlock to send" : "Included · sent as a link"}
                      </span>
                    </span>
                    <span style={{ width: 24, height: 24, borderRadius: 999, border: `1.5px solid ${on ? C.gold : C.muted}`, display: "grid", placeItems: "center", background: on ? C.gold : "transparent", color: C.ink, flex: "0 0 auto" }}>{on && <Check size={15} />}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
        {([{ k: "heartfelt", t: "Heartfelt" }, { k: "romantic", t: "Romantic" }, { k: "funny", t: "Funny" }] as { k: Tone; t: string }[]).map((o) => (
          <button key={o.k} onClick={() => set("tone", o.k)} style={{ flex: 1, padding: "9px", borderRadius: 11, border: `1px solid ${data.tone === o.k ? C.gold : C.line}`, background: data.tone === o.k ? "rgba(235,180,92,.08)" : "transparent", color: data.tone === o.k ? C.goldSoft : C.muted, fontSize: 13, fontWeight: 600 }}>{o.t}</button>
        ))}
      </div>
    </>
  );
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${MONTHS[(m || 1) - 1]} ${d}, ${y}`;
}

/* ─────────────────  generating  ───────────────── */
function Generating() {
  const lines = ["Gathering your moments…", "Finding the words…", "Lighting the candles…"];
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % lines.length), 750); return () => clearInterval(t); }, [lines.length]);
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", padding: 30 }}>
      <div>
        <div style={{ position: "relative", width: 90, height: 90, margin: "0 auto 24px" }}>
          <div style={{ position: "absolute", inset: -30, borderRadius: "50%", background: "radial-gradient(circle,rgba(235,180,92,.4),transparent 70%)", animation: "orxGlow 1.4s ease infinite alternate" }} />
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><Flame size={56} /></div>
        </div>
        <p style={{ fontFamily: display, fontSize: 24, fontWeight: 500, margin: 0 }}>{lines[i]}</p>
      </div>
    </div>
  );
}

/* ─────────────────  preview wrapper  ───────────────── */
function Preview({ data, story, poem, active, setActive, orderId, days, onRework, reworksLeft, reworking, unlocked, onBack, onUnlock, onSend }: {
  data: Data; story: ReturnType<typeof buildStory>; poem: string[];
  active: GiftKey; setActive: (k: GiftKey) => void; orderId: string; days: number; unlocked: boolean;
  onRework: () => void; reworksLeft: number; reworking: boolean;
  onBack: () => void; onUnlock: () => void; onSend: () => void;
}) {
  const picks: GiftKey[] = data.picks.length ? data.picks : ["reel"];
  const digitalPicks = picks.filter((k) => !needsCheckout(k));
  const activeGift = giftByKey(active);
  const activeNeedsCheckout = needsCheckout(active); // own charge (print keepsake or commerce gift)
  const activeLabel = activeNeedsCheckout ? (activeGift.fulfillment === "print" ? "Keepsake" : "Gift") : unlocked ? "Unlocked" : "Preview";
  return (
    <div style={{ minHeight: "100vh", paddingBottom: 96, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 0" }}>
        <button onClick={onBack} aria-label="Back" style={{ background: "none", border: "none", color: C.ivory, padding: 4 }}><ArrowLeft size={22} /></button>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: unlocked ? C.gold : C.muted }}>{activeLabel}</span>
        <span style={{ width: 22 }} />
      </div>
      {picks.length > 1 && (
        <div style={{ display: "flex", gap: 8, padding: "16px 18px 0", flexWrap: "wrap" }}>
          {picks.map((k) => {
            const g = giftByKey(k); const on = active === k;
            return (
              <button key={k} onClick={() => setActive(k)} style={{ flex: "1 1 28%", padding: "9px 6px", borderRadius: 12, border: `1px solid ${on ? C.gold : C.line}`, background: on ? "rgba(235,180,92,.1)" : C.panel, color: on ? C.goldSoft : C.muted, fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><g.Icon size={15} />{g.label.replace("The ", "")}</button>
            );
          })}
        </div>
      )}
      <div style={{ padding: "16px 16px 0" }}>
        {active === "reel" && <Reel data={data} story={story} unlocked={unlocked} />}
        {active === "poem" && <Poem data={data} poem={poem} unlocked={unlocked} onRework={onRework} reworksLeft={reworksLeft} reworking={reworking} onUnlock={onUnlock} />}
        {active === "photobook" && <Book data={data} story={story} unlocked={unlocked} />}
        {active === "portrait" && <FramedPrint data={data} poem={poem} />}
        {active === "collage" && <Collage data={data} />}
        {active === "starmap" && <StarMap data={data} />}
        {active === "mug" && <Mug data={data} />}
        {active === "card" && <Card data={data} poem={poem} />}
        {active === "giftcard" && <Voucher data={data} gift={giftByKey("giftcard")} />}
        {active === "experience" && <Voucher data={data} gift={giftByKey("experience")} />}
      </div>

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ width: "100%", maxWidth: 430, padding: 16, background: `linear-gradient(180deg,transparent,${C.ink} 38%)`, pointerEvents: "auto" }}>
          {activeNeedsCheckout ? (
            <PrintOrder orderId={orderId} gift={activeGift} days={days} />
          ) : digitalPicks.length === 0 ? null : !unlocked ? (
            <Paywall orderId={orderId} amountCents={priceFor(digitalPicks.length) * 100} picksCount={digitalPicks.length} onUnlock={onUnlock} />
          ) : (
            <button onClick={onSend} style={btnGold}>Send it →</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────  THE FRAMED PRINT (print)  ───────────────── */
function FramedPrint({ data, poem }: { data: Data; poem: string[] }) {
  return (
    <div className="orx-rise">
      <div style={{ padding: 18, borderRadius: 14, background: "linear-gradient(145deg,#1A1426,#241C32)", border: `1px solid ${C.line}` }}>
        {/* the frame */}
        <div style={{ borderRadius: 6, padding: 12, background: `linear-gradient(145deg,#C9A24A,#6E5320)`, boxShadow: "0 18px 40px rgba(0,0,0,.5)" }}>
          <div style={{ borderRadius: 3, padding: "34px 24px", background: "#FBF7EE", textAlign: "center" }}>
            <Flame size={20} />
            {poem.slice(0, 7).map((l, i) => l === ""
              ? <div key={i} style={{ height: 10 }} />
              : <p key={i} style={{ fontFamily: display, fontStyle: i === 0 ? "normal" : "italic", fontSize: i === 0 ? 12 : 16, letterSpacing: i === 0 ? ".18em" : "0", textTransform: i === 0 ? "uppercase" : "none", color: i === 0 ? "#9A6A4A" : "#2A2230", margin: "3px 0", lineHeight: 1.45 }}>{l}</p>)}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #E4DAC8", color: "#8A7E6E", fontSize: 10.5, letterSpacing: ".1em" }}>
              {(data.name || "YOU").toUpperCase()}
            </div>
          </div>
        </div>
      </div>
      <p style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 14, lineHeight: 1.5 }}>
        Printed on archival paper in a museum-grade frame, ready to hang. We print and ship it to you.
      </p>
    </div>
  );
}

/* ─────────────────  THE CANVAS COLLAGE (print)  ───────────────── */
function Collage({ data }: { data: Data }) {
  const photos = data.photos.length ? data.photos : [null, null, null, null];
  return (
    <div className="orx-rise">
      <div style={{ borderRadius: 14, padding: 10, background: "linear-gradient(145deg,#2A2238,#16111F)", border: `1px solid ${C.line}`, boxShadow: "0 18px 40px rgba(0,0,0,.5)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6, borderRadius: 8, overflow: "hidden" }}>
          {photos.slice(0, 4).map((p, i) => (
            <div key={i} style={{ aspectRatio: "1", background: p ? "transparent" : `linear-gradient(${130 + i * 30}deg,#3A2A45,#1A1426)`, overflow: "hidden" }}>
              {p
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : null}
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", fontFamily: display, fontSize: 18, color: C.ivory, margin: "12px 0 4px" }}>
          {data.pet || data.name || "Us"} · {data.eventDate ? fmtDate(data.eventDate).split(",")[0] : "Always"}
        </p>
      </div>
      <p style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 14, lineHeight: 1.5 }}>
        Your favorite moments, printed together on gallery-wrapped canvas. We print and ship it to you.
      </p>
    </div>
  );
}

/* ─────────────────  THE STAR MAP (print)  ───────────────── */
function StarMap({ data }: { data: Data }) {
  // A deterministic sprinkle of stars so the same render is stable across paints.
  const stars = Array.from({ length: 46 }, (_, i) => {
    const a = (i * 139.5) % 360, r = 6 + ((i * 53) % 78);
    const cx = 50 + Math.cos((a * Math.PI) / 180) * (r / 1.7);
    const cy = 50 + Math.sin((a * Math.PI) / 180) * (r / 1.7);
    return { cx, cy, rad: 0.4 + ((i * 7) % 10) / 9 };
  });
  return (
    <div className="orx-rise">
      <div style={{ borderRadius: 14, padding: 16, background: "linear-gradient(145deg,#1A1426,#241C32)", border: `1px solid ${C.line}`, boxShadow: "0 18px 40px rgba(0,0,0,.5)" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "1", borderRadius: "50%", overflow: "hidden", background: "radial-gradient(circle at 50% 38%,#10203A,#070B16 72%)", border: "4px solid #0C1120" }}>
          <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            {stars.map((s, i) => <circle key={i} cx={s.cx} cy={s.cy} r={s.rad} fill="#EAF2FF" opacity={0.5 + (i % 5) / 10} />)}
            <path d="M30 40 L42 46 L50 38 L62 50 L70 44" stroke="#9FB8E8" strokeWidth="0.4" fill="none" opacity="0.7" />
          </svg>
        </div>
        <p style={{ textAlign: "center", fontFamily: display, fontSize: 19, color: C.ivory, margin: "16px 0 2px" }}>
          {data.name ? `${cap(data.pet || data.name)} & You` : "Under these stars"}
        </p>
        <p style={{ textAlign: "center", color: C.muted, fontSize: 12.5, letterSpacing: ".08em" }}>
          {data.eventDate ? fmtDate(data.eventDate).toUpperCase() : "THE NIGHT IT BEGAN"}
        </p>
      </div>
      <p style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 14, lineHeight: 1.5 }}>
        The exact night sky over your moment, printed and framed. We print and ship it to you.
      </p>
    </div>
  );
}

/* ─────────────────  THE MUG (print)  ───────────────── */
function Mug({ data }: { data: Data }) {
  const reasons = (data.reason || "you make every ordinary day feel like a holiday")
    .split(/[.,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  return (
    <div className="orx-rise">
      <div style={{ display: "grid", placeItems: "center", padding: "26px 18px", borderRadius: 14, background: "linear-gradient(145deg,#241C32,#16111F)", border: `1px solid ${C.line}` }}>
        <div style={{ position: "relative", width: 200, height: 150 }}>
          <div style={{ position: "absolute", right: 4, top: 30, width: 44, height: 60, border: "10px solid #F4ECDD", borderRadius: "0 40px 40px 0", background: "transparent" }} />
          <div style={{ position: "absolute", left: 8, top: 14, width: 150, height: 120, borderRadius: 14, background: "linear-gradient(180deg,#FBF7EE,#EAE0CE)", boxShadow: "0 14px 30px rgba(0,0,0,.45)", padding: "16px 14px", textAlign: "center" }}>
            <p style={{ fontFamily: display, fontSize: 13, color: "#9A6A4A", letterSpacing: ".12em", textTransform: "uppercase", margin: "0 0 8px" }}>Reasons I love you</p>
            {reasons.map((r, i) => (
              <p key={i} style={{ fontFamily: display, fontStyle: "italic", fontSize: 11.5, color: "#2A2230", margin: "4px 0", lineHeight: 1.3 }}>{i + 1}. {lc(r)}</p>
            ))}
          </div>
        </div>
      </div>
      <p style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 14, lineHeight: 1.5 }}>
        Your words on a ceramic mug they&apos;ll hold every morning. We print and ship it to you.
      </p>
    </div>
  );
}

/* ─────────────────  THE CARD (print)  ───────────────── */
function Card({ data, poem }: { data: Data; poem: string[] }) {
  return (
    <div className="orx-rise">
      <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}`, boxShadow: "0 18px 40px rgba(0,0,0,.5)" }}>
        <div style={{ padding: "30px 26px", background: "linear-gradient(160deg,#FBF7EE,#F1E7D6)", textAlign: "center", minHeight: 300 }}>
          <Flame size={22} />
          <p style={{ fontFamily: display, fontSize: 13, letterSpacing: ".2em", textTransform: "uppercase", color: "#9A6A4A", margin: "10px 0 18px" }}>For {cap(data.pet || data.name || "You")}</p>
          {poem.slice(1, 6).map((l, i) => l === ""
            ? <div key={i} style={{ height: 8 }} />
            : <p key={i} style={{ fontFamily: display, fontStyle: "italic", fontSize: 15.5, color: "#2A2230", margin: "4px 0", lineHeight: 1.5 }}>{l}</p>)}
          <div style={{ marginTop: 20, color: "#8A7E6E", fontSize: 11, letterSpacing: ".1em" }}>— {(data.name || "Me").toUpperCase()}</div>
        </div>
      </div>
      <p style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 14, lineHeight: 1.5 }}>
        A premium folded card, printed with your words and mailed for you.
      </p>
    </div>
  );
}

/* ─────────────────  GIFT CARD / EXPERIENCE (commerce voucher)  ───────────────── */
function Voucher({ data, gift }: { data: Data; gift: ReturnType<typeof giftByKey> }) {
  const amount = (gift.priceCents / 100).toFixed(0);
  const Icon = gift.key === "experience" ? Ticket : GiftIcon;
  return (
    <div className="orx-rise">
      <div style={{ borderRadius: 18, padding: 22, background: "linear-gradient(145deg,#2C2140,#171024)", border: `1px solid ${C.gold}`, boxShadow: "0 18px 40px rgba(0,0,0,.5)", color: C.ivory, minHeight: 220, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: C.gold }}><Icon size={26} /></span>
          <span style={{ fontFamily: display, fontSize: 30, color: C.gold }}>${amount}</span>
        </div>
        <div>
          <p style={{ fontFamily: display, fontSize: 22, margin: "0 0 4px" }}>{gift.label}</p>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>{gift.desc}</p>
        </div>
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, display: "flex", justifyContent: "space-between", fontSize: 11.5, letterSpacing: ".08em", color: C.muted }}>
          <span>FOR {cap(data.pet || data.name || "YOU").toUpperCase()}</span>
          <span>OCCASION RESCUE</span>
        </div>
      </div>
      <p style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 14, lineHeight: 1.5 }}>
        Delivered to their inbox the moment you order — redeemable instantly.
      </p>
    </div>
  );
}

/* ─────────────────  THE REEL  ───────────────── */
function Reel({ data, story, unlocked }: { data: Data; story: ReturnType<typeof buildStory>; unlocked: boolean }) {
  const slides: (string | null)[] = data.photos.length ? data.photos : [null, null, null];
  const captions = [
    story.headline,
    data.reason ? `I love you because ${lc(data.reason)}` : "I love you, plainly",
    data.secret ? `Remember ${lc(data.secret)}?` : "Every ordinary day with you",
    "Happy anniversary",
  ];
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audio = useRef<any>({});
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { stop(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  function stop() {
    if (timer.current) clearInterval(timer.current);
    try {
      const T = audio.current.Tone;
      if (T) { T.Transport.stop(); T.Transport.cancel(); }
      audio.current.loop?.dispose();
      audio.current.synth?.dispose();
      audio.current.verb?.dispose();
    } catch { /* ignore */ }
    audio.current = {};
  }
  async function play() {
    setPlaying(true);
    try {
      const Tone = await import("tone");
      await Tone.start();
      const verb = new Tone.Reverb({ decay: 6, wet: 0.5 }).toDestination();
      const synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 1.4, release: 3 } }).connect(verb);
      synth.volume.value = -12;
      const chords = [["C4", "E4", "G4"], ["A3", "C4", "E4"], ["F3", "A3", "C4"], ["G3", "B3", "D4"]];
      let c = 0;
      const loop = new Tone.Loop((time) => { synth.triggerAttackRelease(chords[c % chords.length], "1m", time); c++; }, "1m");
      Tone.Transport.bpm.value = 58; loop.start(0); Tone.Transport.start();
      audio.current = { Tone, synth, verb, loop };
    } catch { /* ignore */ }
    timer.current = setInterval(() => setIdx((i) => (i + 1) % slides.length), 3600);
  }
  function pause() { setPlaying(false); stop(); }

  return (
    <div className="orx-rise" style={{ borderRadius: 22, overflow: "hidden", border: `1px solid ${C.line}`, position: "relative", aspectRatio: "4/5", background: "#0B0912" }}>
      {slides.map((s, i) => (
        <div key={i} style={{ position: "absolute", inset: 0, opacity: i === idx ? 1 : 0, transition: "opacity 1s ease" }}>
          {s
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={s} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", animation: i === idx && playing ? "orxKen 4s ease forwards" : "none" }} />
            : <div style={{ width: "100%", height: "100%", background: `linear-gradient(${140 + i * 40}deg,#3A2A45,#1A1426)` }} />}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(11,9,18,.1) 30%,rgba(11,9,18,.85))" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 24px 30px" }}>
            <p style={{ fontFamily: display, fontSize: 26, fontWeight: 500, lineHeight: 1.15, margin: 0, opacity: i === idx ? 1 : 0, animation: i === idx ? "orxFade 1.2s ease .3s both" : "none" }}>{captions[i % captions.length]}</p>
          </div>
        </div>
      ))}

      {!unlocked && <Watermark />}
      <div style={{ position: "absolute", top: 14, left: 14, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: C.ivory, background: "rgba(11,9,18,.5)", padding: "5px 10px", borderRadius: 999, backdropFilter: "blur(4px)" }}>♪ Soundtrack</div>
      <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 5 }}>
        {slides.map((_, i) => <span key={i} style={{ width: i === idx ? 16 : 5, height: 5, borderRadius: 999, background: i === idx ? C.gold : "rgba(246,240,232,.4)", transition: "all .3s" }} />)}
      </div>
      <button onClick={playing ? pause : play} aria-label={playing ? "Pause" : "Play"} style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 64, height: 64, borderRadius: 999, border: "none", background: "rgba(235,180,92,.92)", color: "#2A1E08", display: "grid", placeItems: "center", opacity: playing ? 0 : 1, transition: "opacity .3s", pointerEvents: playing ? "none" : "auto", boxShadow: "0 8px 30px rgba(0,0,0,.4)" }}>
        <Play size={26} style={{ marginLeft: 3 }} />
      </button>
      {playing && <button onClick={pause} aria-label="Pause" style={{ position: "absolute", bottom: 14, right: 14, width: 38, height: 38, borderRadius: 999, border: "none", background: "rgba(11,9,18,.55)", color: C.ivory, display: "grid", placeItems: "center" }}><Pause size={17} /></button>}
    </div>
  );
}

/* ─────────────────  THE POEM  ───────────────── */
function Poem({ data, poem, unlocked, onRework, reworksLeft, reworking, onUnlock }: {
  data: Data; poem: string[]; unlocked: boolean;
  onRework: () => void; reworksLeft: number; reworking: boolean; onUnlock: () => void;
}) {
  // Free-to-try: one rework on the house, then the button locks and points at the paywall.
  // Paying (unlocked) lifts the cap entirely.
  const canRework = unlocked || reworksLeft > 0;
  return (
    <div className="orx-rise">
      <div style={{ position: "relative", borderRadius: 18, padding: 8, background: `linear-gradient(145deg,${C.gold},#8A6A2E)` }}>
        <div style={{ position: "relative", borderRadius: 12, padding: "40px 28px 30px", background: `radial-gradient(120% 80% at 50% 0%,#241C32,#16111F)`, overflow: "hidden" }}>
          {!unlocked && <Watermark />}
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
      {canRework ? (
        <button onClick={onRework} disabled={reworking} style={{ fontFamily: ui, width: "100%", marginTop: 14, padding: "12px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.panel, color: C.ivory, opacity: reworking ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
          <RefreshCw size={16} className={reworking ? "orx-spin" : undefined} />
          {reworking ? "Writing a new version…" : "Try another version"}
          {!reworking && !unlocked && <span style={{ color: C.muted, fontWeight: 500 }}>· {reworksLeft} free left</span>}
        </button>
      ) : (
        <button onClick={onUnlock} style={{ fontFamily: ui, width: "100%", marginTop: 14, padding: "12px", borderRadius: 12, border: `1px solid ${C.gold}`, background: "rgba(235,180,92,.08)", color: C.goldSoft, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
          <Lock size={15} /> Unlock to rework &amp; send
        </button>
      )}
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <SecondaryBtn icon={<Download size={17} />} label="Download print" onClick={() => window.print()} />
      </div>
    </div>
  );
}

/* ─────────────────  THE BOOK  ───────────────── */
function Book({ data, story, unlocked }: { data: Data; story: ReturnType<typeof buildStory>; unlocked: boolean }) {
  const cover = data.photos[0];
  const pages: Array<
    | { type: "cover" }
    | { type: "end" }
    | { kicker: string; title: string; body: string; photo?: string }
  > = [
    { type: "cover" },
    { kicker: "Chapter one", title: "Only we know", body: data.secret ? cap(lc(data.secret)) + "." : "The small, unwitnessed things — the ones no one else would understand.", photo: data.photos[1] || data.photos[0] },
    { kicker: "Chapter two", title: "Why you", body: data.reason ? `I love you because ${lc(data.reason)}.` : "For the quiet you bring to a loud world.", photo: data.photos[2] || data.photos[0] },
    { type: "end" },
  ];
  const [p, setP] = useState(0);
  const pg = pages[p];
  return (
    <div className="orx-rise">
      <div style={{ position: "relative", aspectRatio: "3/4", borderRadius: "6px 14px 14px 6px", overflow: "hidden", border: `1px solid ${C.line}`, boxShadow: "-6px 6px 0 rgba(0,0,0,.25)", background: C.panel }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 10, background: "linear-gradient(90deg,rgba(0,0,0,.4),transparent)", zIndex: 3 }} />
        {!unlocked && <Watermark />}
        <div key={p} style={{ position: "absolute", inset: 0, animation: "orxFade .5s ease both" }}>
          {"type" in pg && pg.type === "cover" && <div style={{ position: "absolute", inset: 0 }}>
            {cover
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", background: "linear-gradient(150deg,#3A2A45,#1A1426)" }} />}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(11,9,18,.35),rgba(11,9,18,.85))" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: 30 }}>
              <span style={{ color: C.gold, letterSpacing: ".22em", fontSize: 11, textTransform: "uppercase" }}>Your Story</span>
              <h2 style={{ fontFamily: display, fontWeight: 500, fontSize: 34, lineHeight: 1.05, margin: "12px 0 6px" }}>The Story of Us</h2>
              <p style={{ color: C.muted, fontFamily: display, fontStyle: "italic", fontSize: 18, margin: 0 }}>for {data.pet || data.name || "you"}</p>
            </div>
          </div>}
          {"kicker" in pg && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, overflow: "hidden" }}>{pg.photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={pg.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", background: "linear-gradient(150deg,#3A2A45,#1A1426)" }} />}</div>
            <div style={{ padding: "20px 22px 24px", background: C.panel }}>
              <span style={{ color: C.blush, letterSpacing: ".16em", fontSize: 11, textTransform: "uppercase" }}>{pg.kicker}</span>
              <h3 style={{ fontFamily: display, fontWeight: 500, fontSize: 24, margin: "6px 0 6px" }}>{pg.title}</h3>
              <p style={{ color: "#D9CFE2", fontFamily: display, fontSize: 17, lineHeight: 1.5, margin: 0 }}>{pg.body}</p>
            </div>
          </div>}
          {"type" in pg && pg.type === "end" && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", padding: 30, background: `radial-gradient(120% 80% at 50% 0%,#241C32,#16111F)` }}>
            <div><Flame size={26} /><p style={{ fontFamily: display, fontStyle: "italic", fontSize: 22, lineHeight: 1.5, margin: "16px 0 0", color: "#EDE5DA" }}>{story.body}</p><p style={{ fontFamily: display, fontSize: 18, color: C.muted, marginTop: 18 }}>— with love</p></div>
          </div>}
        </div>
        <button onClick={() => setP(Math.max(0, p - 1))} disabled={p === 0} aria-label="Previous page" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "34%", background: "transparent", border: "none", zIndex: 4, opacity: 0 }} />
        <button onClick={() => setP(Math.min(pages.length - 1, p + 1))} disabled={p === pages.length - 1} aria-label="Next page" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "34%", background: "transparent", border: "none", zIndex: 4, opacity: 0 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 }}>
        {pages.map((_, i) => <span key={i} style={{ width: i === p ? 16 : 6, height: 6, borderRadius: 999, background: i === p ? C.gold : C.line, transition: "all .3s" }} />)}
      </div>
      <p style={{ textAlign: "center", color: C.muted, fontSize: 12, marginTop: 4 }}>Tap the right side to turn the page</p>
    </div>
  );
}

/* ─────────────────  done  ───────────────── */
function Done({ data, shareUrl, copied, occasionKey, orderId, onCopy, onRestart }: {
  data: Data; shareUrl: string; copied: boolean; occasionKey: OccasionType; orderId: string;
  onCopy: () => void; onRestart: () => void;
}) {
  const display_link = shareUrl ? shareUrl.replace(/^https?:\/\//, "") : "preparing your link…";
  const shareMsg = `A little something I made for you 💛 ${shareUrl}`;
  const smsHref = `sms:?&body=${encodeURIComponent(shareMsg)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent("A little something for you")}&body=${encodeURIComponent(shareMsg)}`;

  return (
    <div style={{ minHeight: "100vh", padding: "30px 22px 40px", display: "flex", flexDirection: "column" }}>
      <div className="orx-rise" style={{ textAlign: "center", marginTop: 12 }}>
        <div style={{ width: 64, height: 64, margin: "0 auto", borderRadius: 999, display: "grid", placeItems: "center", background: "radial-gradient(circle,rgba(235,180,92,.25),transparent 70%)" }}><Flame size={42} /></div>
        <h1 style={{ fontFamily: display, fontWeight: 500, fontSize: 34, margin: "16px 0 4px" }}>It&apos;s ready to send.</h1>
        <p style={{ color: C.muted, fontSize: 15, margin: 0 }}>{data.picks.filter((k) => !isPrint(k)).length > 1 ? "Your gifts are" : "Your gift is"} unlocked. Here&apos;s the private link.{data.picks.some(isPrint) ? " Your printed keepsake is on its way." : ""}</p>
      </div>
      <div className="orx-rise" style={{ animationDelay: ".08s", marginTop: 26, padding: "14px 16px", borderRadius: 16, border: `1px solid ${C.line}`, background: C.panel, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{display_link}</span>
        <button onClick={onCopy} disabled={!shareUrl} style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6, background: C.panel2, border: `1px solid ${C.line}`, color: C.ivory, padding: "8px 12px", borderRadius: 10, fontWeight: 600, fontSize: 13, opacity: shareUrl ? 1 : 0.5 }}>{copied ? <><Check size={15} />Copied</> : <><Copy size={15} />Copy</>}</button>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <SecondaryBtn icon={<MessageCircle size={18} />} label="Text it" href={shareUrl ? smsHref : undefined} />
        <SecondaryBtn icon={<Mail size={18} />} label="Email it" href={shareUrl ? mailHref : undefined} />
      </div>
      <ReminderCard data={data} occasionKey={occasionKey} orderId={orderId} />
      <button onClick={onRestart} style={{ marginTop: "auto", background: "none", border: "none", color: C.muted, fontSize: 13, padding: 18 }}>← Back to dashboard</button>
    </div>
  );
}

/* ─────────────────  reminder capture  ───────────────── */
function ReminderCard({ data, occasionKey, orderId }: { data: Data; occasionKey: OccasionType; orderId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(data.eventDate || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!email.trim() && !phone.trim()) { setErr("Add an email or phone number."); return; }
    setBusy(true);
    const res = await setupReminder({
      orderId,
      occasionType: occasionKey,
      recipientName: data.name,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      eventDate: date || undefined,
      emailOptIn: Boolean(email.trim()),
      smsOptIn: Boolean(phone.trim()),
    }).catch(() => ({ ok: false, reason: "Something went wrong." }));
    setBusy(false);
    if (res.ok) setSaved(true);
    else setErr(res.reason ?? "Couldn't set the reminder.");
  }

  if (saved) {
    return (
      <div className="orx-rise" style={{ marginTop: 26, padding: 20, borderRadius: 20, border: `1px solid ${C.gold}`, background: "rgba(235,180,92,.08)", color: C.ivory, display: "flex", gap: 14, alignItems: "flex-start" }}>
        <span style={{ marginTop: 2, color: C.gold }}><Check size={22} /></span>
        <span><span style={{ fontFamily: display, fontSize: 21, fontWeight: 500, display: "block" }}>We&apos;ve got next year.</span>
          <span style={{ color: C.muted, fontSize: 13.5, lineHeight: 1.5 }}>We&apos;ll remind you before {data.name || "their"} next anniversary and offer a one-tap reorder. Nothing else — reply STOP anytime.</span></span>
      </div>
    );
  }

  return (
    <div className="orx-rise" style={{ marginTop: 26, padding: 20, borderRadius: 20, border: `1px solid ${open ? C.gold : C.line}`, background: open ? "rgba(235,180,92,.06)" : C.panel }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: C.ivory, display: "flex", gap: 14, alignItems: "flex-start", padding: 0 }}>
        <span style={{ marginTop: 2, color: open ? C.gold : C.muted }}><Bell size={22} /></span>
        <span><span style={{ fontFamily: display, fontSize: 21, fontWeight: 500, display: "block" }}>Never let this happen again</span>
          <span style={{ color: C.muted, fontSize: 13.5, lineHeight: 1.5 }}>A reminder 2 weeks + a few days out next year, plus one-tap reorder. No spam — just this date.</span></span>
      </button>

      {open && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <InlineField type="email" value={email} onChange={setEmail} placeholder="you@email.com" />
          <InlineField type="tel" value={phone} onChange={setPhone} placeholder="Phone (for a text reminder)" />
          <label style={{ display: "block" }}>
            <span style={{ display: "block", color: C.muted, fontSize: 12, marginBottom: 6, fontWeight: 600 }}>The anniversary date</span>
            <InlineField type="date" value={date} onChange={setDate} placeholder="" />
          </label>
          {err && <p style={{ color: C.blush, fontSize: 13, margin: 0 }}>{err}</p>}
          <button onClick={submit} disabled={busy} style={{ ...btnGold, opacity: busy ? 0.7 : 1, fontSize: 15 }}>{busy ? "Saving…" : "Remind me next year"}</button>
        </div>
      )}
    </div>
  );
}
function InlineField({ type, value, onChange, placeholder }: { type: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.panel2, color: C.ivory, fontSize: 15 }} />
  );
}

/* ─────────────────  shared bits  ───────────────── */
function Watermark() {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", opacity: 0.07, zIndex: 5 }}>
      {[0, 1, 2, 3, 4, 5].map((r) => (
        <div key={r} style={{ position: "absolute", top: r * 110 - 30, left: -40, right: -40, transform: "rotate(-24deg)", whiteSpace: "nowrap", fontWeight: 800, fontSize: 26, letterSpacing: ".3em", color: C.ivory }}>PREVIEW · PREVIEW · PREVIEW</div>
      ))}
    </div>
  );
}
function SecondaryBtn({ icon, label, onClick, href }: { icon: React.ReactNode; label: string; onClick?: () => void; href?: string }) {
  const style: React.CSSProperties = { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 14, border: `1px solid ${C.line}`, background: C.panel, color: C.ivory, fontWeight: 600, fontSize: 13.5, textDecoration: "none" };
  if (href) return <a href={href} style={style}>{icon}{label}</a>;
  return <button onClick={onClick} style={style}>{icon}{label}</button>;
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p style={{ color: C.blush, fontSize: 12, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", margin: 0 }}>{children}</p>;
}
function Q({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <h1 style={{ fontFamily: display, fontWeight: 500, fontSize: 32, lineHeight: 1.1, margin: "10px 0 0", ...style }}>{children}</h1>;
}
function Spacer() { return <div style={{ flex: 1, minHeight: 24 }} />; }
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label style={{ display: "block", marginTop: 18 }}><span style={{ display: "block", color: C.muted, fontSize: 13, marginBottom: 7, fontWeight: 600 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `1px solid ${C.line}`, background: C.panel, color: C.ivory, fontSize: 16 }} /></label>
  );
}
function Area({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} style={{ width: "100%", marginTop: 18, padding: "14px 16px", borderRadius: 14, border: `1px solid ${C.line}`, background: C.panel, color: C.ivory, fontSize: 16, lineHeight: 1.5, resize: "none", fontFamily: display }} />
  );
}
function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "16px", borderRadius: 16, border: "none", fontSize: 16, fontWeight: 700, background: disabled ? C.panel2 : `linear-gradient(180deg,${C.goldSoft},${C.gold})`, color: disabled ? C.muted : "#2A1E08", opacity: disabled ? 0.6 : 1, transition: "all .2s", boxShadow: disabled ? "none" : "0 8px 26px rgba(235,180,92,.28)" }}>{children}</button>
  );
}
