import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getShare } from "@/lib/modules/share";
import { Microsite } from "@/components/Microsite";

// Public share microsite. Token-guarded (?t=) and rendered with the service role — no auth, no
// RLS round-trip. A missing or wrong token is a 404 (indistinguishable from "no such page").
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "A little something, made for you",
  description: "Someone made you a keepsake with Occasion Rescue.",
};

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  if (!t) notFound();

  const data = await getShare(slug, t);
  if (!data) notFound();

  return <Microsite data={data} />;
}
