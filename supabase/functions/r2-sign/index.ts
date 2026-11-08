// r2-sign: short-lived signed URLs for Cloudflare R2, for admins only.
//
// The browser never holds R2 keys. The /admin page asks this function for a
// signed PUT URL, then uploads the file straight to R2 (no file passes
// through Supabase). Signed URLs expire after 10 minutes.
//
// POST { action: "upload", bucket: "public" | "private", key, contentType }
//   -> { url, method: "PUT", headers, expiresIn }
// POST { action: "delete", bucket, key }
//   -> { ok: true }
//
// Secrets (Supabase -> Edge Functions -> Secrets):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//   R2_PUBLIC_BUCKET (public-files), R2_PRIVATE_BUCKET (private-files)
// SUPABASE_URL comes from Supabase.
//
// Download links for buyers come later in their own function, which checks
// the plan, the license and the daily limit before signing a GET.
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const ALLOWED_ORIGINS = [
  "https://khulqidesign.com",
  "https://www.khulqidesign.com",
  "http://localhost:5173",
];

// every object lives under one of these folders
const PREFIXES = ["icons/", "vectors/", "logos/", "footage/", "templates/", "elements/", "sets/"];
const EXPIRES = 600;

// The project's publishable key, public by design (it ships in the site).
const PUBLISHABLE_KEY = "sb_publishable_IxJSv34yZhNyGkgWbvYAjg_UFmo6CDO";

const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
};

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

// a plain object key: a known folder, no "..", no leading slash, sane length
function validKey(key: unknown): key is string {
  return typeof key === "string" &&
    key.length > 0 && key.length <= 300 &&
    !key.includes("..") && !key.startsWith("/") &&
    /^[A-Za-z0-9._\-\/ ]+$/.test(key) &&
    PREFIXES.some((p) => key.startsWith(p));
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405, origin);

  // Who is asking: the signed-in user's own token, checked by Supabase Auth,
  // then their role with is_admin(). Both calls use the publishable key, which
  // works on projects with the new API keys (the legacy anon key may not).
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.startsWith("sb_")) return reply({ error: "sign in first (no session token)" }, 401, origin);
  const base = env("SUPABASE_URL");
  const asUser = { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };

  const userRes = await fetch(`${base}/auth/v1/user`, { headers: asUser });
  if (!userRes.ok) {
    const detail = await userRes.text().catch(() => "");
    return reply({ error: `sign in first (auth ${userRes.status}: ${detail.slice(0, 120)})` }, 401, origin);
  }

  const roleRes = await fetch(`${base}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { ...asUser, "Content-Type": "application/json" },
    body: "{}",
  });
  const isAdmin = roleRes.ok ? await roleRes.json() : null;
  if (isAdmin !== true) {
    return reply({ error: roleRes.ok ? "admins only" : `role check failed (${roleRes.status})` }, 403, origin);
  }

  let body: { action?: string; bucket?: string; key?: unknown; contentType?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "invalid JSON" }, 400, origin);
  }

  const bucket = body.bucket === "public" ? env("R2_PUBLIC_BUCKET")
    : body.bucket === "private" ? env("R2_PRIVATE_BUCKET")
    : null;
  if (!bucket) return reply({ error: "bucket must be public or private" }, 400, origin);
  if (!validKey(body.key)) return reply({ error: "invalid key" }, 400, origin);

  const r2 = new AwsClient({
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
  const objectUrl = `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${bucket}/` +
    body.key.split("/").map(encodeURIComponent).join("/");

  if (body.action === "upload") {
    const contentType = typeof body.contentType === "string" && body.contentType.length < 100
      ? body.contentType
      : "application/octet-stream";
    const signed = await r2.sign(
      new Request(`${objectUrl}?X-Amz-Expires=${EXPIRES}`, {
        method: "PUT",
        headers: { "Content-Type": contentType },
      }),
      { aws: { signQuery: true } },
    );
    return reply({ url: signed.url, method: "PUT", headers: { "Content-Type": contentType }, expiresIn: EXPIRES }, 200, origin);
  }

  if (body.action === "delete") {
    const res = await r2.fetch(objectUrl, { method: "DELETE" });
    if (!res.ok && res.status !== 404) return reply({ error: `R2 said ${res.status}` }, 502, origin);
    return reply({ ok: true }, 200, origin);
  }

  return reply({ error: "action must be upload or delete" }, 400, origin);
});
