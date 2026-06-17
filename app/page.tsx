import { listOccasions } from "@/lib/modules/occasion";
import { Home } from "@/components/Home";

// Revalidate the carousel periodically so occasion_config edits (activating a new occasion)
// surface without a redeploy.
export const revalidate = 300;

// Dashboard home. Server-fetches the live occasion_config carousel, then hands off to the
// client shell. Active tiles route into the rescue flow; inactive ones open the "coming soon" sheet.
export default async function Page() {
  const occasions = await listOccasions();
  return <Home occasions={occasions} />;
}
