import type { Product } from "@/lib/modules/catalog";

// Supplier fulfillment. A paid print/keepsake order is handed to a print-on-demand supplier so it
// ships without us touching it. The live integration is Prodigi (Orders API). It activates only
// when PRODIGI_API_KEY is set AND we have everything the supplier needs (a real SKU, a shipping
// address, and print-ready artwork URLs). Anything else — no key, a commerce voucher (Tremendous),
// missing artwork — falls back to 'concierge': the order is recorded and a human/queue fulfills it.
//
// This mirrors the rest of the codebase: real integration when configured, graceful no-op in dev.
// It NEVER throws into the webhook — fulfillment failures are captured as a status, not a 500.

const PRODIGI_BASE = process.env.PRODIGI_API_BASE || "https://api.sandbox.prodigi.com";

export function isProdigiConfigured(): boolean {
  return Boolean(process.env.PRODIGI_API_KEY);
}

// Stripe's collected shipping shape (collected_information.shipping_details), loosely typed.
export type ShippingDetails = {
  name?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
} | null;

export type FulfillmentResult = {
  status: "submitted" | "concierge" | "error";
  supplier: string | null;
  supplierOrderId: string | null;
  detail?: string;
};

export async function submitToSupplier(input: {
  product: Product;
  orderId: string;
  shipping: ShippingDetails;
  recipientEmail: string | null;
  assetUrls: string[];
}): Promise<FulfillmentResult> {
  const { product, orderId, shipping, recipientEmail, assetUrls } = input;
  const supplier = product.supplier;

  // Only Prodigi is wired for auto-submit today. Everything else is concierge-fulfilled.
  const canAutoSubmit =
    supplier === "prodigi" &&
    isProdigiConfigured() &&
    Boolean(product.supplier_sku) &&
    Boolean(shipping?.address?.line1) &&
    assetUrls.length > 0;

  if (!canAutoSubmit) {
    return {
      status: "concierge",
      supplier,
      supplierOrderId: null,
      detail: reasonForConcierge(product, shipping, assetUrls),
    };
  }

  try {
    const res = await prodigiCreateOrder({ product, orderId, shipping: shipping!, recipientEmail, assetUrls });
    return { status: "submitted", supplier, supplierOrderId: res.id, detail: res.stage };
  } catch (err) {
    // Never bubble up: record the failure so it can be retried/triaged, but let the webhook 200.
    return {
      status: "error",
      supplier,
      supplierOrderId: null,
      detail: err instanceof Error ? err.message : "supplier request failed",
    };
  }
}

function reasonForConcierge(product: Product, shipping: ShippingDetails, assetUrls: string[]): string {
  if (product.supplier !== "prodigi") return `concierge: ${product.supplier ?? "manual"} fulfillment`;
  if (!isProdigiConfigured()) return "concierge: PRODIGI_API_KEY not set";
  if (!product.supplier_sku) return "concierge: no supplier_sku";
  if (!shipping?.address?.line1) return "concierge: no shipping address";
  if (!assetUrls.length) return "concierge: no print artwork";
  return "concierge";
}

async function prodigiCreateOrder(input: {
  product: Product;
  orderId: string;
  shipping: NonNullable<ShippingDetails>;
  recipientEmail: string | null;
  assetUrls: string[];
}): Promise<{ id: string | null; stage: string | undefined }> {
  const { product, orderId, shipping, recipientEmail, assetUrls } = input;
  const addr = shipping.address ?? {};

  const body = {
    merchantReference: orderId,
    shippingMethod: "Standard",
    recipient: {
      name: shipping.name ?? "Occasion Rescue customer",
      email: recipientEmail ?? undefined,
      address: {
        line1: addr.line1 ?? "",
        line2: addr.line2 ?? undefined,
        postalOrZipCode: addr.postal_code ?? "",
        countryCode: addr.country ?? "US",
        townOrCity: addr.city ?? "",
        stateOrCounty: addr.state ?? undefined,
      },
    },
    items: [
      {
        merchantReference: product.slug,
        sku: product.supplier_sku,
        copies: 1,
        sizing: "fillPrintArea",
        assets: assetUrls.map((url) => ({ printArea: "default", url })),
      },
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${PRODIGI_BASE}/v4.0/Orders`, {
      method: "POST",
      headers: {
        "X-API-Key": process.env.PRODIGI_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as {
      order?: { id?: string; status?: { stage?: string } };
      message?: string;
    };
    if (!res.ok) {
      throw new Error(`prodigi ${res.status}: ${json.message ?? "order rejected"}`);
    }
    return { id: json.order?.id ?? null, stage: json.order?.status?.stage };
  } finally {
    clearTimeout(timeout);
  }
}
