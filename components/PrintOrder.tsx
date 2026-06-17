"use client";

import { useState } from "react";
import { Truck, Check } from "lucide-react";
import { C, btnGold } from "@/lib/theme";
import { isPaywallBypass } from "@/lib/config";
import { startPrintCheckout, recordPrintOrderDev } from "@/lib/modules/payment";
import type { Gift } from "@/lib/gifts";

// Order CTA for a print-on-demand keepsake. With Stripe configured it redirects to Checkout,
// which collects the shipping address and charges the item price; the webhook records the order
// + address for fulfillment. In dev (no Stripe) it records a bypass order and confirms inline.
export function PrintOrder({ orderId, gift }: { orderId: string; gift: Gift }) {
  const [busy, setBusy] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const bypass = isPaywallBypass();
  const price = (gift.priceCents / 100).toFixed(0);

  async function handle() {
    setBusy(true);
    if (bypass) {
      await recordPrintOrderDev({ orderId, kind: gift.kind, priceCents: gift.priceCents }).catch(() => {});
      setBusy(false);
      setOrdered(true);
      return;
    }
    const res = await startPrintCheckout({
      orderId,
      kind: gift.kind,
      label: `Occasion Rescue — ${gift.label}`,
      priceCents: gift.priceCents,
    }).catch(() => null);
    if (res && "url" in res) {
      window.location.href = res.url;
      return;
    }
    setBusy(false);
  }

  if (ordered) {
    return (
      <div style={{ padding: "14px 16px", borderRadius: 16, border: `1px solid ${C.gold}`, background: "rgba(235,180,92,.1)", color: C.ivory, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: C.gold }}><Check size={20} /></span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Order placed — your {gift.label.replace("The ", "")} is on its way.</span>
      </div>
    );
  }

  return (
    <>
      <button onClick={handle} disabled={busy} style={{ ...btnGold, opacity: busy ? 0.7 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Truck size={18} /> Order &amp; ship · ${price}
      </button>
      <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: 12, color: C.muted }}>
        {gift.shipNote ? `${gift.shipNote} · ` : ""}{bypass ? "Dev mode — payment skipped." : "Shipping collected at checkout."}
      </p>
    </>
  );
}
