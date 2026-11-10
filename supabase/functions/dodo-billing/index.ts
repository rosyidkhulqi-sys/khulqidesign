// Starts a Dodo checkout, or opens the customer portal, for the signed-in user.
//
// POST { action: "checkout", plan: "monthly" | "yearly" | "founding" } -> { url }
// POST { action: "portal" } -> { url }
//
// While the API key is a test key only admins get through, so nobody can take
// Premium with a test card.
import { db, dodoBase, env, isTestMode, productFor } from "../_shared/dodo.ts";

const ALLOWED_ORIGINS = [
  "https://khulqidesign.com",
  "https://www.khulqidesign.com",
  "http://localhost:5173",
];
const PUBLISHABLE_KEY = "sb_publishable_IxJSv34yZhNyGkgWbvYAjg_UFmo6CDO";
const FOUNDING_SEATS = 500;

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function reply(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

const dodo = async (path: string, init: RequestInit = {}) =>
  fetch(`${await dodoBase()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env("DODO_API_KEY")}`, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405, origin);

  // the owner sees why something failed; visitors only a plain message
  let isAdmin = false;

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || token.startsWith("sb_")) return reply({ error: "sign_in_required" }, 401, origin);

    const base = env("SUPABASE_URL");
    const asUser = { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };
    const userRes = await fetch(`${base}/auth/v1/user`, { headers: asUser });
    if (!userRes.ok) return reply({ error: "sign_in_required" }, 401, origin);
    const user = await userRes.json();

    const adminRes = await fetch(`${base}/rest/v1/rpc/is_admin`, {
      method: "POST",
      headers: { ...asUser, "Content-Type": "application/json" },
      body: "{}",
    });
    isAdmin = adminRes.ok && (await adminRes.json()) === true;
    const testMode = await isTestMode();
    if (testMode && !isAdmin) return reply({ error: "not_open" }, 403, origin);

    const { action, plan } = await req.json();
    const site = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    if (action === "portal") {
      const rows = await (await db(`billing?user_id=eq.${user.id}&select=customer_id`)).json();
      const customer = rows[0]?.customer_id;
      if (!customer) return reply({ error: "no_subscription" }, 404, origin);
      const returnUrl = encodeURIComponent(`${site}/account`);
      const res = await dodo(`/customers/${encodeURIComponent(customer)}/customer-portal/session?return_url=${returnUrl}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`portal ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return reply({ url: (await res.json()).link }, 200, origin);
    }

    if (action !== "checkout") return reply({ error: "unknown action" }, 400, origin);
    const productId = await productFor(plan);
    if (!productId) {
      return reply({ error: testMode ? "unknown_plan" : "live_products_missing" }, 400, origin);
    }

    // no second subscription on top of one still running (tests may repeat)
    const profiles = await (await db(`profiles?id=eq.${user.id}&select=plan,plan_renews_at`)).json();
    const profile = profiles[0];
    const running = profile && profile.plan !== "free" &&
      (!profile.plan_renews_at || new Date(profile.plan_renews_at) > new Date());
    if (running && !testMode) return reply({ error: "already_subscribed" }, 409, origin);

    if (plan === "founding") {
      const count = await db("profiles?plan=eq.founding&select=id", {
        method: "HEAD",
        headers: { Prefer: "count=exact" },
      });
      const taken = Number(count.headers.get("Content-Range")?.split("/")[1] ?? 0);
      if (taken >= FOUNDING_SEATS) return reply({ error: "founding_sold_out" }, 409, origin);
    }

    // kept so the webhook can still find the account by email
    const saved = await db("billing?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ user_id: user.id, email: user.email?.toLowerCase(), updated_at: new Date().toISOString() }),
    });
    if (!saved.ok) throw new Error(`billing ${saved.status}: ${(await saved.text()).slice(0, 200)}`);

    const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
    const res = await dodo("/checkouts", {
      method: "POST",
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email: user.email, ...(name ? { name } : {}) },
        metadata: { user_id: user.id, plan },
        return_url: `${site}/account?checkout=done`,
        // the email ties the payment to this account
        feature_flags: { allow_customer_editing_email: false },
      }),
    });
    if (!res.ok) throw new Error(`checkout ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return reply({ url: (await res.json()).checkout_url }, 200, origin);
  } catch (e) {
    console.error(e);
    return reply({ error: "billing_failed", ...(isAdmin ? { detail: String(e) } : {}) }, 500, origin);
  }
});
