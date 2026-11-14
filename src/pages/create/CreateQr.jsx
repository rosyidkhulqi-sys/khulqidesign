// QR code forms: making one (Elements → QR code) and changing what a selected
// one says (the right panel). Colors are changed like any element's.
import { useState } from "react";
import { QR_MAX } from "./qrCode";

// focus: put the cursor in the field (not when it shows up under a search)
export function QrPanel({ onAdd, focus = true }) {
  const [text, setText] = useState("");
  const ready = text.trim().length > 0;
  return (
    <form
      className="cq"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        onAdd(text);
        setText("");
      }}
    >
      <label className="cp-label" htmlFor="cq-text">Link or text</label>
      <input
        id="cq-text"
        className="cq-input"
        value={text}
        maxLength={QR_MAX}
        placeholder="yourbrand.com"
        onChange={(e) => setText(e.target.value)}
        autoFocus={focus}
      />
      <button className="cq-add" disabled={!ready}>Add QR code</button>
      <p className="cp-hint">
        Premium: try it free, download with Premium. Keep strong contrast so it scans.
      </p>
    </form>
  );
}

// value: what the selected code says now
export function QrEdit({ value, onSave }) {
  const [text, setText] = useState(value);
  const changed = text.trim() && text.trim() !== value;
  return (
    <>
      <p className="cp-label">QR code</p>
      <form
        className="cq-edit"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed) onSave(text);
        }}
      >
        <input
          className="cq-input"
          value={text}
          maxLength={QR_MAX}
          onChange={(e) => setText(e.target.value)}
          aria-label="QR code link or text"
        />
        <button className="pp-type-btn" disabled={!changed}>Update</button>
      </form>
    </>
  );
}
