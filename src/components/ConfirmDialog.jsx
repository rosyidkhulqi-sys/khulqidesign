// The site's own "are you sure?" box, in place of the browser's plain one.
// Opened through askConfirm() (lib/confirm.js), which resolves true or false.
import { useEffect, useRef, useState } from "react";
import "./ConfirmDialog.css";

function ConfirmDialog({ title, message, confirmLabel = "Delete", cancelLabel = "Cancel", danger = true, typeToConfirm = null, onDone }) {
  const [typed, setTyped] = useState("");
  const cancel = useRef(null);
  const input = useRef(null);
  const ready = !typeToConfirm || typed.trim() === typeToConfirm;

  useEffect(() => {
    // start on the safe choice, or on the name field when one is asked for
    (input.current ?? cancel.current)?.focus();
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onDone(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onDone]);

  return (
    <div className="cd-overlay" onClick={() => onDone(false)}>
      <form
        className="cd-box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        aria-describedby="cd-message"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onDone(true);
        }}
      >
        <h2 id="cd-title">{title}</h2>
        {message && <p id="cd-message">{message}</p>}
        {typeToConfirm && (
          <label className="cd-type">
            <span>Type <b>{typeToConfirm}</b> to confirm</span>
            <input ref={input} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
          </label>
        )}
        <div className="cd-actions">
          <button type="button" ref={cancel} onClick={() => onDone(false)}>{cancelLabel}</button>
          <button type="submit" className={danger ? "is-danger" : "is-main"} disabled={!ready}>{confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}

export default ConfirmDialog;
