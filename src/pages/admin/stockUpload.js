// Photos and mockups on /admin. A photo is one JPG: the full-size original
// is what's sold. A mockup is a PSD with a JPG of the same name: the PSD is
// sold, the JPG shows it. Both get a sharp thumbnail and a preview
// (watermarked when Premium), and their title, description and keywords from
// the JPG's metadata, as vectors do.
import { supabase } from "../../lib/supabaseClient";
import { uploadToR2 } from "../../lib/r2";
import { makeImages } from "./vectorUpload";

const baseName = (name) => name.replace(/\.[^.]+$/, "");
const extOf = (name) => name.split(".").pop().toLowerCase();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "file";

export const STOCK = {
  photo: { prefix: "PH", folder: "photos", accept: ".jpg,.jpeg", noun: ["photo", "photos"] },
  mockup: { prefix: "MK", folder: "mockups", accept: ".psd,.jpg,.jpeg", noun: ["mockup", "mockups"] },
};

// the dropped files as items: each JPG a photo, or PSD + JPG pairs a mockup
export function groupFiles(kind, fileList) {
  const groups = new Map();
  for (const file of fileList) {
    const ext = extOf(file.name);
    if (!["jpg", "jpeg", "psd"].includes(ext) || (kind === "photo" && ext === "psd")) continue;
    const base = baseName(file.name);
    const g = groups.get(base) ?? { base };
    if (ext === "psd") g.psd = file;
    else g.jpg = file;
    groups.set(base, g);
  }
  return [...groups.values()].sort((a, b) => a.base.localeCompare(b.base, undefined, { numeric: true }));
}

// what an item still lacks before it can go up
export const missingFile = (kind, item) => (!item.jpg ? "JPG" : kind === "mockup" && !item.psd ? "PSD" : null);

async function gzipped(file) {
  if (typeof CompressionStream !== "function") return null;
  return new Response(file.stream().pipeThrough(new CompressionStream("gzip"))).blob();
}

export async function publishStock(kind, item, onStep) {
  const { prefix, folder: root } = STOCK[kind];
  const images = await makeImages(item.jpg, item.license === "premium");
  const w = images.width;
  const h = images.height;
  // a PSD is stored compressed (lossless; downloads unpack it), a JPG as it is
  const psdGz = kind === "mockup" ? await gzipped(item.psd) : null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = `KD-${prefix}-${String(Math.floor(1_000_000 + Math.random() * 9_000_000))}`;
    const name = slug(item.title);
    const folder = `${root}/${code}`;
    const original = kind === "photo"
      ? { bucket: "private", key: `${folder}/${name}.jpg`, file: item.jpg, contentType: "image/jpeg" }
      : psdGz
        ? { bucket: "private", key: `${folder}/${name}.psd.gz`, file: psdGz, contentType: "application/gzip" }
        : { bucket: "private", key: `${folder}/${name}.psd`, file: item.psd, contentType: "image/vnd.adobe.photoshop" };
    const steps = [
      original,
      { bucket: "public", key: `${folder}/thumb.${images.thumb.type === "image/webp" ? "webp" : "jpg"}`, file: images.thumb, contentType: images.thumb.type },
      { bucket: "public", key: `${folder}/preview.jpg`, file: images.preview, contentType: "image/jpeg" },
    ];
    const total = steps.reduce((sum, s) => sum + s.file.size, 0);
    const sent = steps.map(() => 0);
    await Promise.all(steps.map((step, i) => uploadToR2({
      ...step,
      onProgress: (p) => {
        sent[i] = p * step.file.size;
        onStep("Uploading", sent.reduce((a, b) => a + b, 0) / total);
      },
    })));

    onStep("Saving", 1);
    const file = kind === "photo"
      ? { format: "JPG", key: original.key, bytes: item.jpg.size, label: "Full-size JPG", width: w, height: h }
      : { format: "PSD", key: original.key, bytes: item.psd.size, label: "Layered PSD", width: w, height: h };
    const { error } = await supabase.from("assets").insert({
      code,
      batch_id: item.batchId ?? null,
      source_name: item.base,
      type: kind,
      status: "published",
      title: item.title,
      long_title: item.longTitle || null,
      description: item.description || null,
      keywords: item.keywords,
      category: item.category,
      license: item.license,
      thumb_key: steps[1].key,
      preview_key: steps[2].key,
      files: [file],
      width: w,
      height: h,
      orientation: w === h ? "square" : w > h ? "landscape" : "portrait",
    });
    if (!error) return code;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Couldn't find a free asset code, try again");
}
