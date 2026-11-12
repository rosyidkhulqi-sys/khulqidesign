// Premium and Founding checkout. Dodo Payments takes the payment; the
// dodo-webhook Edge Function then sets the member's plan.
import { supabase } from "./supabaseClient";

// Stays off on the live site until the Dodo account is verified and uses live
// keys. Turned on for this machine in .env.local.
export const CHECKOUT_OPEN = import.meta.env.VITE_CHECKOUT_OPEN === "true";

const MESSAGES = {
  not_open: "Checkout isn't open yet.",
  already_subscribed: "You already have a plan. Manage it from your account.",
  founding_sold_out: "All founding member places have been taken.",
  no_subscription: "We couldn't find a subscription on this account.",
  sold: "This logo has just been sold.",
  reserved: "Someone is buying this logo right now. If they don't finish, it's free again within an hour.",
  not_found: "This logo isn't for sale.",
  live_products_missing: "This API key is a live key, but only test products are set up.",
};

async function call(body) {
  const { data, error } = await supabase.functions.invoke("dodo-billing", { body });
  if (error) {
    let code, detail;
    try {
      ({ error: code, detail } = await error.context.json());
    } catch {
      /* not a JSON body */
    }
    // detail only ever reaches admins
    throw new Error(MESSAGES[code] ?? detail ?? "Something went wrong. Please try again.");
  }
  return data.url;
}

// sends the browser to Dodo's secure payment page
export async function startCheckout(plan) {
  window.location.href = await call({ action: "checkout", plan });
}

// an Exclusive logo, bought outright
export async function startLogoCheckout(assetId) {
  window.location.href = await call({ action: "logo", asset: assetId });
}

// Dodo's page for changing the card or cancelling
export async function openBillingPortal() {
  window.location.href = await call({ action: "portal" });
}

// the signed-in member's plan as it stands right now
export async function fetchMembership(userId) {
  const [{ data: profile }, { data: billing }] = await Promise.all([
    supabase.from("profiles").select("plan, plan_renews_at, role").eq("id", userId).maybeSingle(),
    supabase.from("billing").select("customer_id, cancel_at_period_end, current_period_end").eq("user_id", userId).maybeSingle(),
  ]);
  const lapsed = profile?.plan_renews_at && new Date(profile.plan_renews_at) < new Date();
  const plan = !profile || lapsed ? "free" : profile.plan;
  return {
    plan,
    paid: plan !== "free",
    periodEnd: billing?.current_period_end ?? null,
    cancelling: billing?.cancel_at_period_end ?? false,
    canManage: Boolean(billing?.customer_id),
    // Premium tools: paid members, and the owner to check them
    canUsePremium: plan !== "free" || profile?.role === "admin",
  };
}
