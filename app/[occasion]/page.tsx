import { notFound } from "next/navigation";
import { findOccasion } from "@/lib/occasions";
import { RescueFlow } from "@/components/RescueFlow";

// Only active occasions have a live rescue flow for the MVP (anniversary). Others 404
// and are reached via the dashboard's "coming soon" sheet instead.
export default async function OccasionPage({
  params,
}: {
  params: Promise<{ occasion: string }>;
}) {
  const { occasion: key } = await params;
  const occasion = findOccasion(key);
  if (!occasion || !occasion.active) notFound();

  return (
    <RescueFlow
      occasion={{
        key: occasion.key,
        label: occasion.label,
        dateRule: occasion.dateRule,
        giftTarget: occasion.giftTarget,
      }}
    />
  );
}
