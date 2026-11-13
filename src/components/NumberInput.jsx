// A number field with the site's own up/down steppers in place of the
// browser's grey spin buttons (hidden site-wide in index.css), so every number
// input looks the same in every browser. It takes the props of a plain
// <input type="number">; className styles the input as before. The steppers
// show on hover and focus, repeat while held, and the arrow keys still work.
import { useRef } from "react";

const HOLD_DELAY = 400;
const REPEAT = 60;

function Chevron({ up }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
    </svg>
  );
}

function NumberInput({ wrapClassName = "", ...props }) {
  const input = useRef(null);
  const timer = useRef(null);

  // stepUp / stepDown respect min, max and step; the input event lets React's
  // onChange see the new value
  const step = (up) => {
    const el = input.current;
    if (!el || el.disabled || el.readOnly) return;
    if (up) el.stepUp();
    else el.stepDown();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const stop = () => {
    clearTimeout(timer.current);
    clearInterval(timer.current);
  };

  // one handler for both buttons; data-up says which way
  const press = (e) => {
    const up = e.currentTarget.dataset.up === "true";
    e.preventDefault();
    input.current?.focus();
    step(up);
    stop();
    timer.current = setTimeout(() => {
      timer.current = setInterval(() => step(up), REPEAT);
    }, HOLD_DELAY);
  };

  return (
    <span className={`num ${wrapClassName}`}>
      <input ref={input} type="number" {...props} />
      {!props.disabled && (
        <span className="num-steps" aria-hidden="true">
          <button type="button" tabIndex={-1} data-up="true" onPointerDown={press} onPointerUp={stop} onPointerLeave={stop}>
            <Chevron up />
          </button>
          <button type="button" tabIndex={-1} data-up="false" onPointerDown={press} onPointerUp={stop} onPointerLeave={stop}>
            <Chevron />
          </button>
        </span>
      )}
    </span>
  );
}

export default NumberInput;
