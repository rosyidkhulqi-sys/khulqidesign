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
import { parseKeywords } from "./vectorUpload";
import { normalizeVectorCategory, vectorCategoryLabel } from "../../data/vectorCategories";
import { stockCategoryLabel } from "../../data/stockCategories";
import NumberInput from "../../components/NumberInput";
import KeywordChips from "./KeywordChips";
import { GENERIC_ICON_WORDS } from "./iconPublish";

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// these types get a watermark baked into their preview when they aren't free
const hasWatermark = (type, license) => ["vector", "logo", "footage", "photo", "mockup"].includes(type) && license !== "free";

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
    license: row.license,
    price: row.price_cents ? row.price_cents / 100 : 199,
    aiGenerated: Boolean(row.ai_generated),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const isLogo = type === "logo";
  const sold = Boolean(row.sold_at);
  const categories = type === "element" ? categoriesOf(row.style) : CATEGORIES[type] ?? [];
  // a value set before the list changed stays selectable
  const categoryOptions = categories.includes(form.category) ? categories : [form.category, ...categories];
  const watermarkDiffers = hasWatermark(type, row.license) !== hasWatermark(type, form.license);

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
      license: form.license,
      price_cents: form.license === "exclusive" ? Math.round(price * 100) : null,
      ...(isLogo ? { industry: form.industry, style: form.style } : { category: form.category }),
      ...(type === "photo" || type === "mockup" ? { ai_generated: form.aiGenerated } : {}),
    };

    setSaving(true);
    setError(null);
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
        <select value={form.license} onChange={set("license")} disabled={sold}>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
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
      {watermarkDiffers && (
        <p className="ad-edit-note">
          The preview image won't change with the license: its watermark was added at upload. To change it, delete this asset and upload it again.
        </p>
      )}
      {error && <p className="ad-error is-wide">{error}</p>}

      {(type === "photo" || type === "mockup") && (

        <label className="ad-ai-switch">

          <input type="checkbox" checked={form.aiGenerated} onChange={(e) => setForm((f) => ({ ...f, aiGenerated: e.target.checked }))} />

          <span><strong>AI-generated</strong> · shows the AI label on the site</span>

        </label>

      )}

      <div className="ad-edit-actions">
        <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="ad-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

export default EditAsset;
