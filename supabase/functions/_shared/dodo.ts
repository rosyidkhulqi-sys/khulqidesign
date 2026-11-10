// What the Dodo Payments functions share. Secrets, set in Supabase:
//   DODO_API_KEY         from the mode in use, test or live
//   DODO_WEBHOOK_SECRET  from the webhook endpoint in the Dodo dashboard

export const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
};

const TEST_BASE = "https://test.dodopayments.com";
const LIVE_BASE = "https://live.dodopayments.com";

// A key only works on its own mode's address, so asking the test address tells
// which kind of key this is. Remembered until the key changes.
let checked: { key: string; test: Promise<boolean> } | null = null;

export function isTestMode() {
  const key = env("DODO_API_KEY");
  if (checked?.key !== key) {
    const test = fetch(`${TEST_BASE}/products?page_size=1`, { headers: { Authorization: `Bearer ${key}` } })
      .then((res) => res.status !== 401 && res.status !== 403)
      .catch(() => false);
    checked = { key, test };
  }
  return checked.test;
}

export const dodoBase = async () => ((await isTestMode()) ? TEST_BASE : LIVE_BASE);

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

export const productFor = async (plan: string) => PRODUCTS[(await isTestMode()) ? "test" : "live"][plan];

// the value for profiles.plan, or null for a product that isn't a plan
export function memberPlanOf(productId: string) {
  for (const products of [PRODUCTS.test, PRODUCTS.live]) {
    if (productId === products.founding) return "founding";
    if (productId === products.monthly || productId === products.yearly) return "premium";
  }
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
