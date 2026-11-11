// The AI tab of Create. Image cleanup and upscaling run locally; the other
// tools need the site's AI backend before they can be used.
import { Sparkle } from "../../components/AiSearchButton";

const tools = [
  ["Generate an image", "Describe a picture or an element and place it on the page."],
  ["Write text", "Headlines and captions in the tone you choose."],
  ["Remove background", "Cut the subject out of a photo you uploaded."],
  ["Color ideas", "Palettes that suit the colors already in your design."],
];

function AiPanel({ aiReady, hasSelectedImage, operation, models, onRun }) {
  const busy = Boolean(operation && !operation.error);
  return (
    <>
      <div className="cp-ai-intro">
        <Sparkle size={20} />
        <p>Improve images in your design. Local tools run in this browser.</p>
      </div>

      <p className="cp-label">Selected image</p>
      <div className="cp-ai-local">
        {!hasSelectedImage ? (
          <p className="cp-hint">Select a photo or image on the canvas to use these tools.</p>
        ) : (
          <>
            <button className="cp-ai-tool" disabled={busy} onClick={() => onRun("cutout")}>
              <strong>Remove background <span className="ai-soon">Free · {models.cutout.mb} MB model</span></strong>
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
        {busy && (
          <div className="cp-ai-progress" role="status">
            <span>{operation.step}{operation.progress > 0 && operation.progress < 1 ? ` · ${Math.round(operation.progress * 100)}%` : "…"}</span>
            <div><i style={{ width: `${Math.round((operation.progress || 0) * 100)}%` }} /></div>
          </div>
        )}
        {operation?.error && <p className="cp-ai-error" role="alert">{operation.error}</p>}
      </div>

      <p className="cp-label">More AI tools</p>

      <div className="cp-ai-list">
        {tools.map(([name, text]) => (
          <button key={name} className="cp-ai-tool" disabled>
            <strong>
              {name}
              <span className="ai-soon">{aiReady ? "In development" : "Coming soon"}</span>
            </strong>
            <span>{text}</span>
          </button>
        ))}
      </div>
      <p className="cp-hint">The first use downloads each local AI model once. It stays on this device for later use.</p>
    </>
  );
}

export default AiPanel;
