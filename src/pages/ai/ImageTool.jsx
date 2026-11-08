// One screen for the in-browser image tools (Remove background, Upscale):
// pick a picture, run the model on this device, compare, download a PNG.
import { useEffect, useRef, useState } from "react";
import "./ImageTool.css";

const ACCEPT = "image/png,image/jpeg,image/webp";

// options: optional [[value, label], ...], e.g. the upscale factor
function ImageTool({ run, suffix, options = null, modelMb, hint }) {
  const [option, setOption] = useState(options?.[0]?.[0] ?? null);
  const [file, setFile] = useState(null);
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);

  // release the preview URLs when they're replaced or the page closes
  useEffect(() => () => before && URL.revokeObjectURL(before), [before]);
  useEffect(() => () => after && URL.revokeObjectURL(after), [after]);

  const busy = step && step !== "Done";

  const pick = (list) => {
    const f = [...list].find((x) => /^image\/(png|jpeg|webp)$/.test(x.type));
    if (!f) {
      setError("Choose a PNG, JPG or WebP picture.");
      return;
    }
    setError(null);
    setFile(f);
    setBefore(URL.createObjectURL(f));
    setAfter(null);
    setResult(null);
    setStep(null);
  };

  const start = async () => {
    setError(null);
    setAfter(null);
    setResult(null);
    try {
      const blob = await run(file, (label, p) => {
        setStep(label);
        setProgress(p);
      }, option);
      setResult(blob);
      setAfter(URL.createObjectURL(blob));
    } catch (e) {
      setStep(null);
      setError(e.message || "Something went wrong. Try again.");
    }
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = after;
    a.download = `${file.name.replace(/\.[^.]+$/, "")}-${suffix}${option ? `-${option}x` : ""}.png`;
    a.click();
  };

  return (
    <div className="it">
      {!file ? (
        <div
          className={`it-drop ${dragging ? "is-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files); }}
        >
          <strong>Drop a picture here</strong>
          <span>PNG, JPG or WebP. It's processed on this device and never uploaded.</span>
          <button onClick={() => input.current?.click()}>Choose a picture</button>
        </div>
      ) : (
        <>
          <div className="it-compare">
            <figure>
              <figcaption>Before</figcaption>
              <div className="it-frame"><img src={before} alt="Before" /></div>
            </figure>
            <figure>
              <figcaption>After</figcaption>
              <div className="it-frame is-checker">
                {after ? <img src={after} alt="After" /> : <span className="it-wait">{busy ? step : "Ready when you are"}</span>}
              </div>
            </figure>
          </div>

          {busy && (
            <div className="it-progress" role="status">
              <span>{step}{progress > 0 && progress < 1 ? ` · ${Math.round(progress * 100)}%` : "…"}</span>
              <div><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            </div>
          )}

          <div className="it-actions">
            {options && (
              <div className="it-options" role="radiogroup" aria-label="Size">
                {options.map(([value, label]) => (
                  <button key={value} role="radio" aria-checked={option === value}
                          className={option === value ? "active" : ""} disabled={busy}
                          onClick={() => { setOption(value); setAfter(null); setResult(null); setStep(null); }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => input.current?.click()} disabled={busy}>Choose another</button>
            {result ? (
              <button className="it-primary" onClick={download}>Download PNG</button>
            ) : (
              <button className="it-primary" onClick={start} disabled={busy}>
                {busy ? "Working…" : "Start"}
              </button>
            )}
          </div>
        </>
      )}

      <input ref={input} type="file" accept={ACCEPT} hidden
             onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />

      {error && <p className="it-error">{error}</p>}

      <p className="it-note">
        Runs on your device, free. The first time, your browser downloads the {modelMb} MB AI model
        once and keeps it. {hint}
      </p>
    </div>
  );
}

export default ImageTool;
