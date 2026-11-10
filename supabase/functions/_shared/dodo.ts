// What the Dodo Payments functions share. Secrets, set in Supabase:
//   DODO_API_KEY         test keys start with dodo_test_
//   DODO_WEBHOOK_SECRET  from the webhook endpoint in the Dodo dashboard

export const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
};

export const isTestMode = () => env("DODO_API_KEY").startsWith("dodo_test_");

export const dodoBase = () =>
  isTestMode() ? "https://test.dodopayments.com" : "https://live.dodopayments.com";

// Test and live mode each have their own products. Add the live ids when the
// account is verified.
const PRODUCTS: Record<"test" | "live", Record<string, string>> = {
  test: {
    monthly: "pdt_0NrboQpATZ1gxmvLLr2VE",
    yearly: "pdt_0Nrbp8VqfDOcREGFj7kD6",
    founding: "pdt_0Nrc13aNoxxQpCuGTASOa",
  },
  live: {},
};

export const productFor = (plan: string) => PRODUCTS[isTestMode() ? "test" : "live"][plan];

// the value for profiles.plan, or null for a product that isn't a plan
export function memberPlanOf(productId: string) {
  const products = PRODUCTS[isTestMode() ? "test" : "live"];
  if (productId === products.founding) return "founding";
  if (productId === products.monthly || productId === products.yearly) return "premium";
  return null;
}

// The database with full rights (never sent to the browser). New-style secret
// keys go in apikey alone; the older service role key is a JWT and needs both.
function serviceKey() {
  try {
    const key = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
    if (key) return key as string;
  } catch {
    /* fall back below */
  }
  return env("SUPABASE_SERVICE_ROLE_KEY");
}

export function db(path: string, init: RequestInit = {}) {
  const key = serviceKey();
  return fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }),
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}
