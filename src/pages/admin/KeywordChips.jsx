// Keywords as chips, as stock sites edit them: each keyword its own chip
// with ×, dragged to reorder (the first ones count most in search), typed or
// pasted in (commas split a pasted list), with a count and Copy / Clear.
import { useRef, useState } from "react";
import { parseKeywords } from "./vectorUpload";

// value: keywords as an array; onChange(list); max: the cap, if any
function KeywordChips({ value, onChange, max = 50, min = 10 }) {
  const [draft, setDraft] = useState("");
  const [dragging, setDragging] = useState(null);
  const [copied, setCopied] = useState(false);
  const input = useRef(null);

  const add = (text) => {
    const next = [...new Set([...value, ...parseKeywords(text)])].slice(0, max);
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
  return (
    <div className="kw">
      <div className="kw-head">
        <span>Keywords</span>
        <span className={few ? "is-few" : ""}>{value.length} ({min}–{max})</span>
      </div>
      <div className="kw-box" onClick={() => input.current?.focus()}>
        {value.map((k, i) => (
          <span
            key={k}
            className={`kw-chip ${dragging === i ? "is-dragging" : ""}`}
            draggable
            title="Drag to reorder"
            onDragStart={(e) => { setDragging(i); e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { e.preventDefault(); if (dragging !== null && dragging !== i) { move(dragging, i); setDragging(i); } }}
            onDragEnd={() => setDragging(null)}
          >
            {k}
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(i); }} aria-label={`Remove ${k}`}>×</button>
          </span>
        ))}
        <input
          ref={input}
          value={draft}
          onChange={(e) => {
            // a pasted list (with commas) becomes chips at once
            if (/[,;\n]/.test(e.target.value)) add(e.target.value);
            else setDraft(e.target.value);
          }}
          onKeyDown={onKey}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={value.length >= max ? "Limit reached" : "Add keyword, press Enter"}
          disabled={value.length >= max}
          aria-label="Add keyword"
        />
      </div>
      <div className="kw-tools">
        <button type="button" onClick={copy} disabled={!value.length}>{copied ? "Copied" : "Copy"}</button>
        <button type="button" onClick={() => onChange([])} disabled={!value.length}>Clear</button>
      </div>
    </div>
  );
}

export default KeywordChips;
