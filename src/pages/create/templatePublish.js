// Publishing a Create design as a template (admins only). A template is the
// design itself, every page in Create's own JSON, so buyers open exactly what
// was published and can change any text, color or picture.
//
// Pictures uploaded into Create live inside the design as data: URLs; they
// are moved to R2 so the template file stays small. The design JSON and the
// preview pictures go to public-files: Create has to read them to open the
// template. (Premium templates get locked to signed links with downloads.)
import { StaticCanvas } from "fabric";
import { supabase } from "../../lib/supabaseClient";
import { publicUrl, uploadToR2 } from "../../lib/r2";

export { TEMPLATE_CATEGORIES } from "../../data/templateCategories";

const newCode = () => `KD-TP-${String(Math.floor(1_000_000 + Math.random() * 9_000_000))}`;

export const splitTags = (text) =>
  [...new Set(text.split(/[,;\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean))];

// a picture of one page, longSide px on its longer edge
export async function renderPage(json, w, h, longSide, type = "jpeg") {
  const el = document.createElement("canvas");
  const canvas = new StaticCanvas(el, { width: w, height: h, enableRetinaScaling: false });
  try {
    await canvas.loadFromJSON(json);
    canvas.renderAll();
    const multiplier = Math.min(1, longSide / Math.max(w, h));
    const url = canvas.toDataURL({ format: type, quality: 0.86, multiplier });
    return await (await fetch(url)).blob();
  } finally {
    canvas.dispose();
  }
}

// every object in a page, including those inside groups
function* walk(objects) {
  for (const obj of objects ?? []) {
    yield obj;
    if (obj.objects) yield* walk(obj.objects);
  }
}

const isImage = (obj) => /^image$/i.test(obj.type ?? "");
const inline = (src) => typeof src === "string" && /^(data|blob):/.test(src);

const extFor = (type) => ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "image/gif": "gif" }[type] ?? "png");

// Publish. design: { w, h, pages: [fabric JSON...] }; info: title, category,
// tags (text), license. onStep(label, 0..1) drives the dialog.
export async function publishTemplate(design, info, onStep) {
  const pages = structuredClone(design.pages);
  const { w, h } = design;

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode();
    const folder = `templates/${code}`;

    // 1. move inline pictures to R2 and point the design at them
    onStep("Moving pictures", 0);
    const pictures = new Map();
    for (const page of pages) for (const obj of walk(page.objects)) if (isImage(obj) && inline(obj.src)) pictures.set(obj.src, null);
    let n = 0;
    for (const src of pictures.keys()) {
      const blob = await (await fetch(src)).blob();
      const key = `${folder}/img-${++n}.${extFor(blob.type)}`;
      await uploadToR2({ bucket: "public", key, file: blob, contentType: blob.type || "image/png" });
      pictures.set(src, publicUrl(key));
      onStep("Moving pictures", n / pictures.size);
    }
    for (const page of pages) {
      for (const obj of walk(page.objects)) {
        if (isImage(obj) && pictures.has(obj.src)) {
          obj.src = pictures.get(obj.src);
          // lets Create draw it and export the page again
          obj.crossOrigin = "anonymous";
        }
      }
    }

    // 2. preview pictures of page 1
    onStep("Making previews", 0);
    const thumb = await renderPage(pages[0], w, h, 600);
    const preview = await renderPage(pages[0], w, h, 1400);

    // 3. the design and its pictures
    const json = new Blob([JSON.stringify({ w, h, pages })], { type: "application/json" });
    const files = [
      { bucket: "public", key: `${folder}/design.json`, file: json, contentType: "application/json" },
      { bucket: "public", key: `${folder}/thumb.jpg`, file: thumb, contentType: "image/jpeg" },
      { bucket: "public", key: `${folder}/preview.jpg`, file: preview, contentType: "image/jpeg" },
    ];
    for (const [i, f] of files.entries()) {
      await uploadToR2({ ...f, onProgress: (p) => onStep("Uploading", (i + p) / files.length) });
    }

    onStep("Saving", 1);
    const { error } = await supabase.from("assets").insert({
      code,
      type: "template",
      status: "published",
      title: info.title.trim(),
      keywords: [...new Set([...splitTags(info.tags), info.category, "template", "editable"])],
      category: info.category,
      license: info.license,
      thumb_key: files[1].key,
      preview_key: files[2].key,
      files: [{ format: "JSON", key: files[0].key, bytes: json.size, pages: pages.length, label: "Editable in Create" }],
      width: w,
      height: h,
      orientation: w === h ? "square" : w > h ? "landscape" : "portrait",
    });
    if (!error) return code;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Couldn't find a free template code, try again");
}

// published templates in the shape the Templates page and Create use
export async function fetchTemplates() {
  const { data, error } = await supabase
    .from("assets")
    .select("id, code, title, keywords, category, license, thumb_key, preview_key, files, width, height, downloads, published_at, created_at")
    .eq("type", "template")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const w = row.width || 1080;
    const h = row.height || 1080;
    return {
      id: Date.parse(row.published_at || row.created_at),
      dbId: row.id,
      code: row.code,
      title: row.title.toLowerCase(),
      category: row.category || "other",
      w,
      h,
      orientation: w === h ? "square" : w > h ? "landscape" : "portrait",
      license: row.license,
      downloads: row.downloads,
      keywords: row.keywords ?? [],
      image: publicUrl(row.thumb_key),
      previewImage: publicUrl(row.preview_key),
      designUrl: publicUrl(row.files?.[0]?.key),
      pages: row.files?.[0]?.pages ?? 1,
    };
  });
}

// ---------------------------------------------------------- editing a template

// Saves the edited design over a published template: the design, its size
// and new preview pictures. Files get new names each time (the CDN keeps old
// ones cached for hours), and the asset row points to them.
export async function updateTemplate(edit, design, onStep) {
  const pages = structuredClone(design.pages);
  const { w, h } = design;
  const folder = `templates/${edit.code}`;
  const v = Date.now().toString(36);

  onStep("Moving pictures", 0);
  const pictures = new Map();
  for (const page of pages) for (const obj of walk(page.objects)) if (isImage(obj) && inline(obj.src)) pictures.set(obj.src, null);
  let n = 0;
  for (const src of pictures.keys()) {
    const blob = await (await fetch(src)).blob();
    const key = `${folder}/img-${v}-${++n}.${extFor(blob.type)}`;
    await uploadToR2({ bucket: "public", key, file: blob, contentType: blob.type || "image/png" });
    pictures.set(src, publicUrl(key));
  }
  for (const page of pages) {
    for (const obj of walk(page.objects)) {
      if (isImage(obj) && pictures.has(obj.src)) {
        obj.src = pictures.get(obj.src);
        obj.crossOrigin = "anonymous";
      }
    }
  }

  onStep("Making previews", 0);
  const thumb = await renderPage(pages[0], w, h, 600);
  const preview = await renderPage(pages[0], w, h, 1400);
  const json = new Blob([JSON.stringify({ w, h, pages })], { type: "application/json" });
  const files = [
    { bucket: "public", key: `${folder}/design-${v}.json`, file: json, contentType: "application/json" },
    { bucket: "public", key: `${folder}/thumb-${v}.jpg`, file: thumb, contentType: "image/jpeg" },
    { bucket: "public", key: `${folder}/preview-${v}.jpg`, file: preview, contentType: "image/jpeg" },
  ];
  for (const [i, f] of files.entries()) {
    await uploadToR2({ ...f, onProgress: (p) => onStep("Uploading", (i + p) / files.length) });
  }

  onStep("Saving", 1);
  const { error } = await supabase
    .from("assets")
    .update({
      thumb_key: files[1].key,
      preview_key: files[2].key,
      files: [{ format: "JSON", key: files[0].key, bytes: json.size, pages: pages.length, label: "Editable in Create" }],
      width: w,
      height: h,
      orientation: w === h ? "square" : w > h ? "landscape" : "portrait",
    })
    .eq("id", edit.id);
  if (error) throw new Error(error.message);
}
