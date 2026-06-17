"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Copy, Check, Bell, MessageCircle, Mail, ImagePlus, X,
  Play, Pause, Download, BookOpen,
} from "lucide-react";
import { C, display, ui, btnGold } from "@/lib/theme";
import { priceFor, makeShareSlug } from "@/lib/config";
import { buildStory, buildPoem, lc, cap, type Tone } from "@/lib/story";
import { GIFTS, giftByKey, type GiftKey } from "@/lib/gifts";
import { Flame } from "@/components/Flame";
import type { OccasionType } from "@/lib/database.types";
import { createDraftOrder, saveIntake, logEvent } from "@/lib/modules/intake";

type FlowScreen = "intake" | "gen" | "preview" | "done";
type Data = {
  name: string; pet: string; photos: string[];
  secret: string; reason: string; tone: Tone; picks: GiftKey[];
};

export function RescueFlow({ occasion }: { occasion: { key: OccasionType; label: string } }) {
  const router = useRouter();
  const [screen, setScreen] = useState<FlowScreen>("intake");
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>({
    name: "", pet: "", photos: [], secret: "", reason: "", tone: "heartfelt", picks: [],
  });
  const [story, setStory] = useState<ReturnType<typeof buildStory> | null>(null);
  const [poem, setPoem] = useState<string[] | null>(null);
  const [active, setActive] = useState<GiftKey>("reel");
  const [unlocked, setUnlocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reminder, setReminder] = useState(false);
  const [slug] = useState(() => makeShareSlug());
  const fileRef = useRef<HTMLInputElement>(null);
  const orderId = useRef<string | null>(null);

  const set = <K extends keyof Data>(k: K, v: Data[K]) => setData((d) => ({ ...d, [k]: v }));
  const togglePick = (k: GiftKey) =>
    setData((d) => ({ ...d, picks: d.picks.includes(k) ? d.picks.filter((x) => x !== k) : [...d.picks, k] }));

  // Create the anonymous draft order on entry (no signup).
  useEffect(() => {
    createDraftOrder({ occasionType: occasion.key })
      .then(({ orderId: id }) => { orderId.current = id; })
      .catch((e) => console.error(e));
  }, [occasion.key]);

  function addPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 8 - data.photos.length);
    set("photos", [...data.photos, ...files.map((f) => URL.createObjectURL(f))]);
  }
  function removePhoto(i: number) {
    set("photos", data.photos.filter((_, idx) => idx !== i));
  }

  function generate() {
    setScreen("gen");
    void saveIntake({
      orderId: orderId.current ?? "",
      intake: {
        name: data.name, pet: data.pet, secret: data.secret,
        reason: data.reason, photo_count: data.photos.length,
      },
      tone: data.tone,
      giftKeys: data.picks,
    }).catch((e) => console.error(e));

    setTimeout(() => {
      setStory(buildStory(data));
      setPoem(buildPoem(data));
      setActive(data.picks[0] || "reel");
      setUnlocked(false);
      setScreen("preview");
      void logEvent({ name: "generated", orderId: orderId.current ?? undefined });
    }, 2400);
  }

  const link = `oc.rs/${slug}`;

  return (
    <Frame>
      {screen === "intake" && (
        <Intake
          data={data} step={step} setStep={setStep} set={set} togglePick={togglePick}
          onBack={() => (step === 0 ? router.push("/") : setStep(step - 1))}
          fileRef={fileRef} removePhoto={removePhoto} onGenerate={generate}
        />
      )}
      {screen === "gen" && <Generating />}
      {screen === "preview" && story && poem && (
        <Preview
          data={data} story={story} poem={poem} active={active} setActive={setActive}
          unlocked={unlocked} onBack={() => setScreen("intake")}
          onUnlock={() => { setUnlocked(true); void logEvent({ name: "paid", orderId: orderId.current ?? undefined }); }}
          onSend={() => { setScreen("done"); void logEvent({ name: "shared", orderId: orderId.current ?? undefined }); }}
        />
      )}
      {screen === "done" && (
        <Done
          data={data} link={link} copied={copied}
          onCopy={() => { navigator.clipboard?.writeText("https://" + link); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
          reminder={reminder} setReminder={setReminder} onRestart={() => router.push("/")}
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
function Intake({ data, step, setStep, set, togglePick, onBack, fileRef, removePhoto, onGenerate }: {
  data: Data; step: number; setStep: (n: number) => void;
  set: <K extends keyof Data>(k: K, v: Data[K]) => void; togglePick: (k: GiftKey) => void;
  onBack: () => void; fileRef: React.RefObject<HTMLInputElement | null>;
  removePhoto: (i: number) => void; onGenerate: () => void;
}) {
  const STEPS = 5;
  const next = () => setStep(Math.min(step + 1, STEPS - 1));
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
        {step === 1 && <>
          <Eyebrow>Step 2</Eyebrow><Q>Add a few of your photos</Q>
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
        {step === 2 && <>
          <Eyebrow>Step 3</Eyebrow><Q>One thing only the two of you would get</Q>
          <Area value={data.secret} onChange={(v) => set("secret", v)} placeholder="The diner on 8th. The way you say 'okay okay okay.'" />
          <Spacer /><Primary onClick={next}>Continue</Primary>
        </>}
        {step === 3 && <>
          <Eyebrow>Step 4</Eyebrow><Q style={{ fontStyle: "italic" }}>Finish this: <span style={{ color: C.gold }}>I love you because…</span></Q>
          <Area value={data.reason} onChange={(v) => set("reason", v)} placeholder="you make the hard days feel survivable." />
          <Spacer /><Primary onClick={next} disabled={!data.reason.trim()}>Continue</Primary>
        </>}
        {step === 4 && <>
          <Eyebrow>Last step</Eyebrow><Q>Choose your gift</Q>
          <p style={{ color: C.muted, marginTop: -6, fontSize: 14.5 }}>Pick one — or make all three.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
            {GIFTS.map((g) => {
              const on = data.picks.includes(g.key);
              return (
                <button key={g.key} onClick={() => togglePick(g.key)} style={{ textAlign: "left", padding: "15px 16px", borderRadius: 16, border: `1px solid ${on ? C.gold : C.line}`, background: on ? "rgba(235,180,92,.08)" : C.panel, color: C.ivory, display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ width: 42, height: 42, borderRadius: 12, background: C.panel2, display: "grid", placeItems: "center", color: on ? C.gold : C.muted, flex: "0 0 auto" }}><g.Icon size={20} /></span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontFamily: display, fontSize: 21, fontWeight: 500, display: "block" }}>{g.label}</span>
                    <span style={{ color: C.muted, fontSize: 13 }}>{g.desc}</span>
                  </span>
                  <span style={{ width: 24, height: 24, borderRadius: 999, border: `1.5px solid ${on ? C.gold : C.muted}`, display: "grid", placeItems: "center", background: on ? C.gold : "transparent", color: C.ink, flex: "0 0 auto" }}>{on && <Check size={15} />}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => { (["reel", "poem", "book"] as GiftKey[]).forEach((k) => { if (!data.picks.includes(k)) togglePick(k); }); }} style={{ background: "none", border: "none", color: C.gold, fontWeight: 600, fontSize: 13.5, marginTop: 14, alignSelf: "flex-start", padding: 4 }}>Make all three →</button>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {([{ k: "heartfelt", t: "Heartfelt" }, { k: "romantic", t: "Romantic" }, { k: "funny", t: "Funny" }] as { k: Tone; t: string }[]).map((o) => (
              <button key={o.k} onClick={() => set("tone", o.k)} style={{ flex: 1, padding: "9px", borderRadius: 11, border: `1px solid ${data.tone === o.k ? C.gold : C.line}`, background: data.tone === o.k ? "rgba(235,180,92,.08)" : "transparent", color: data.tone === o.k ? C.goldSoft : C.muted, fontSize: 13, fontWeight: 600 }}>{o.t}</button>
            ))}
          </div>
          <Spacer /><Primary onClick={onGenerate} disabled={!data.picks.length}>{data.picks.length > 1 ? `Make ${data.picks.length} gifts` : "Make it"}</Primary>
        </>}
      </div>
    </div>
  );
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
function Preview({ data, story, poem, active, setActive, unlocked, onBack, onUnlock, onSend }: {
  data: Data; story: ReturnType<typeof buildStory>; poem: string[];
  active: GiftKey; setActive: (k: GiftKey) => void; unlocked: boolean;
  onBack: () => void; onUnlock: () => void; onSend: () => void;
}) {
  const picks: GiftKey[] = data.picks.length ? data.picks : ["reel"];
  return (
    <div style={{ minHeight: "100vh", paddingBottom: 96, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 0" }}>
        <button onClick={onBack} aria-label="Back" style={{ background: "none", border: "none", color: C.ivory, padding: 4 }}><ArrowLeft size={22} /></button>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: unlocked ? C.gold : C.muted }}>{unlocked ? "Unlocked" : "Preview"}</span>
        <span style={{ width: 22 }} />
      </div>
      {picks.length > 1 && (
        <div style={{ display: "flex", gap: 8, padding: "16px 18px 0" }}>
          {picks.map((k) => {
            const g = giftByKey(k); const on = active === k;
            return (
              <button key={k} onClick={() => setActive(k)} style={{ flex: 1, padding: "9px 6px", borderRadius: 12, border: `1px solid ${on ? C.gold : C.line}`, background: on ? "rgba(235,180,92,.1)" : C.panel, color: on ? C.goldSoft : C.muted, fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><g.Icon size={15} />{g.label.replace("The ", "")}</button>
            );
          })}
        </div>
      )}
      <div style={{ padding: "16px 16px 0" }}>
        {active === "reel" && <Reel data={data} story={story} unlocked={unlocked} />}
        {active === "poem" && <Poem data={data} poem={poem} unlocked={unlocked} />}
        {active === "book" && <Book data={data} story={story} unlocked={unlocked} />}
      </div>

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ width: "100%", maxWidth: 430, padding: 16, background: `linear-gradient(180deg,transparent,${C.ink} 38%)`, pointerEvents: "auto" }}>
          {!unlocked
            ? <button onClick={onUnlock} style={btnGold}>Unlock {picks.length > 1 ? `all ${picks.length}` : ""} &amp; send · ${priceFor(picks.length)}</button>
            : <button onClick={onSend} style={btnGold}>Send it →</button>}
        </div>
      </div>
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
function Poem({ data, poem, unlocked }: { data: Data; poem: string[]; unlocked: boolean }) {
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
      <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
        <SecondaryBtn icon={<Download size={17} />} label="Download print" />
        <SecondaryBtn icon={<BookOpen size={17} />} label="Order framed" />
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
      <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
        <SecondaryBtn icon={<BookOpen size={17} />} label="Order hardcover · ships" />
      </div>
    </div>
  );
}

/* ─────────────────  done  ───────────────── */
function Done({ data, link, copied, onCopy, reminder, setReminder, onRestart }: {
  data: Data; link: string; copied: boolean; onCopy: () => void;
  reminder: boolean; setReminder: (b: boolean) => void; onRestart: () => void;
}) {
  return (
    <div style={{ minHeight: "100vh", padding: "30px 22px 40px", display: "flex", flexDirection: "column" }}>
      <div className="orx-rise" style={{ textAlign: "center", marginTop: 12 }}>
        <div style={{ width: 64, height: 64, margin: "0 auto", borderRadius: 999, display: "grid", placeItems: "center", background: "radial-gradient(circle,rgba(235,180,92,.25),transparent 70%)" }}><Flame size={42} /></div>
        <h1 style={{ fontFamily: display, fontWeight: 500, fontSize: 34, margin: "16px 0 4px" }}>It&apos;s ready to send.</h1>
        <p style={{ color: C.muted, fontSize: 15, margin: 0 }}>{data.picks.length > 1 ? `${data.picks.length} gifts` : "Your gift"} unlocked. Here&apos;s the private link.</p>
      </div>
      <div className="orx-rise" style={{ animationDelay: ".08s", marginTop: 26, padding: "14px 16px", borderRadius: 16, border: `1px solid ${C.line}`, background: C.panel, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link}</span>
        <button onClick={onCopy} style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6, background: C.panel2, border: `1px solid ${C.line}`, color: C.ivory, padding: "8px 12px", borderRadius: 10, fontWeight: 600, fontSize: 13 }}>{copied ? <><Check size={15} />Copied</> : <><Copy size={15} />Copy</>}</button>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <SecondaryBtn icon={<MessageCircle size={18} />} label="Text it" />
        <SecondaryBtn icon={<Mail size={18} />} label="Email it" />
      </div>
      <button onClick={() => setReminder(!reminder)} className="orx-rise" style={{ animationDelay: ".16s", textAlign: "left", marginTop: 26, padding: 20, borderRadius: 20, border: `1px solid ${reminder ? C.gold : C.line}`, background: reminder ? "rgba(235,180,92,.08)" : C.panel, color: C.ivory, display: "flex", gap: 14, alignItems: "flex-start" }}>
        <span style={{ marginTop: 2, color: reminder ? C.gold : C.muted }}>{reminder ? <Check size={22} /> : <Bell size={22} />}</span>
        <span><span style={{ fontFamily: display, fontSize: 21, fontWeight: 500, display: "block" }}>{reminder ? "We've got next year." : "Never let this happen again"}</span>
          <span style={{ color: C.muted, fontSize: 13.5, lineHeight: 1.5 }}>{reminder ? `We'll remind you before ${data.name || "their"} next anniversary and offer a one-tap reorder. Nothing else.` : `A reminder 2 weeks out next year + one-tap reorder. No spam — just this date.`}</span></span>
      </button>
      <button onClick={onRestart} style={{ marginTop: "auto", background: "none", border: "none", color: C.muted, fontSize: 13, padding: 18 }}>← Back to dashboard</button>
    </div>
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
function SecondaryBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 14, border: `1px solid ${C.line}`, background: C.panel, color: C.ivory, fontWeight: 600, fontSize: 13.5 }}>{icon}{label}</button>
  );
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
