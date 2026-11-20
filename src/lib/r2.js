// Files in Cloudflare R2. The browser never holds R2 keys: it asks the
// r2-sign Edge Function (admins only) for a short-lived signed URL, then
// sends the file straight to R2.
//
//   public-files   thumbnails and watermarked previews, shown on the site
//   private-files  originals, handed out later through signed download links
import { supabase } from "./supabaseClient";

// Public address of the public bucket: the custom domain, cached by
// Cloudflare. (The *.r2.dev address is blocked by Indonesian ISPs, so it is
// never used for the site.)
export const PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || "https://cdn.khulqidesign.com";

export const publicUrl = (key) =>
  key ? `${PUBLIC_URL}/${key.split("/").map(encodeURIComponent).join("/")}` : null;

async function sign(body) {
  const { data, error } = await supabase.functions.invoke("r2-sign", { body });
  if (error) {
    // the function answers with { error } on 4xx; surface that message
    let message = error.message;
    try {
      message = (await error.context.json()).error ?? message;
    } catch {
      /* not a JSON body */
    }
    throw new Error(message);
  }
  return data;
}

// Upload one file or blob to R2, reporting progress from 0 to 1.
// A dropped connection or a busy moment shouldn't lose a file: each upload
// is tried up to four times, waiting a little longer each time, with a fresh
// signed link (the old one may have expired).
const WAITS = [1000, 3000, 6000];

// files above this go up in parts (multipart): a dropped connection costs
// one 10 MB part, not the whole file
const MULTIPART_FROM = 20 * 1024 * 1024;
const PART_SIZE = 10 * 1024 * 1024;
const PARTS_AT_ONCE = 3;

// one PUT of a body to a signed URL; onLoaded(bytes so far)
function put(url, body, type, onLoaded) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (type) xhr.setRequestHeader("Content-Type", type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onLoaded?.(e.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error while uploading to R2"));
    xhr.ontimeout = () => reject(new Error("The upload timed out"));
    xhr.send(body);
  });
}

// runs work() up to four times, waiting longer between tries
async function withRetries(work, onRetry) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= WAITS.length) throw new Error(`${error.message} (tried ${attempt + 1} times; check the connection and try again)`, { cause: error });
      onRetry?.();
      await new Promise((r) => setTimeout(r, WAITS[attempt]));
    }
  }
}

async function uploadInParts({ bucket, key, file, type, onProgress }) {
  const { uploadId } = await withRetries(() => sign({ action: "mp-start", bucket, key, contentType: type }));
  const count = Math.ceil(file.size / PART_SIZE);
  const loaded = new Array(count).fill(0);
  const report = () => onProgress?.(loaded.reduce((a, b) => a + b, 0) / file.size);

  try {
    let next = 0;
    const worker = async () => {
      while (next < count) {
        const i = next++;
        const chunk = file.slice(i * PART_SIZE, Math.min(file.size, (i + 1) * PART_SIZE));
        await withRetries(
          async () => {
            const { url } = await sign({ action: "mp-part", bucket, key, uploadId, part: i + 1 });
            await put(url, chunk, null, (bytes) => { loaded[i] = bytes; report(); });
            loaded[i] = chunk.size;
            report();
          },
          () => { loaded[i] = 0; report(); },
        );
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARTS_AT_ONCE, count) }, worker));
    await withRetries(() => sign({ action: "mp-complete", bucket, key, uploadId }));
  } catch (error) {
    // leave nothing half-made behind in R2
    sign({ action: "mp-abort", bucket, key, uploadId }).catch(() => {});
    throw error;
  }
}

export async function uploadToR2({ bucket, key, file, contentType, onProgress }) {
  const type = contentType || file.type || "application/octet-stream";
  if (file.size > MULTIPART_FROM) {
    await uploadInParts({ bucket, key, file, type, onProgress });
  } else {
    await withRetries(
      async () => {
        const signed = await sign({ action: "upload", bucket, key, contentType: type });
        await put(signed.url, file, type, (bytes) => onProgress?.(bytes / file.size));
      },
      () => onProgress?.(0),
    );
  }
  onProgress?.(1);
  return { key, bytes: file.size };
}

export const deleteFromR2 = (bucket, key) => sign({ action: "delete", bucket, key });
