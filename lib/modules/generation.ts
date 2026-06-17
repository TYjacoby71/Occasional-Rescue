"use server";

import Anthropic from "@anthropic-ai/sdk";
import { buildStory, buildPoem, type Tone } from "@/lib/story";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/config";

// Phase 3 generation. Polishes the user's real fragments into the Story-of-Us message via
// the Anthropic API (model from LLM_MODEL, default claude-opus-4-8), keyed off LLM_API_KEY.
// Falls back to the deterministic template builders when no key is set (dev) or on any error,
// so the flow always produces a deliverable.

type Fragments = { name: string; pet: string; secret: string; reason: string };
type Story = { eyebrow: string; headline: string; body: string };

// gift key -> deliverable_kind. Only the digital deliverables are generated here; print
// keepsakes (photobook/portrait/collage) are real shippable orders handled by the print
// checkout, not synthesized previews.
const KIND: Record<string, "reel" | "poem"> = {
  reel: "reel",
  poem: "poem",
};

const SYSTEM = `You polish anniversary notes. The human supplies the soul; you only arrange and lightly polish THEIR real fragments.
Hard rules:
- Use ONLY the facts and feelings the user provides. Never invent memories, names, places, or sentiment that isn't in their fragments.
- If a fragment is missing, omit that idea entirely — do not fabricate a replacement.
- Keep it short (2-4 sentences for the body), warm, and human; never flowery "AI" filler.
- Match the requested tone.
Respond with ONLY a JSON object: {"eyebrow": string, "headline": string, "body": string}. No prose, no code fences.`;

const POEM_SYSTEM = `You write short, intimate anniversary poems. The human supplies the soul; you only shape THEIR real fragments into verse.
Hard rules:
- Use ONLY the facts and feelings in the fragments. Never invent memories, names, places, or sentiment that isn't there.
- If a fragment is missing, omit that idea — do not fabricate a replacement.
- 8 to 14 short lines, free verse. Warm, specific, plainspoken; never greeting-card cliché or flowery "AI" filler.
- Match the requested tone.
- Structure: the FIRST line is a short dedication like "For <name> —". Use empty strings ("") as blank lines between stanzas.
Respond with ONLY a JSON object: {"lines": string[]}. No prose, no code fences.`;

function userPrompt(f: Fragments, tone: Tone): string {
  const who = f.pet || f.name || "them";
  const lines = [
    `Tone: ${tone}`,
    `Recipient name: ${f.name || "(not given)"}`,
    `What they call them: ${f.pet || "(not given)"}`,
    `A shared secret/inside thing: ${f.secret || "(not given)"}`,
    `"I love you because…": ${f.reason || "(not given)"}`,
  ];
  return `${lines.join("\n")}\n\nWrite the note to ${who}. Remember: only use the fragments above; omit anything not given.`;
}

function extractJson(text: string): Partial<Story> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Partial<Story>;
  } catch {
    return null;
  }
}

async function polishStory(f: Fragments, tone: Tone): Promise<Story> {
  const fallback = buildStory({ ...f, tone });
  const hasFragment = Boolean(f.reason?.trim() || f.secret?.trim());

  // Authenticity gate: with nothing real to polish, don't call the model (it would invent).
  if (!process.env.LLM_API_KEY || !hasFragment) return fallback;

  try {
    const client = new Anthropic({ apiKey: process.env.LLM_API_KEY });
    const model = process.env.LLM_MODEL || "claude-opus-4-8";
    const resp = await client.messages.create({
      model,
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt(f, tone) }],
    });
    const textBlock = resp.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return fallback;
    const parsed = extractJson(textBlock.text);
    if (!parsed) return fallback;
    return {
      eyebrow: parsed.eyebrow?.trim() || fallback.eyebrow,
      headline: parsed.headline?.trim() || fallback.headline,
      body: parsed.body?.trim() || fallback.body,
    };
  } catch {
    return fallback;
  }
}

function poemUserPrompt(f: Fragments, tone: Tone, variant: number): string {
  const who = f.pet || f.name || "them";
  const lines = [
    `Tone: ${tone}`,
    `Recipient name: ${f.name || "(not given)"}`,
    `What they call them: ${f.pet || "(not given)"}`,
    `A shared secret/inside thing: ${f.secret || "(not given)"}`,
    `"I love you because…": ${f.reason || "(not given)"}`,
  ];
  // variant > 0 means a "rework": ask for a genuinely different take so the new draft doesn't
  // just echo the first. The number nudges the model toward variety across reworks.
  const rework = variant > 0
    ? `\n\nThis is rework #${variant}. Write a NEW version with a different shape and imagery from any previous draft — same facts, fresh poem.`
    : "";
  return `${lines.join("\n")}\n\nWrite the poem for ${who}. Remember: only use the fragments above; omit anything not given.${rework}`;
}

function extractLines(text: string): string[] | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { lines?: unknown };
    if (!Array.isArray(parsed.lines)) return null;
    const lines = parsed.lines.map((l) => (typeof l === "string" ? l : "")).slice(0, 16);
    return lines.some((l) => l.trim()) ? lines : null;
  } catch {
    return null;
  }
}

// Compose the Poem from the user's fragments via the model, with the same authenticity gate and
// template fallback as the story. `variant` selects a deterministic fallback phrasing (offline) and
// signals a "rework" to the model (online). Used for the first draft (variant 0) and every rework.
async function composePoem(f: Fragments, tone: Tone, variant: number): Promise<string[]> {
  const fallback = buildPoem(f, variant);
  const hasFragment = Boolean(f.reason?.trim() || f.secret?.trim());

  // Authenticity gate: with nothing real to shape, don't call the model (it would invent).
  if (!process.env.LLM_API_KEY || !hasFragment) return fallback;

  try {
    const client = new Anthropic({ apiKey: process.env.LLM_API_KEY });
    const model = process.env.LLM_MODEL || "claude-opus-4-8";
    const resp = await client.messages.create({
      model,
      max_tokens: 600,
      temperature: 1, // poems want variety, especially across reworks
      system: POEM_SYSTEM,
      messages: [{ role: "user", content: poemUserPrompt(f, tone, variant) }],
    });
    const textBlock = resp.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return fallback;
    return extractLines(textBlock.text) ?? fallback;
  } catch {
    return fallback;
  }
}

async function persist(orderId: string, giftKeys: string[], story: Story, poem: string[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createServiceClient();
  const keys = giftKeys.length ? giftKeys : ["reel"];
  const rows = keys.map((k) => ({
    order_id: orderId,
    kind: KIND[k] ?? "reel",
    status: "preview" as const,
    payload: k === "poem" ? { poem } : { headline: story.headline, body: story.body },
  }));
  await supabase.from("deliverables").insert(rows);
}

export async function generateDeliverables(input: {
  orderId: string;
  intake: Fragments;
  tone: Tone;
  giftKeys: string[];
}): Promise<{ story: Story; poem: string[] }> {
  const [story, poem] = await Promise.all([
    polishStory(input.intake, input.tone),
    composePoem(input.intake, input.tone, 0),
  ]);
  await persist(input.orderId, input.giftKeys, story, poem);
  return { story, poem };
}

// The Poem's free-to-try rework: regenerate via the model (variant signals "make it different") and
// re-persist the poem deliverable so the eventual share link reflects the latest draft. The free-vs-
// paid cap is enforced client-side; this action just produces the next draft.
export async function reworkPoem(input: {
  orderId: string;
  intake: Fragments;
  tone: Tone;
  variant: number;
}): Promise<{ poem: string[] }> {
  const poem = await composePoem(input.intake, input.tone, input.variant);
  if (isSupabaseConfigured() && input.orderId) {
    const supabase = createServiceClient();
    await supabase
      .from("deliverables")
      .update({ payload: { poem } })
      .eq("order_id", input.orderId)
      .eq("kind", "poem");
  }
  return { poem };
}
