"use server";

import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/config";

// Photo upload into the private `assets` bucket. The intake form fires these as files are added
// (fire-and-forget). Objects live at `{order_id}/{uuid}.{ext}`; a matching `assets` row records
// the storage_path + position. The bucket is private, so the share render uses signed URLs.

const BUCKET = "assets";

export async function uploadAsset(formData: FormData): Promise<{ path: string | null; url: string | null }> {
  const orderId = (formData.get("orderId") as string | null) ?? "";
  const file = formData.get("file") as File | null;
  const position = Number(formData.get("position") ?? 0);

  if (!file || !orderId || !isSupabaseConfigured()) return { path: null, url: null };

  const supabase = createServiceClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${orderId}/${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) return { path: null, url: null };

  await supabase.from("assets").insert({
    order_id: orderId,
    type: "photo",
    storage_path: path,
    source: "upload",
    position,
  });

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return { path, url: signed?.signedUrl ?? null };
}

// Signed URLs (7 day) for every asset on an order, ordered by position. Used by the share render.
export async function signedUrlsForOrder(orderId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("assets")
    .select("storage_path,position")
    .eq("order_id", orderId)
    .order("position");
  if (!data || data.length === 0) return [];

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(data.map((r) => r.storage_path), 60 * 60 * 24 * 7);

  return (signed ?? [])
    .map((s) => s.signedUrl)
    .filter((u): u is string => Boolean(u));
}
