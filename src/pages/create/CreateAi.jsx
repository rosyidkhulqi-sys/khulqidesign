// The AI tab of the Create editor: the AI tools that are coming. Each one
// will call a function in lib/ai.js; until the AI backend is ready they are
// listed as "Coming soon" and can't be clicked.
import { aiReady } from "../../lib/ai";
import { Sparkle } from "../../components/AiSearchButton";

const tools = [
  ["Generate an image", "Describe a picture or an element and place it on the page."],
  ["Write text", "Headlines and captions in the tone you choose."],
  ["Remove background", "Cut the subject out of a photo you uploaded."],
  ["Color ideas", "Palettes that suit the colors already in your design."],
];

function AiPanel() {
  return (
    <>
      <div className="cp-ai-intro">
        <Sparkle size={20} />
        <p>AI tools for your designs, working with the Khulqidesign library.</p>
      </div>

      <div className="cp-ai-list">
        {tools.map(([name, text]) => (
          <button key={name} className="cp-ai-tool" disabled={!aiReady}>
            <strong>
              {name}
              {!aiReady && <span className="ai-soon">Coming soon</span>}
            </strong>
            <span>{text}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export default AiPanel;
