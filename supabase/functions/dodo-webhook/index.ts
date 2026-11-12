// Dodo Payments tells this function when a subscription starts, renews or
// ends, and it sets the member's plan. It follows the Standard Webhooks
// signature; anything unsigned is refused.
//
// profiles.plan_renews_at is the moment record_download stops honoring the
// plan. It gets two extra days on a running subscription, so a renewal that
// reaches us a little late doesn't lock anyone out.
import { db, dodoBase, env, memberPlanOf } from "../_shared/dodo.ts";

const GRACE_MS = 2 * 24 * 60 * 60 * 1000;
const TOLERANCE_S = 300;

const bytes = (text: string) => new TextEncoder().encode(text);
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const toBase64 = (data: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(data)));

function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verified(headers: Headers, body: string) {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!id || !timestamp || !signatures) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_S) return false;

  const secret = env("DODO_WEBHOOK_SECRET");
  const raw = secret.startsWith("whsec_") ? fromBase64(secret.slice(6)) : bytes(secret);
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = toBase64(await crypto.subtle.sign("HMAC", key, bytes(`${id}.${timestamp}.${body}`)));
  return signatures.split(" ").some((part) => sameText(part.split(",")[1] ?? "", expected));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// the account: from the checkout's metadata, else the subscription or email
// remembered when checkout started
async function findBilling(data: Record<string, any>) {
  const fromMetadata = data.metadata?.user_id;
  if (typeof fromMetadata === "string" && UUID.test(fromMetadata)) {
    const rows = await (await db(`billing?user_id=eq.${fromMetadata}&select=user_id,last_event_at`)).json();
    return rows[0] ?? { user_id: fromMetadata, last_event_at: null };
  }
  if (data.subscription_id) {
    const rows = await (await db(`billing?subscription_id=eq.${encodeURIComponent(data.subscription_id)}&select=user_id,last_event_at`)).json();
    if (rows[0]) return rows[0];
  }
  const email = data.customer?.email?.toLowerCase();
  if (email) {
    const rows = await (await db(`billing?email=eq.${encodeURIComponent(email)}&select=user_id,last_event_at&order=updated_at.desc&limit=1`)).json();
    if (rows[0]) return rows[0];
  }
  return null;
}

// An Exclusive logo was paid for: it's sold to the buyer, unless someone else
// got there first (then the order is marked for a refund by hand).
async function logoPaid(data: Record<string, any>) {
  let order = null;
  const orderId = data.metadata?.order_id;
  if (typeof orderId === "string" && UUID.test(orderId)) {
    order = (await (await db(`logo_orders?id=eq.${orderId}&select=*`)).json())[0];
  } else {
    // no metadata on the payment: the logo's own product names it
    const ids = (data.product_cart ?? []).map((p: { product_id?: string }) => p.product_id).filter(Boolean);
    if (ids.length) {
      const list = ids.map((id: string) => `"${id}"`).join(",");
      order = (await (await db(`logo_orders?product_id=in.(${list})&status=eq.pending&select=*&order=created_at.desc&limit=1`)).json())[0];
    }
  }
  // a subscription payment, or not ours
  if (!order) return new Response("not a logo");
  if (order.status === "paid") return new Response("already done");

  const now = new Date().toISOString();
  const sold = await db(`assets?id=eq.${order.asset_id}&sold_at=is.null`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ sold_at: now, sold_to: order.user_id }),
  });
  if (!sold.ok) throw new Error(`sell ${sold.status}: ${(await sold.text()).slice(0, 200)}`);
  const won = (await sold.json()).length > 0;

  await db(`logo_orders?id=eq.${order.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: won ? "paid" : "conflict", payment_id: data.payment_id ?? null, updated_at: now }),
  });
  if (!won) {
    console.error("logo sold twice; refund this payment", data.payment_id, order.asset_id);
    return new Response("conflict");
  }
  // off sale at Dodo too
  await fetch(`${await dodoBase()}/products/${encodeURIComponent(order.product_id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${env("DODO_API_KEY")}` },
  }).catch(() => {});
  return new Response("ok");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const body = await req.text();

  try {
    if (!(await verified(req.headers, body))) return new Response("invalid signature", { status: 401 });

    const event = JSON.parse(body);
    // kept as received; a repeat of the same delivery is stored once
    await db("dodo_events?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({ id: req.headers.get("webhook-id"), type: event.type, payload: event }),
    });

    if (event.type === "payment.succeeded") return await logoPaid(event.data ?? {});
    if (!String(event.type).startsWith("subscription.")) return new Response("ignored");

    const data = event.data;
    const plan = memberPlanOf(data.product_id);
    if (!plan) return new Response("not a plan");

    const billing = await findBilling(data);
    // answered with an error so it shows in Dodo's webhook log and is retried
    if (!billing) {
      console.error("no account for subscription", data.subscription_id);
      return new Response("no account", { status: 500 });
    }

    const at = new Date(event.timestamp);
    if (billing.last_event_at && new Date(billing.last_event_at) > at) return new Response("stale");

    const next = data.next_billing_date ? new Date(data.next_billing_date) : null;
    const cancelling = data.cancel_at_next_billing_date === true;
    let profile: { plan: string; plan_renews_at: string | null } | null = null;

    switch (event.type) {
      case "subscription.active":
      case "subscription.renewed":
      case "subscription.updated":
      case "subscription.plan_changed":
      case "subscription.unpaused":
        if (data.status === "active") {
          const until = next && !cancelling ? new Date(next.getTime() + GRACE_MS) : next;
          profile = { plan, plan_renews_at: until ? until.toISOString() : null };
        }
        break;
      case "subscription.cancelled":
        // what's been paid for still runs to the end of its period
        profile = next && next > new Date()
          ? { plan, plan_renews_at: next.toISOString() }
          : { plan: "free", plan_renews_at: null };
        break;
      case "subscription.on_hold":
      case "subscription.failed":
      case "subscription.expired":
      case "subscription.paused":
        profile = { plan: "free", plan_renews_at: null };
        break;
      // past_due and the rest: nothing changes yet
    }

    if (profile) {
      const res = await db(`profiles?id=eq.${billing.user_id}`, { method: "PATCH", body: JSON.stringify(profile) });
      if (!res.ok) throw new Error(`profile ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const saved = await db("billing?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        user_id: billing.user_id,
        customer_id: data.customer?.customer_id ?? null,
        subscription_id: data.subscription_id ?? null,
        product_id: data.product_id,
        status: data.status ?? null,
        cancel_at_period_end: cancelling || event.type === "subscription.cancelled",
        current_period_end: next ? next.toISOString() : null,
        last_event_at: at.toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
    if (!saved.ok) throw new Error(`billing ${saved.status}: ${(await saved.text()).slice(0, 200)}`);

    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
