// Turns the icon playing in the Animate studio into one self-contained
// animated SVG file. It starts from the live preview, so Build and Draw keep
// the per-part delays and dash lengths the studio worked out.

const SVG_NS = "http://www.w3.org/2000/svg";

// the file's size, and the share of it the icon fills, as on the artboard;
// the margin leaves room for the motion
const FILE_PX = 512;
const ICON_SHARE = 0.6;

const round = (n) => Number(n.toFixed(2));

// the studio's whole-icon presets, with distances in the file's own units
function wholeIconFrames(preset, unit) {
  const d = (percent) => `${round((percent / 100) * unit)}px`;
  return {
    bounce: `0%,100%{transform:translateY(0)}30%{transform:translateY(${d(-16)})}50%{transform:translateY(0) scale(1.04,.96)}65%{transform:translateY(${d(-5)})}`,
    pop: "0%{transform:scale(.6);opacity:0}45%{transform:scale(1.12);opacity:1}70%{transform:scale(.96)}100%{transform:scale(1)}",
    spin: "from{transform:rotate(0deg)}to{transform:rotate(360deg)}",
    shake: `0%,100%{transform:translateX(0) rotate(0)}20%{transform:translateX(${d(-5)}) rotate(-6deg)}40%{transform:translateX(${d(5)}) rotate(6deg)}60%{transform:translateX(${d(-3)}) rotate(-3deg)}80%{transform:translateX(${d(3)}) rotate(3deg)}`,
    pulse: "0%,100%{transform:scale(1)}50%{transform:scale(1.12)}",
    float: `0%,100%{transform:translateY(0)}50%{transform:translateY(${d(-8)})}`,
    swing: "0%,100%{transform:rotate(0)}25%{transform:rotate(12deg)}75%{transform:rotate(-12deg)}",
  }[preset];
}

function stylesFor(preset, { duration, loop, center, unit }) {
  const repeat = loop ? "infinite" : "1";

  if (preset === "build") {
    return ".kd-part{transform-box:fill-box;transform-origin:50% 50%;"
      + `animation:kd-build ${duration}s cubic-bezier(.3,1.4,.5,1) ${repeat} both}`
      + "@keyframes kd-build{0%{transform:scale(0);opacity:0}60%,100%{transform:scale(1);opacity:1}}";
  }

  if (preset === "draw") {
    return `.kd-draw{animation:kd-draw ${round(duration * 1.8)}s ease-in-out ${repeat} both}`
      + ".kd-trace{animation-name:kd-draw-trace}"
      + "@keyframes kd-draw{0%{fill-opacity:0}55%{stroke-dashoffset:0;fill-opacity:0}75%,100%{stroke-dashoffset:0;fill-opacity:1}}"
      + "@keyframes kd-draw-trace{0%{fill-opacity:0;stroke-opacity:1}55%{stroke-dashoffset:0;fill-opacity:0;stroke-opacity:1}75%,100%{stroke-dashoffset:0;fill-opacity:1;stroke-opacity:0}}";
  }

  const easing = preset === "spin" ? "cubic-bezier(.6,0,.4,1)" : "ease-in-out";
  // Swing hangs from near the top of the icon
  const originY = preset === "swing" ? center - unit / 2 + unit * 0.1 : center;
  return `.kd-i{transform-box:view-box;transform-origin:${round(center)}px ${round(originY)}px;`
    + `animation:kd-m ${duration}s ${easing} ${repeat} both}`
    + `@keyframes kd-m{${wholeIconFrames(preset, unit)}}`;
}

// iconEl: the <svg> in the studio's stage. Returns the file's text.
export function buildAnimatedSvg(iconEl, { preset, duration, loop }) {
  const { x, y, width, height } = iconEl.viewBox.baseVal;
  const unit = Math.max(width, height);
  const size = unit / ICON_SHARE;
  const center = size / 2;

  const root = document.createElementNS(SVG_NS, "svg");
  root.setAttribute("viewBox", `0 0 ${round(size)} ${round(size)}`);
  root.setAttribute("width", String(FILE_PX));
  root.setAttribute("height", String(FILE_PX));

  const style = document.createElementNS(SVG_NS, "style");
  style.textContent = stylesFor(preset, { duration: round(duration), loop, center, unit });
  root.appendChild(style);

  const motion = document.createElementNS(SVG_NS, "g");
  motion.setAttribute("class", "kd-i");
  // puts the icon's own coordinates in the middle of the file
  const place = document.createElementNS(SVG_NS, "g");
  place.setAttribute("transform", `translate(${round(center - x - width / 2)} ${round(center - y - height / 2)})`);
  for (const node of iconEl.childNodes) place.appendChild(node.cloneNode(true));
  motion.appendChild(place);
  root.appendChild(motion);

  return new XMLSerializer().serializeToString(root);
}
