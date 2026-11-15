// Edit an image, step two (admin trial): Claude edits an SVG as asked: swap
// or recolor a part, remove something, extend the canvas. Before and after
// side by side, what it cost, and "Keep editing" to change the result again.
import { useEffect, useRef, useState } from "react";
import "./ImageTool.css";
import { drawSvg, editSvg, problemsOf, safeSvg } from "../../lib/aiSvg";

const IDEAS = ["Make the main shape red", "Replace the star with a heart", "Remove the background", "Extend to 16:9 with matching shapes"];

const urlOf = (svg) => URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));

function SvgAiEdit() {
  const [name, setName] = useState("");
  const [source, setSource] = useState(null); // the SVG being edited
  const [result, setResult] = useState(null); // { svg, summary, usage }
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const [beforeUrl, setBeforeUrl] = useState(null);
  const [afterUrl, setAfterUrl] = useState(null);
  const input = useRef(null);

  useEffect(() => () => beforeUrl && URL.revokeObjectURL(beforeUrl), [beforeUrl]);
  useEffect(() => () => afterUrl && URL.revokeObjectURL(afterUrl), [afterUrl]);

  // a clock while Claude works
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  const load = (svg, fileName) => {
    const safe = safeSvg(svg);
    if (!safe) {
      setError("This file isn't a readable SVG.");
      return;
    }
    setError(null);
    setName(fileName);
    setSource(safe);
    setBeforeUrl(urlOf(safe));
    setResult(null);
    setAfterUrl(null);
  };

  const pick = async (list) => {
    const f = [...list].find((x) => x.type === "image/svg+xml" || /\.svg$/i.test(x.name));
    if (!f) {
      setError("Choose an SVG file.");
      return;
    }
    load(await f.text(), f.name.replace(/\.svg$/i, ""));
  };

  const run = async (e) => {
    e.preventDefault();
    if (!source || !instruction.trim() || busy) return;
    setBusy(true);
    setSeconds(0);
    setError(null);
    try {
      const asked = instruction.trim();
      // Claude sees the artwork, not only its code
      const look = await drawSvg(source);
      const made = await editSvg(source, asked, { image: look.png });
      let svg = safeSvg(made.svg);
      if (!svg) throw new Error("The AI didn't send back a valid SVG. Try again.");
      let usage = made.usage;
      let summary = made.summary;
      // the result is checked: an empty band the original didn't have gets
      // one fix, sent back with the problems and a picture of the result
      let checked = await drawSvg(svg);
      const found = problemsOf(look, checked);
      let fixed = false;
      if (found.length) {
        const second = await editSvg(svg, `Fix these problems in this result: ${found.join("; ")}. The original request was: "${asked}". Keep everything else.`, { image: checked.png, fix: true });
        const svg2 = safeSvg(second.svg);
        if (svg2) {
          const checked2 = await drawSvg(svg2);
          if (problemsOf(look, checked2).length < found.length) {
            svg = svg2;
            summary = second.summary;
            fixed = true;
            checked = checked2;
          }
        }
        usage = {
          ...usage,
          model: `${usage.model} > ${second.usage.model}`,
          input: usage.input + second.usage.input,
          output: usage.output + second.usage.output,
          costUsd: Math.round((usage.costUsd + second.usage.costUsd) * 1e4) / 1e4,
          seconds: Math.round((usage.seconds + second.usage.seconds) * 10) / 10,
        };
      }
      setResult({ svg, summary, usage, found, fixed, left: problemsOf(look, checked) });
      setAfterUrl(urlOf(svg));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // the result becomes the picture to edit next
  const keepEditing = () => {
    if (!result) return;
    setSource(result.svg);
    setBeforeUrl(urlOf(result.svg));
    setResult(null);
    setAfterUrl(null);
    setInstruction("");
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = afterUrl;
    a.download = `${name || "artwork"}-edited.svg`;
    a.click();
  };

  const clear = () => {
    setSource(null);
    setResult(null);
    setBeforeUrl(null);
    setAfterUrl(null);
    setInstruction("");
    setError(null);
  };

  return (
    <div className="it">
      {!source ? (
        <div className="it-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}>
          <strong>Drop an SVG here</strong>
          <span>An icon or element from the library, or your own SVG. Claude edits its code.</span>
          <button onClick={() => input.current?.click()}>Choose an SVG</button>
        </div>
      ) : (
        <>
          <div className="it-compare">
            <figure>
              <figcaption>Before</figcaption>
              <div className="it-frame is-checker"><img src={beforeUrl} alt="Before" /></div>
            </figure>
            <figure>
              <figcaption>After</figcaption>
              <div className="it-frame is-checker">
                {afterUrl ? <img src={afterUrl} alt="After" /> : <span className="it-wait">{busy ? `Claude is editing… ${seconds}s` : "Say what to change"}</span>}
              </div>
            </figure>
          </div>

          <form className="sa-ask" onSubmit={run}>
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Replace the star with a heart, or extend to 16:9"
              maxLength={600}
              disabled={busy}
              aria-label="What to change"
            />
            <button className="it-primary" disabled={busy || !instruction.trim()}>{busy ? "Editing…" : "Edit with AI"}</button>
          </form>
          <div className="sa-ideas">
            {IDEAS.map((idea) => (
              <button key={idea} type="button" className="rc-link" onClick={() => setInstruction(idea)} disabled={busy}>{idea}</button>
            ))}
          </div>

          {result && (
            <p className="sa-done">
              {result.summary}
              {result.found.length > 0 && (
                <em>{result.fixed ? "Checked: an empty area was found and fixed." : `Checked: ${result.left.join("; ")}.`}</em>
              )}
              <span>
                {result.usage.model} · {result.usage.input.toLocaleString()} in / {result.usage.output.toLocaleString()} out
                · ${result.usage.costUsd} · {result.usage.seconds}s
              </span>
            </p>
          )}

          <div className="it-actions">
            <button onClick={clear} disabled={busy}>Remove</button>
            <button onClick={() => input.current?.click()} disabled={busy}>Choose another</button>
            {result && <button onClick={keepEditing} disabled={busy}>Keep editing</button>}
            <button className="it-primary" onClick={download} disabled={!afterUrl || busy}>Download SVG</button>
          </div>
        </>
      )}

      <input ref={input} type="file" accept="image/svg+xml,.svg" hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
      {error && <p className="it-error">{error}</p>}
      <p className="it-note">Admin trial: each edit uses Claude and is logged with its tokens and cost.</p>
    </div>
  );
}

export default SvgAiEdit;
