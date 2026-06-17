"use client";

import { useState } from "react";
import { C, btnGold } from "@/lib/theme";
import { isPaywallBypass } from "@/lib/config";
import { startCheckout, markOrderPaidDev } from "@/lib/modules/payment";

// The single paywall surface. In dev (no Stripe), it's a clickable continue link that marks
// the order paid and unlocks inline. With Stripe configured, it redirects to Checkout (which
// charges + saves the card for off-session reorders); the webhook flips the order to paid.
export function Paywall({
  orderId,
  amountCents,
  picksCount,
  onUnlock,
}: {
  orderId: string;
  amountCents: number;
  picksCount: number;
  onUnlock: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const bypass = isPaywallBypass();
  const price = (amountCents / 100).toFixed(amountCents % 100 ? 2 : 0);

  async function handle() {
    setBusy(true);
    if (bypass) {
      await markOrderPaidDev({ orderId, amountCents }).catch(() => {});
      onUnlock();
      return;
    }
    const res = await startCheckout({
      orderId,
      amountCents,
      label: `Occasion Rescue — ${picksCount > 1 ? `${picksCount} gifts` : "your gift"}`,
    }).catch(() => null);
    if (res && "url" in res) {
      window.location.href = res.url;
      return;
    }
    setBusy(false);
  }

  return (
    <>
      <button onClick={handle} disabled={busy} style={{ ...btnGold, opacity: busy ? 0.7 : 1 }}>
        Unlock {picksCount > 1 ? `all ${picksCount}` : ""} &amp; send · ${price}
      </button>
      {bypass && (
        <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: 12, color: C.muted }}>
          Dev mode — payment skipped. Tap to continue →
        </p>
      )}
    </>
  );
}
