// Edit an uploaded asset's details on /admin, without uploading it again.
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { industries, logoStyles } from "../../data/logosData";
import { CATEGORIES } from "./adminCategories";
import {
  MAX_KEYWORDS,
  backgroundCategoryLabel,
  categoriesOf,
  elementCategoryLabel,
  normalizeElementCategory,
} from "./elementPublish";
import { makeImages, parseKeywords } from "./vectorUpload";
import { uploadToR2 } from "../../lib/r2";
import { normalizeVectorCategory, vectorCategoryLabel } from "../../data/vectorCategories";
import { stockCategoryLabel } from "../../data/stockCategories";
import NumberInput from "../../components/NumberInput";
import KeywordChips from "./KeywordChips";
import { GENERIC_ICON_WORDS } from "./iconPublish";

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// these types get a watermark baked into their preview when they aren't free
const hasWatermark = (type, license) => ["vector", "logo", "footage", "photo", "mockup"].includes(type) && license !== "free";

// types whose preview is drawn from one JPG or PNG, so the admin can rebuild
// it here from that file when the license changes
const REBUILDS = ["photo", "vector"];

// a new preview, with or without the watermark, drawn from the original the
// admin picks. It goes to a new key next to the old one, so the CDN and
// browsers don't keep showing the cached old picture; the old file stays,
// since a published template may still show it until it's updated.
async function rebuildPreview(row, file, watermark) {
  const png = /\.png$/i.test(file.name);
  const images = await makeImages(file, watermark, png);
  const original = row.files?.[0];
  // a photo's original has its size on record: a different picture is refused
  if (original?.width && (images.width !== original.width || images.height !== original.height)) {
    throw new Error(`This file is ${images.width}×${images.height}, the original is ${original.width}×${original.height}. Pick the same file that was uploaded.`);
  }
  const folder = row.preview_key.replace(/\/[^/]+$/, "");
  const ext = { "image/webp": "webp", "image/png": "png" }[images.preview.type] ?? "jpg";
  const key = `${folder}/preview-${Date.now().toString(36)}.${ext}`;
  await uploadToR2({ bucket: "public", key, file: images.preview, contentType: images.preview.type });
  return key;
}

// row: the asset. onSaved(changes) after saving, onCancel() to close.
function EditAsset({ row, type, onSaved, onCancel }) {
  const [form, setForm] = useState({
    title: row.title ?? "",
    description: row.description ?? "",
    keywords: (row.keywords ?? []).join(", "),
    category: type === "vector"
      ? normalizeVectorCategory(row.category)
      : type === "element" && row.style !== "background"
        ? normalizeElementCategory(row.category)
        : row.category ?? "other",
    industry: row.industry ?? industries[0][0],
    style: row.style ?? logoStyles[0][0],
    // a photo for editorial use shows as its own license choice
    license: type === "photo" && row.editorial ? "editorial" : row.license,
    price: row.price_cents ? row.price_cents / 100 : 199,
    aiGenerated: Boolean(row.ai_generated),
    useInCreate: Boolean(row.use_in_create),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // the original JPG or PNG, picked to rebuild the preview for a new license
  const [original, setOriginal] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const isLogo = type === "logo";
  const sold = Boolean(row.sold_at);
  const categories = type === "element" ? categoriesOf(row.style) : CATEGORIES[type] ?? [];
  // a value set before the list changed stays selectable
  const categoryOptions = categories.includes(form.category) ? categories : [form.category, ...categories];
  const watermarkNext = hasWatermark(type, form.license === "editorial" ? "premium" : form.license);
  const watermarkDiffers = hasWatermark(type, row.license) !== watermarkNext;
  const canRebuild = watermarkDiffers && REBUILDS.includes(type) && Boolean(row.preview_key);

  const save = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setError("A title is required.");
      return;
    }
    const price = Number(form.price);
    if (form.license === "exclusive" && !(price >= 1)) {
      setError("An exclusive logo needs a price of at least $1.");
      return;
    }

    const changes = {
      title,
      description: form.description.trim() || null,
      keywords: type === "element" ? parseKeywords(form.keywords).slice(0, MAX_KEYWORDS) : parseKeywords(form.keywords),
      license: form.license === "editorial" ? "premium" : form.license,
      price_cents: form.license === "exclusive" ? Math.round(price * 100) : null,
      ...(isLogo ? { industry: form.industry, style: form.style } : { category: form.category }),
      ...(["photo", "mockup", "vector", "footage"].includes(type) ? { ai_generated: form.aiGenerated } : {}),
      // only a background vector can be offered in Create
      ...(type === "vector" ? { use_in_create: form.category === "background-texture" && form.useInCreate } : {}),
      ...(type === "photo" ? { editorial: form.license === "editorial" } : {}),
    };

    if (canRebuild && !original) {
      setError("Pick the original file first, so the preview matches the new license.");
      return;
    }

    setSaving(true);
    setError(null);
    if (canRebuild) {
      try {
        changes.preview_key = await rebuildPreview(row, original, watermarkNext);
      } catch (err) {
        setSaving(false);
        setError(err.message);
        return;
      }
    }
    const { error: e2 } = await supabase.from("assets").update(changes).eq("id", row.id);
    setSaving(false);
    if (e2) setError(e2.message);
    else onSaved(changes);
  };

  return (
    <form className="ad-edit" onSubmit={save}>
      <label className="is-wide">
        Title
        <input value={form.title} onChange={set("title")} required />
      </label>

      {/* an icon is described by its set */}
      {type !== "icon" && (
        <label className="is-wide">
          Description
          <textarea rows="2" value={form.description} onChange={set("description")} />
        </label>
      )}

      <div className="is-wide">
        <KeywordChips
          value={parseKeywords(form.keywords)}
          onChange={(list) => setForm((f) => ({ ...f, keywords: list.join(", ") }))}
          max={type === "element" ? MAX_KEYWORDS : type === "icon" ? 30 : 50}
          // an icon needs a few exact words, not a stock photo's list
          min={type === "icon" ? 3 : type === "element" ? 5 : 10}
          banned={type === "icon" ? GENERIC_ICON_WORDS : null}
        />
      </div>

      {isLogo ? (
        <>
          <label>
            Industry
            <select value={form.industry} onChange={set("industry")}>
              {industries.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label>
            Style
            <select value={form.style} onChange={set("style")}>
              {logoStyles.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        </>
      ) : (
        <label>
          Category
          <select value={form.category} onChange={set("category")}>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {type === "vector"
                  ? vectorCategoryLabel(c)
                  : type === "photo" || type === "mockup"
                    ? stockCategoryLabel(c)
                  : type === "element"
                    ? row.style === "background" ? backgroundCategoryLabel(c) : elementCategoryLabel(c)
                    : capitalize(c)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        License
        <select value={form.license} onChange={set("license")} disabled={sold || type === "font"}>
          {/* a font is sold per item at its tier prices, never Free or Premium */}
          {type === "font" && <option value="paid">Paid per item</option>}
          <option value="free">Free</option>
          <option value="premium">Premium</option>
          {type === "photo" && <option value="editorial">Editorial</option>}
          {isLogo && <option value="exclusive">Exclusive</option>}
        </select>
      </label>

      {form.license === "exclusive" && (
        <label>
          Price (USD)
          <NumberInput min="1" step="1" value={form.price} onChange={set("price")} disabled={sold} />
        </label>
      )}

      {sold && <p className="ad-edit-note">This logo is sold, so its license and price can't change.</p>}
      {canRebuild ? (
        <div className="ad-edit-note ad-rebuild">
          <span>
            {watermarkNext ? "Premium previews carry a watermark." : "Free previews have no watermark."}{" "}
            Pick the original {type === "vector" ? "JPG" : "JPG or PNG"} ({row.source_name ?? "the uploaded file"}) and Save rebuilds the preview.
          </span>
          <label className="ad-rebuild-pick">
            {original ? original.name : "Choose original"}
            <input type="file" accept={type === "vector" ? ".jpg,.jpeg" : ".jpg,.jpeg,.png"} hidden
                   onChange={(e) => setOriginal(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      ) : watermarkDiffers && (
        <p className="ad-edit-note">
          The preview image won't change with the license: its watermark was added at upload. To change it, delete this asset and upload it again.
        </p>
      )}
      {error && <p className="ad-error is-wide">{error}</p>}

      {type === "vector" && form.category === "background-texture" && (
        <label className="ad-ai-switch is-create">
          <input type="checkbox" checked={form.useInCreate} onChange={(e) => setForm((f) => ({ ...f, useInCreate: e.target.checked }))} />
          <span><strong>Use in Create</strong> · a background in Create's Background tab (only when it has no text and is one background)</span>
        </label>
      )}

      {["photo", "mockup", "vector", "footage"].includes(type) && (

        <label className="ad-ai-switch">

          <input type="checkbox" checked={form.aiGenerated} onChange={(e) => setForm((f) => ({ ...f, aiGenerated: e.target.checked }))} />

          <span><strong>AI-generated</strong> · shows the AI label on the site</span>

        </label>
      )}


      <div className="ad-edit-actions">
        <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="ad-primary" disabled={saving}>{saving ? (canRebuild ? "Rebuilding preview…" : "Saving…") : "Save"}</button>
      </div>
    </form>
  );
}

export default EditAsset;
