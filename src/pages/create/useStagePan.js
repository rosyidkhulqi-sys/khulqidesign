// Hold Space and drag to move around the page, as Illustrator's Hand tool
// and Figma do (or turn the Hand on from the tool strip): the cursor turns
// into a hand, the drag scrolls the stage and nothing on the page is picked,
// moved or marquee-selected. Typing keeps its spaces, and a focused button
// still takes Space unless the pointer is over the stage. Esc turns a locked
// Hand off.
//
// stageRef: the scrolling stage; fc: the Fabric canvas ref; handLockRef and
// setHandLock: the Hand button's switch; setHandMode(null | "ready" |
// "dragging") drives the hand and grab cursors.
import { useEffect } from "react";

export default function useStagePan({ stageRef, fc, handLockRef, setHandLock, setHandMode }) {
  useEffect(() => {
    const el = stageRef.current;
    let held = false;
    let over = false;
    let drag = null;
    const typing = (t) =>
      t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.tagName === "SELECT" || t?.isContentEditable
      || fc.current?.getActiveObject()?.isEditing;
    const control = (t) => Boolean(t?.closest?.("button, a, [role='button'], [role='radio'], [role='tab']"));
    const on = () => held || handLockRef.current;
    const keyDown = (e) => {
      if (e.key === "Escape" && handLockRef.current && !typing(e.target)) {
        handLockRef.current = false;
        setHandLock(false);
        if (!held && !drag) setHandMode(null);
        return;
      }
      if (e.code !== "Space" || typing(e.target) || (control(e.target) && !over)) return;
      e.preventDefault();
      if (!held) {
        held = true;
        setHandMode("ready");
      }
    };
    const keyUp = (e) => {
      if (e.code !== "Space" || !held) return;
      held = false;
      if (!drag && !handLockRef.current) setHandMode(null);
    };
    // Fabric listens to mouse events: with Space held they stop at the stage
    const block = (e) => {
      if (!on()) return;
      e.stopPropagation();
      e.preventDefault();
    };
    const start = (e) => {
      if (!on() || e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      drag = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
      setHandMode("dragging");
    };
    const move = (e) => {
      if (!drag) return;
      el.scrollLeft = drag.left - (e.clientX - drag.x);
      el.scrollTop = drag.top - (e.clientY - drag.y);
    };
    const end = () => {
      if (!drag) return;
      drag = null;
      setHandMode(on() ? "ready" : null);
    };
    // leaving the window mid-press would leave the hand on
    const reset = () => {
      held = false;
      drag = null;
      setHandMode(handLockRef.current ? "ready" : null);
    };
    const enter = () => { over = true; };
    const leave = () => { over = false; };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", reset);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", start, true);
    el.addEventListener("mousedown", block, true);
    el.addEventListener("dblclick", block, true);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", reset);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", start, true);
      el.removeEventListener("mousedown", block, true);
      el.removeEventListener("dblclick", block, true);
    };
  }, [stageRef, fc, handLockRef, setHandLock, setHandMode]);
}
