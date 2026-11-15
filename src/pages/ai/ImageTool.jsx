// One screen for the in-browser image tools (Remove background, Upscale):
// pick a picture, run the model on this device, compare, download a PNG.
// Anyone can try it; downloading the result needs an account (a free one),
// as on remove.bg and Photoroom. The result is kept while they log in.
import { useEffect, useRef, useState } from "react";
import "./ImageTool.css";
import { askLogin } from "../../lib/authGate";
import { forgetResult, keepResult, restoreResult } from "../../lib/aiKeep";
import { checkCutout, countCutout, cutoutQuota, quotaLabel } from "../../lib/toolQuota";
import { composeBackground } from "../../lib/backgroundCompose";

// after Remove background: what goes behind the subject
const BACKGROUNDS = [
  ["transparent", "Transparent"],
  ["color", "Color"],
  ["blur", "Blur"],
];
const SWATCHES = ["#ffffff", "#f4f1ea", "#0a0b0d", "#e5233a", "#2d6cdf", "#17a398"];

const ACCEPT = "image/png,image/jpeg,image/webp";

// options: optional [[value, label], ...], e.g. the upscale factor
// tool: "cutout" | "upscale"; user: the signed-in account, or null
function ImageTool({ tool, run, suffix, options = null, modelMb, hint, user }) {
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
  // Remove background: today's free allowance { used, limit } (Premium: no limit)
  const counted = tool === "cutout";
  const [quota, setQuota] = useState(null);
  const [limitHit, setLimitHit] = useState(false);
  // Remove background: the new background (the cut itself is kept in result)
  const [bgMode, setBgMode] = useState("transparent");
  const [bgColor, setBgColor] = useState("#ffffff");
  useEffect(() => {
    if (!counted) return;
    let alive = true;
    cutoutQuota().then((q) => alive && setQuota(q)).catch(() => {});
    return () => { alive = false; };
  }, [counted, user]);

  // release the preview URLs when they're replaced or the page closes
  useEffect(() => () => before && URL.revokeObjectURL(before), [before]);
  useEffect(() => () => after && URL.revokeObjectURL(after), [after]);

  // back from logging in to download: show the kept result again
  useEffect(() => {
    restoreResult(tool).then((kept) => {
      if (!kept) return;
      setFile(kept.file);
      setBefore(URL.createObjectURL(kept.file));
      setResult(kept.blob);
      setAfter(URL.createObjectURL(kept.blob));
      if (kept.option != null) setOption(kept.option);
      setStep("Done");
    });
  }, [tool]);

  const busy = step && step !== "Done";

  // the subject on its new background, made again whenever it changes; the
  // cut is reused, so this costs no allowance
  useEffect(() => {
    if (!counted || !result || !file) return;
    let alive = true;
    composeBackground(result, file, { mode: bgMode, color: bgColor })
      .then((blob) => alive && setAfter(URL.createObjectURL(blob)))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [counted, result, file, bgMode, bgColor]);

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
    setLimitHit(false);
    setAfter(null);
    setResult(null);
    try {
      if (counted) await checkCutout();
      const blob = await run(file, (label, p) => {
        setStep(label);
        setProgress(p);
      }, option);
      if (counted) setQuota(await countCutout());
      setResult(blob);
      setAfter(URL.createObjectURL(blob));
    } catch (e) {
      setStep(null);
      setLimitHit(e.code === "daily_limit");
      if (counted) cutoutQuota().then(setQuota).catch(() => {});
      setError(e.message || "Something went wrong. Try again.");
    }
  };

  // throw the picture and its result away and start again from the drop box
  // (the day's allowance isn't given back: the cut was already made)
  const clear = () => {
    forgetResult();
    setFile(null);
    setBefore(null);
    setAfter(null);
    setResult(null);
    setStep(null);
    setError(null);
    setLimitHit(false);
    setBgMode("transparent");
  };

  const download = async () => {
    if (!user) {
      await keepResult(tool, file, result, option);
      askLogin("result");
      return;
    }
    forgetResult();
    const a = document.createElement("a");
    a.href = after;
    const look = counted && bgMode !== "transparent" ? `-${bgMode}-background` : "";
    a.download = `${file.name.replace(/\.[^.]+$/, "")}-${suffix}${look}${option ? `-${option}x` : ""}.png`;
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
              <div className={`it-frame ${counted && bgMode !== "transparent" ? "" : "is-checker"}`}>
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
            {counted && result && (
              <div className="it-bg">
                <div className="it-options" role="radiogroup" aria-label="Background">
                  {BACKGROUNDS.map(([value, label]) => (
                    <button key={value} role="radio" aria-checked={bgMode === value}
                            className={bgMode === value ? "active" : ""}
                            onClick={() => setBgMode(value)}>
                      {label}
                    </button>
                  ))}
                </div>
                {bgMode === "color" && (
                  <div className="it-swatches" role="radiogroup" aria-label="Background color">
                    {SWATCHES.map((c) => (
                      <button key={c} role="radio" aria-checked={bgColor === c} aria-label={c}
                              className={bgColor === c ? "active" : ""}
                              style={{ background: c }} onClick={() => setBgColor(c)} />
                    ))}
                    <label className="it-swatch-pick" title="Any color">
                      <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} aria-label="Pick any color" />
                    </label>
                  </div>
                )}
              </div>
            )}
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
            <button onClick={clear} disabled={busy} title="Remove this picture and start again">Remove</button>
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

      {error && (
        <p className="it-error">
          {error} {limitHit && <a href="/pricing">See Premium</a>}
        </p>
      )}

      <p className="it-note">
        {quotaLabel(quota) && <strong className="it-quota">{quotaLabel(quota)}. </strong>}
        Runs on your device, free. The first time, your browser downloads the {modelMb} MB AI model
        once and keeps it. {hint}
      </p>
    </div>
  );
}

export default ImageTool;
