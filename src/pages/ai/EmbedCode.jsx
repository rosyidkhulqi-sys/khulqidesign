// After an animated SVG or Lottie export: the few lines that put the file on
// a website, for plain HTML or React, ready to copy. Shown only once the file
// is exported (both are Premium), so it never hands out the file itself.
import { useState } from "react";

// a stable lottie-web build on cdnjs
const LOTTIE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js";

function snippets({ kind, file, label, loop }) {
  const id = file.replace(/\.[a-z]+$/, "");
  if (kind === "svg") {
    return {
      HTML: `<!-- Put ${file} next to your page -->
<img src="${file}" width="128" height="128" alt="${label}">`,
      React: `import icon from "./${file}";

export function AnimatedIcon() {
  return <img src={icon} width={128} height={128} alt="${label}" />;
}`,
    };
  }
  return {
    HTML: `<!-- Put ${file} next to your page -->
<div id="${id}" style="width: 128px; height: 128px"></div>
<script src="${LOTTIE_CDN}"></script>
<script>
  lottie.loadAnimation({
    container: document.getElementById("${id}"),
    renderer: "svg",
    loop: ${loop},
    autoplay: true,
    path: "${file}",
  });
</script>`,
    React: `// npm install lottie-react
import Lottie from "lottie-react";
import animation from "./${file}";

export function AnimatedIcon() {
  return <Lottie animationData={animation} loop={${loop}} style={{ width: 128, height: 128 }} />;
}`,
  };
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // older browsers and blocked clipboard access
    const area = document.createElement("textarea");
    area.value = text;
    area.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

function EmbedCode({ embed, onClose }) {
  const codes = snippets(embed);
  const [tab, setTab] = useState("HTML");
  const [copied, setCopied] = useState(false);
  const code = codes[tab];

  return (
    <div className="embed" role="region" aria-label="Embed code">
      <div className="embed-head">
        <strong>Use it on a website</strong>
        <button className="embed-close" onClick={onClose} aria-label="Close embed code" title="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="embed-tabs" role="tablist">
        {Object.keys(codes).map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            className={tab === name ? "active" : ""}
            onClick={() => {
              setTab(name);
              setCopied(false);
            }}
          >
            {name}
          </button>
        ))}
        <button
          className="embed-copy"
          onClick={async () => setCopied(await copyText(code))}
        >
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <pre className="embed-code"><code>{code}</code></pre>
    </div>
  );
}

export default EmbedCode;
