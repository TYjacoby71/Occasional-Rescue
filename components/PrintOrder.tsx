"use client";

import { useState } from "react";
import { Truck, Mail, Check } from "lucide-react";
import { C, btnGold } from "@/lib/theme";
import { isPaywallBypass } from "@/lib/config";
import { startPrintCheckout, recordPrintOrderDev } from "@/lib/modules/payment";
import type { Gift } from "@/lib/gifts";

// Order CTA for a single catalog item — a shippable print keepsake OR a commerce voucher (gift
// card / experience). With Stripe configured it redirects to Checkout (which collects a shipping
// address for print items and charges the SERVER price); the webhook records the order and hands
// it to the supplier. In dev (no Stripe) it records a bypass order and confirms inline. The client
// sends only the slug + lead days — price is resolved server-side from the products table.
export function PrintOrder({ orderId, gift, days }: { orderId: string; gift: Gift; days: number }) {
  const [busy, setBusy] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bypass = isPaywallBypass();
  const isShip = gift.fulfillment === "print";
  const price = (gift.priceCents / 100).toFixed(0);

  async function handle() {
    setBusy(true);
    setError(null);
    if (bypass) {
      await recordPrintOrderDev({ orderId, slug: gift.key }).catch(() => {});
      setBusy(false);
      setOrdered(true);
      return;
    }
    const res = await startPrintCheckout({ orderId, slug: gift.key, daysUntil: days }).catch(() => null);
    if (res && "url" in res) {
      window.location.href = res.url;
      return;
    }
    if (res && "error" in res) {
      setError(res.error === "past_lead_window" ? "There's no longer time to ship this one." : "Something went wrong — try again.");
    }
    setBusy(false);
  }

  if (ordered) {
    return (
      <div style={{ padding: "14px 16px", borderRadius: 16, border: `1px solid ${C.gold}`, background: "rgba(235,180,92,.1)", color: C.ivory, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: C.gold }}><Check size={20} /></span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Order placed — your {gift.label.replace("The ", "")} is on its way{isShip ? "." : " to their inbox."}
        </span>
      </div>
    );
  }

  return (
    <>
      <button onClick={handle} disabled={busy} style={{ ...btnGold, opacity: busy ? 0.7 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {isShip ? <Truck size={18} /> : <Mail size={18} />} {isShip ? "Order & ship" : "Send the gift"} · ${price}
      </button>
      <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: 12, color: error ? C.blush : C.muted }}>
        {error
          ? error
          : `${gift.shipNote ? `${gift.shipNote} · ` : ""}${bypass ? "Dev mode — payment skipped." : isShip ? "Shipping collected at checkout." : "Delivered by email."}`}
      </p>
    </>
  );
}
