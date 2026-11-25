// The AI tab of Create. Image cleanup and upscaling run locally; Color ideas
// too (color theory, free for everyone). Generating an element and writing
// text use the AI service: an admin trial for now, each use logged with its
// cost to price KD AI credits.
import { useRef, useState } from "react";
import { Sparkle } from "../../components/AiSearchButton";
import { createElement, saveAiElement, writeText } from "../../lib/aiCreate";
import { colorIdeas } from "../../lib/colorIdeas";

const tools = [
  ["element", "Generate an element", "Describe an illustration or an element, and it's drawn as a vector and placed on the page."],
  ["text", "Write text", "Headlines and captions in the tone you choose."],
  ["colors", "Color ideas", "Palettes that suit the colors already in your design."],
];
const TONES = ["Friendly", "Bold", "Elegant", "Playful", "Professional"];

// cutoutQuota: today's Remove background use { used, limit }, limit null = no limit
function AiPanel({ aiReady, isAdmin, hasSelectedImage, operation, models, cutoutQuota, onRun, onUpload,
  onAddElement, onAddText, getColors, onPickColor, hasSelection, selectionSvg, selectionSaved, onSelectionSaved, selectionMeta }) {
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);
  const [open, setOpen] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState(TONES[0]);
  const [textKind, setTextKind] = useState("headline");
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [palettes, setPalettes] = useState([]);

  const openTool = (id) => {
    setOpen(open === id ? null : id);
    setResult(null);
    setError(null);
    if (id === "colors") setPalettes(colorIdeas(getColors()));
  };
  // only Color ideas is open to everyone; the others to admins for now
  const usable = (id) => id === "colors" || isAdmin;

  const run = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || working) return;
    setWorking(true);
    setError(null);
    setResult(null);
    try {
      if (open === "element") {
        const made = await createElement(prompt.trim());
        const meta = { title: made.title, keywords: made.keywords, category: made.category, prompt: prompt.trim() };
        onAddElement(made.svg, meta);
        setResult({ note: `Placed “${made.title}” on the page`, usage: made.usage, element: { svg: made.svg, ...meta } });
      } else {
        const made = await writeText(prompt.trim(), tone.toLowerCase(), textKind);
        setResult({ options: made.options, usage: made.usage });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  };
  const busy = Boolean(operation && !operation.error);
  const cutoutBadge = !cutoutQuota
    ? `Free · ${models.cutout.mb} MB model`
    : cutoutQuota.limit == null
      ? "Unlimited"
      : `${Math.max(0, cutoutQuota.limit - cutoutQuota.used)} of ${cutoutQuota.limit} left today`;
  return (
    <>
      <div className="cp-ai-intro">
        <Sparkle size={20} />
        <p>Remove backgrounds and upscale images. These AI tools run in this browser.</p>
      </div>

      <p className="cp-label">Image tools · On this device</p>
      <div className="cp-ai-local">
        {!hasSelectedImage ? (
          <>
            <p className="cp-hint">Select an image on the canvas, or upload one to try the AI tools.</p>
            <button className="cp-upload" onClick={() => fileInput.current?.click()}>
              ↑ Upload an image to start
            </button>
          </>
        ) : (
          <>
            <button className="cp-ai-tool" disabled={busy} onClick={() => onRun("cutout")}>
              <strong>Remove background <span className="ai-soon">{cutoutBadge}</span></strong>
              <span>Cut out the subject, then keep editing the design on the page.</span>
            </button>
            <div className="cp-ai-tool cp-ai-upscale">
              <strong>Upscale image <span className="ai-soon">Free · {models.upscale.mb} MB model</span></strong>
              <span>Make the selected image larger and sharper for export.</span>
              <div className="cp-ai-scales">
                {[2, 4].map((scale) => (
                  <button key={scale} disabled={busy} onClick={() => onRun("upscale", scale)}>
                    Upscale {scale}×
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onUpload(e.target.files);
            e.target.value = "";
          }}
        />
        {busy && (
          <div className="cp-ai-progress" role="status">
            <span>{operation.step}{operation.progress > 0 && operation.progress < 1 ? ` · ${Math.round(operation.progress * 100)}%` : "…"}</span>
            <div><i style={{ width: `${Math.round((operation.progress || 0) * 100)}%` }} /></div>
          </div>
        )}
        {operation?.error && (
          <p className="cp-ai-error" role="alert">
            {operation.error} {operation.limit && <a href="/pricing">See Premium</a>}
          </p>
        )}
      </div>

      {/* admins: keep the selected vector (an AI element) as a Create element */}
      {selectionSvg && (
        <div className="cp-ai-form">
          <button type="button" className="cp-ai-save" disabled={saving || Boolean(selectionSaved)}
                  onClick={async () => {
                    // an AI element carries the title, keywords and category the
                    // AI wrote; anything else asks for a name
                    const meta = selectionMeta ?? { title: window.prompt("Name for this element (a few words)", "")?.trim() };
                    if (!meta.title) return;
                    setSaving(true);
                    setError(null);
                    try {
                      onSelectionSaved(await saveAiElement({ svg: selectionSvg(), ...meta, title: meta.title.slice(0, 60) }));
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setSaving(false);
                    }
                  }}>
            {saving ? "Saving…" : selectionSaved ? `Saved to Elements · ${selectionSaved}` : "Save selection to Elements"}
          </button>
          {selectionMeta && !selectionSaved && (
            <p className="cp-hint">“{selectionMeta.title}” · {selectionMeta.category} · {selectionMeta.keywords?.length ?? 0} keywords</p>
          )}
        </div>
      )}

      <p className="cp-label">More AI tools</p>

      <div className="cp-ai-list">
        {tools.map(([id, name, text]) => (
          <div key={id} className={`cp-ai-block ${open === id ? "is-open" : ""}`}>
            <button className="cp-ai-tool" disabled={!usable(id)} onClick={() => openTool(id)} aria-expanded={open === id}>
              <strong>
                {name}
                <span className="ai-soon">
                  {id === "colors" ? "Free" : isAdmin ? "Admin trial" : aiReady ? "In development" : "Coming soon"}
                </span>
              </strong>
              <span>{text}</span>
            </button>

            {open === id && id !== "colors" && (
              <form className="cp-ai-form" onSubmit={run}>
                <textarea rows={3} value={prompt} maxLength={600} disabled={working}
                          placeholder={id === "element" ? "e.g. a coffee cup with steam, warm colors" : "e.g. a weekend sale at a small bakery"}
                          onChange={(e) => setPrompt(e.target.value)} />
                {id === "text" && (
                  <div className="cp-ai-row">
                    <select value={textKind} onChange={(e) => setTextKind(e.target.value)} aria-label="Kind of text">
                      <option value="headline">Headlines</option>
                      <option value="caption">Captions</option>
                    </select>
                    <select value={tone} onChange={(e) => setTone(e.target.value)} aria-label="Tone">
                      {TONES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                )}
                <button className="cp-ai-go" disabled={working || !prompt.trim()}>
                  {working ? (id === "element" ? "Drawing…" : "Writing…") : id === "element" ? "Generate" : "Write"}
                </button>
                {error && <p className="cp-ai-error" role="alert">{error}</p>}
                {result?.note && <p className="cp-hint">{result.note}</p>}
                {/* keep a good one: paid for once, then in Elements for everyone */}
                {result?.element && (
                  <button type="button" className="cp-ai-save" disabled={result.saving || Boolean(result.saved)}
                          onClick={async () => {
                            setResult((r) => ({ ...r, saving: true }));
                            try {
                              const code = await saveAiElement(result.element);
                              setResult((r) => ({ ...r, saving: false, saved: code }));
                            } catch (err) {
                              setResult((r) => ({ ...r, saving: false }));
                              setError(err.message);
                            }
                          }}>
                    {result.saved ? `Saved to Elements · ${result.saved}` : result.saving ? "Saving…" : "Save to Elements"}
                  </button>
                )}
                {result?.options && (
                  <div className="cp-ai-options">
                    {result.options.map((o) => (
                      <button key={o} type="button" onClick={() => onAddText(o, textKind)} title="Add to the page">{o}</button>
                    ))}
                  </div>
                )}
                {result?.usage && <p className="cp-ai-cost">${result.usage.costUsd} · {result.usage.seconds}s · {result.usage.model}</p>}
              </form>
            )}

            {open === id && id === "colors" && (
              <div className="cp-ai-form">
                {palettes.map(([name, colors]) => (
                  <div key={name} className="cp-ai-palette">
                    <span>{name}</span>
                    <div>
                      {colors.map((c) => (
                        <button key={c} style={{ background: c }} title={c} aria-label={`Use ${c}`}
                                onClick={() => onPickColor(c)} />
                      ))}
                    </div>
                  </div>
                ))}
                <p className="cp-hint">{hasSelection ? "Click a color to give it to the selected item." : "Select an item, then click a color to give it to it."}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="cp-hint">The first use downloads each local AI model once. It stays on this device for later use.</p>
    </>
  );
}

export default AiPanel;
