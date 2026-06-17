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

// gift key -> deliverable_kind
const KIND: Record<string, "reel" | "poem" | "photobook"> = {
  reel: "reel",
  poem: "poem",
  book: "photobook",
};

const SYSTEM = `You polish anniversary notes. The human supplies the soul; you only arrange and lightly polish THEIR real fragments.
Hard rules:
- Use ONLY the facts and feelings the user provides. Never invent memories, names, places, or sentiment that isn't in their fragments.
- If a fragment is missing, omit that idea entirely — do not fabricate a replacement.
- Keep it short (2-4 sentences for the body), warm, and human; never flowery "AI" filler.
- Match the requested tone.
Respond with ONLY a JSON object: {"eyebrow": string, "headline": string, "body": string}. No prose, no code fences.`;

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

async function persist(orderId: string, giftKeys: string[], story: Story, poem: string[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createServiceClient();
  const keys = giftKeys.length ? giftKeys : ["reel"];
  const rows = keys.map((k) => ({
    order_id: orderId,
    kind: KIND[k] ?? "reel",
    status: "preview",
    payload: k === "poem" ? { poem } : { headline: story.headline, body: story.body },
  }));
  await supabase.from("deliverables" as never).insert(rows as never);
}

export async function generateDeliverables(input: {
  orderId: string;
  intake: Fragments;
  tone: Tone;
  giftKeys: string[];
}): Promise<{ story: Story; poem: string[] }> {
  const story = await polishStory(input.intake, input.tone);
  const poem = buildPoem(input.intake);
  await persist(input.orderId, input.giftKeys, story, poem);
  return { story, poem };
}
