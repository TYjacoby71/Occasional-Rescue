// Deliverable text builders — ported from the prototype.
//
// NOTE (Phase 3 follow-up): per the spec §11 authenticity guardrail and MVP-PLAN §4,
// real generation should use an LLM that POLISHES the user's fragments and never INVENTS
// sentiment — omitting a section when its fragment is missing rather than fabricating.
// These template builders are a deterministic placeholder; the empty-field fallbacks below
// are exactly the "invented sentiment" the real generator must avoid.

export type Tone = "heartfelt" | "romantic" | "funny";

export type StoryInput = {
  name: string;
  pet: string;
  secret: string;
  reason: string;
  tone: Tone;
};

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const lc = (s: string): string => {
  const t = (s || "").trim().replace(/[.]+$/, "").replace(/^because\s+/i, "");
  return t.charAt(0).toLowerCase() + t.slice(1);
};

export { cap, lc };

export function buildStory({ name, pet, secret, reason, tone }: StoryInput) {
  const who = (pet || name || "you").trim();
  const r = reason && reason.trim() ? lc(reason) : "";
  const s = secret && secret.trim() ? lc(secret) : "";

  if (tone === "funny")
    return {
      eyebrow: "A confession",
      headline: `${cap(who)}, I didn't forget`,
      body: `Okay, I left this to the last minute. But hear me out. ${
        r ? `I love you because ${r}.` : `I love you, even when I'm improvising.`
      } ${s ? `And yes — I still think about ${s}. ` : ""}Happy anniversary to the one who makes putting up with me look easy.`,
    };

  if (tone === "romantic")
    return {
      eyebrow: "For you",
      headline: "Still you. Always you.",
      body: `${cap(who)} — the best moments I've lived all have your name on them. ${
        r ? `I love you because ${r}.` : `I love you more than this page can hold.`
      } ${s ? `And when I think of ${s}, I'd choose this life again, every time.` : ""} Here's to everything still ahead.`,
    };

  return {
    eyebrow: `A note for ${who}`,
    headline: `For ${who}, with everything I have`,
    body: `${cap(who)}, the right words were never complicated. ${
      r ? `I love you because ${r}.` : `I love you — plainly, completely.`
    } ${s ? `Only we know about ${s}, and somehow it holds more of us than any photo could.` : ""} Thank you for every ordinary day that turned out to be the whole point.`,
  };
}

export function buildPoem({ name, pet, secret, reason }: Omit<StoryInput, "tone">): string[] {
  const who = cap(pet || name || "you");
  const sec = secret && secret.trim() ? cap(lc(secret)) : "The ordinary mornings";
  const rea = reason && reason.trim() ? lc(reason) : "you make the noise of the world go quiet";
  return [
    `For ${who} —`,
    "",
    `Not for the grand days do I love you most,`,
    `but for the small, unwitnessed kind:`,
    `${sec},`,
    `the jokes that need no telling, the half-said line.`,
    "",
    `I love you because ${rea},`,
    `and still, after all the years,`,
    `the door swings open and my chest goes light —`,
    `still you, still here, still ours.`,
  ];
}
