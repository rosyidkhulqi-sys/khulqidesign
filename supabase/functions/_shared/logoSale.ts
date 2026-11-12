// Selling an Exclusive logo once its payment succeeds. Used by the webhook,
// and by anything that confirms a payment with Dodo directly.
import { db, dodoBase, env } from "./dodo.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// An Exclusive logo was paid for: it's sold to the buyer, unless someone else
// got there first (then the order is marked for a refund by hand).
export async function logoPaid(data: Record<string, any>) {
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
