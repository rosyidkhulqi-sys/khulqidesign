// r2-sign: short-lived signed URLs for Cloudflare R2.
//
// The browser never holds R2 keys. The /admin page asks this function for a
// signed PUT URL and uploads straight to R2 (admins only). Any signed-in
// account can ask for a download: record_download() in the database checks
// the license, plan and daily limit and writes the download row, then this
// function signs a GET for the original in the private bucket.
//
// POST { action: "download", asset, format }      (any signed-in account)
//   -> { url, filename, license, expiresIn }  or  { error: "daily_limit" | ... }
// POST { action: "upload", bucket: "public" | "private", key, contentType }
//   -> { url, method: "PUT", headers, expiresIn }   (admins)
// POST { action: "delete", bucket, key }  -> { ok: true }   (admins)
//
// Secrets (Supabase -> Edge Functions -> Secrets):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//   R2_PUBLIC_BUCKET (public-files), R2_PRIVATE_BUCKET (private-files)
// SUPABASE_URL comes from Supabase.

import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const ALLOWED_ORIGINS = [
  "https://khulqidesign.com",
  "https://www.khulqidesign.com",
  "http://localhost:5173",
];

// every object lives under one of these folders
const PREFIXES = ["icons/", "vectors/", "logos/", "footage/", "templates/", "elements/", "sets/", "photos/", "mockups/", "fonts/"];
const EXPIRES = 600;
// download links are short: long enough to start, too short to pass around
const DOWNLOAD_EXPIRES = 300;

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

  let body: { action?: string; bucket?: string; key?: unknown; contentType?: unknown; asset?: unknown; format?: unknown; uploadId?: unknown; part?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "invalid JSON" }, 400, origin);
  }

  const r2 = new AwsClient({
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
  const objectUrlFor = (bucket: string, key: string) =>
    `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${bucket}/` +
    key.split("/").map(encodeURIComponent).join("/");

  // DOWNLOAD: the database decides, this function only signs
  if (body.action === "download") {
    if (typeof body.asset !== "string" || typeof body.format !== "string") {
      return reply({ error: "asset and format are required" }, 400, origin);
    }
    const gate = await fetch(`${base}/rest/v1/rpc/record_download`, {
      method: "POST",
      headers: { ...asUser, "Content-Type": "application/json" },
      body: JSON.stringify({ p_asset: body.asset, p_format: body.format }),
    });
    const result = await gate.json().catch(() => null);
    if (!gate.ok) {
      // raised codes from record_download: daily_limit, premium_required...
      return reply({ error: result?.message ?? `download refused (${gate.status})` }, 403, origin);
    }
    if (!validKey(result?.key)) return reply({ error: "file missing" }, 500, origin);
    // vector originals may be stored gzip-compressed ("….eps.gz"): the
    // browser fetches and unpacks them, and saves the file under its real name
    const gzip = result.key.endsWith(".gz");
    const ext = result.key.replace(/\.gz$/, "").split(".").pop();
    const name = `${result.code}-${String(result.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)}.${ext}`;
    const type = { eps: "application/postscript", jpg: "image/jpeg", jpeg: "image/jpeg", ai: "application/postscript", psd: "image/vnd.adobe.photoshop", png: "image/png", zip: "application/zip" }[ext.toLowerCase()];
    const signed = await r2.sign(
      new Request(
        `${objectUrlFor(env("R2_PRIVATE_BUCKET"), result.key)}?X-Amz-Expires=${DOWNLOAD_EXPIRES}` +
          (gzip ? "" : `&response-content-disposition=${encodeURIComponent(`attachment; filename="${name}"`)}`),
        { method: "GET" },
      ),
      { aws: { signQuery: true } },
    );
    return reply({ url: signed.url, filename: name, gzip, type, license: result.license, expiresIn: DOWNLOAD_EXPIRES }, 200, origin);
  }

  // everything else is for admins
  const roleRes = await fetch(`${base}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { ...asUser, "Content-Type": "application/json" },
    body: "{}",
  });
  const isAdmin = roleRes.ok ? await roleRes.json() : null;
  if (isAdmin !== true) {
    return reply({ error: roleRes.ok ? "admins only" : `role check failed (${roleRes.status})` }, 403, origin);
  }

  // UPLOAD-MANY: signed PUT links for a whole batch in one call (one sign-in
  // and admin check instead of one per file)
  //   { action: "upload-many", files: [{ bucket, key, contentType }] } -> { urls: { key: url } }
  if (body.action === "upload-many") {
    const files = (body as { files?: unknown }).files;
    if (!Array.isArray(files) || !files.length || files.length > 200) {
      return reply({ error: "files must hold 1 to 200 files" }, 400, origin);
    }
    const urls: Record<string, string> = {};
    for (const f of files as { bucket?: string; key?: unknown; contentType?: unknown }[]) {
      const b = f?.bucket === "public" ? env("R2_PUBLIC_BUCKET") : f?.bucket === "private" ? env("R2_PRIVATE_BUCKET") : null;
      if (!b || !validKey(f.key)) return reply({ error: "every file needs a bucket and a valid key" }, 400, origin);
      const type = typeof f.contentType === "string" && f.contentType.length < 100 ? f.contentType : "application/octet-stream";
      const signed = await r2.sign(
        new Request(`${objectUrlFor(b, f.key)}?X-Amz-Expires=${EXPIRES}`, { method: "PUT", headers: { "Content-Type": type } }),
        { aws: { signQuery: true } },
      );
      urls[f.key] = signed.url;
    }
    return reply({ urls, expiresIn: EXPIRES }, 200, origin);
  }

  const bucket = body.bucket === "public" ? env("R2_PUBLIC_BUCKET")
    : body.bucket === "private" ? env("R2_PRIVATE_BUCKET")
    : null;
  if (!bucket) return reply({ error: "bucket must be public or private" }, 400, origin);
  if (!validKey(body.key)) return reply({ error: "invalid key" }, 400, origin);

  const objectUrl = objectUrlFor(bucket, body.key);

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

  // MULTIPART, for big files (footage): the browser sends the file in parts,
  // and a dropped part is sent again on its own instead of the whole file.
  //   mp-start    { contentType }        -> { uploadId }
  //   mp-part     { uploadId, part }     -> { url }   (a signed PUT for that part)
  //   mp-complete { uploadId }           -> { ok }    (parts read back from R2, so
  //                                                    the browser needn't see ETags)
  //   mp-abort    { uploadId }           -> { ok }
  const uploadId = typeof (body as { uploadId?: unknown }).uploadId === "string" ? (body as { uploadId: string }).uploadId : "";
  const idQuery = `uploadId=${encodeURIComponent(uploadId)}`;

  if (body.action === "mp-start") {
    const contentType = typeof body.contentType === "string" && body.contentType.length < 100
      ? body.contentType
      : "application/octet-stream";
    const res = await r2.fetch(`${objectUrl}?uploads`, { method: "POST", headers: { "Content-Type": contentType } });
    const xml = await res.text();
    const id = xml.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
    if (!res.ok || !id) return reply({ error: `R2 said ${res.status}` }, 502, origin);
    return reply({ uploadId: id }, 200, origin);
  }

  if (!uploadId && body.action?.startsWith("mp-")) return reply({ error: "uploadId is required" }, 400, origin);

  if (body.action === "mp-part") {
    const part = Number((body as { part?: unknown }).part);
    if (!Number.isInteger(part) || part < 1 || part > 10000) return reply({ error: "part must be 1 to 10000" }, 400, origin);
    const signed = await r2.sign(
      new Request(`${objectUrl}?partNumber=${part}&${idQuery}&X-Amz-Expires=${EXPIRES}`, { method: "PUT" }),
      { aws: { signQuery: true } },
    );
    return reply({ url: signed.url, expiresIn: EXPIRES }, 200, origin);
  }

  if (body.action === "mp-complete") {
    const list = await r2.fetch(`${objectUrl}?${idQuery}&max-parts=1000`, { method: "GET" });
    const xml = await list.text();
    if (!list.ok) return reply({ error: `R2 said ${list.status}` }, 502, origin);
    // each <Part> on its own, whatever order its fields come in
    const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? "";
    const parts = [...xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)]
      .map((m) => ({ n: Number(tag(m[1], "PartNumber")), etag: tag(m[1], "ETag").replace(/&quot;/g, '"') }))
      .filter((p) => p.n > 0 && p.etag)
      .sort((a, b) => a.n - b.n);
    if (!parts.length) return reply({ error: "no parts uploaded" }, 400, origin);
    const done = `<CompleteMultipartUpload>${parts.map((p) => `<Part><PartNumber>${p.n}</PartNumber><ETag>${p.etag.replace(/"/g, "&quot;")}</ETag></Part>`).join("")}</CompleteMultipartUpload>`;
    const res = await r2.fetch(`${objectUrl}?${idQuery}`, { method: "POST", body: done, headers: { "Content-Type": "application/xml" } });
    const answer = await res.text();
    if (!res.ok || answer.includes("<Error>")) {
      const why = [tag(answer, "Code"), tag(answer, "Message")].filter(Boolean).join(": ");
      return reply({ error: `R2 couldn't join the parts (${res.status}${why ? `, ${why}` : ""})` }, 502, origin);
    }
    return reply({ ok: true, parts: parts.length }, 200, origin);
  }

  if (body.action === "mp-abort") {
    await r2.fetch(`${objectUrl}?${idQuery}`, { method: "DELETE" });
    return reply({ ok: true }, 200, origin);
  }

  return reply({ error: "action must be download, upload, delete or mp-start, mp-part, mp-complete, mp-abort" }, 400, origin);
});
