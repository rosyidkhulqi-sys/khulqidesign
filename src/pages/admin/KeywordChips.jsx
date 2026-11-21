// Keywords as chips, as stock sites edit them: each keyword its own chip
// with ×, dragged to reorder (the first ones count most in search), typed or
// pasted in (commas split a pasted list), with a count and Copy / Clear.
// The typing box is spell-checked by the browser (English), and chips that
// look wrong are marked with the reason: digits or symbols, more than three
// words, or a word that says nothing (`banned`, such as "icon").
// compact: the small version for an icon card.
import { useRef, useState } from "react";
import { parseKeywords } from "./vectorUpload";

function keywordProblem(k, banned) {
  if (banned?.has(k)) return "Says nothing here; leave it out";
  if (/[^a-z\s'-]/i.test(k)) return "Digits or symbols; check the spelling";
  if (k.split(/\s+/).length > 3) return "More than three words; split it";
  return null;
}

// value: keywords as an array; onChange(list); max: the cap, if any
function KeywordChips({ value, onChange, max = 50, min = 10, compact = false, banned = null, disabled = false, label = "Keywords" }) {
  const [draft, setDraft] = useState("");
  const [dragging, setDragging] = useState(null);
  const [copied, setCopied] = useState(false);
  const input = useRef(null);

  // a keyword is at most three words; anything longer is a list copied from
  // another site with only spaces between, so each word becomes a chip
  const add = (text) => {
    const words = parseKeywords(text.replace(/\t/g, ",")).flatMap((k) => (k.split(/\s+/).length > 3 ? k.split(/\s+/) : [k]));
    const next = [...new Set([...value, ...words])].slice(0, max);
    onChange(next);
    setDraft("");
  };
  const remove = (i) => onChange(value.filter((_, j) => j !== i));
  const move = (from, to) => {
    if (from === to) return;
    const next = [...value];
    const [k] = next.splice(from, 1);
    next.splice(to, 0, k);
    onChange(next);
  };

  const onKey = (e) => {
    if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      remove(value.length - 1);
    }
  };

  const copy = async () => {
    await navigator.clipboard?.writeText(value.join(", ")).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const few = value.length < min;
  const warned = value.filter((k) => keywordProblem(k, banned)).length;
  return (
    <div className={`kw ${compact ? "is-compact" : ""}`}>
      <div className="kw-head">
        <span>{label}</span>
        <span className={few || warned ? "is-few" : ""}>
          {warned ? `${warned} to check · ` : ""}{value.length} ({min}–{max})
          {/* the small boxes copy too: keywords pasted on another site */}
          {compact && value.length > 0 && (
            <button type="button" className="kw-copy" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          )}
        </span>
      </div>
      <div className="kw-box" onClick={() => !disabled && input.current?.focus()}>
        {value.map((k, i) => {
          const problem = keywordProblem(k, banned);
          return (
            <span
              key={k}
              className={`kw-chip ${dragging === i ? "is-dragging" : ""} ${problem ? "is-warn" : ""}`}
              draggable={!disabled}
              title={problem ?? "Drag to reorder"}
              onDragStart={(e) => { setDragging(i); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { e.preventDefault(); if (dragging !== null && dragging !== i) { move(dragging, i); setDragging(i); } }}
              onDragEnd={() => setDragging(null)}
            >
              {k}
              {!disabled && <button type="button" onClick={(e) => { e.stopPropagation(); remove(i); }} aria-label={`Remove ${k}`}>×</button>}
            </span>
          );
        })}
        {!disabled && (
          <input
            ref={input}
            value={draft}
            spellCheck
            lang="en"
            onChange={(e) => {
              // a pasted list (with commas) becomes chips at once
              if (/[,;\n]/.test(e.target.value)) add(e.target.value);
              else setDraft(e.target.value);
            }}
            onKeyDown={onKey}
            onPaste={(e) => {
              // a pasted list becomes chips at once, no Enter needed
              const text = e.clipboardData.getData("text");
              if (/[,;\n\t]/.test(text) || text.trim().split(/\s+/).length > 3) {
                e.preventDefault();
                add(draft + " " + text);
              }
            }}
            onBlur={() => draft.trim() && add(draft)}
            placeholder={value.length >= max ? "Limit reached" : compact ? "Add, press Enter" : "Add keyword, press Enter"}
            disabled={value.length >= max}
            aria-label="Add keyword"
          />
        )}
      </div>
      {!compact && (
        <div className="kw-tools">
          <button type="button" onClick={copy} disabled={!value.length}>{copied ? "Copied" : "Copy"}</button>
          <button type="button" onClick={() => onChange([])} disabled={!value.length}>Clear</button>
        </div>
      )}
    </div>
  );
}

export default KeywordChips;
