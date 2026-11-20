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

export async function uploadToR2({ bucket, key, file, contentType, onProgress }) {
  const type = contentType || file.type || "application/octet-stream";
  for (let attempt = 0; ; attempt++) {
    try {
      const signed = await sign({ action: "upload", bucket, key, contentType: type });
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signed.url);
        xhr.setRequestHeader("Content-Type", type);
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error("Network error while uploading to R2"));
        xhr.ontimeout = () => reject(new Error("The upload timed out"));
        xhr.send(file);
      });
      onProgress?.(1);
      return { key, bytes: file.size };
    } catch (error) {
      if (attempt >= WAITS.length) throw new Error(`${error.message} (tried ${attempt + 1} times; check the connection and try again)`, { cause: error });
      onProgress?.(0);
      await new Promise((r) => setTimeout(r, WAITS[attempt]));
    }
  }
}

export const deleteFromR2 = (bucket, key) => sign({ action: "delete", bucket, key });
