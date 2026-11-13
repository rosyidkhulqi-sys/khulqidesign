// The Animate studio's motion, in one place: the presets' keyframes, the
// easing choices and the pause between loops. The live preview, the animated
// SVG (and so GIF and MP4, which are drawn from it) and Lottie all read this,
// so every export moves exactly like the preview.

const round = (n) => Number(n.toFixed(2));

// how each move between keyframes speeds up and slows down. Build and Draw
// keep their own curves; these are for the whole-icon presets.
export const EASINGS = [
  ["smooth", "Smooth"],
  ["snappy", "Snappy"],
  ["bouncy", "Bouncy"],
  ["linear", "Linear"],
];
const BEZIER = {
  smooth: [0.42, 0, 0.58, 1],
  snappy: [0, 0, 0.2, 1],
  bouncy: [0.34, 1.56, 0.64, 1],
  linear: [0, 0, 1, 1],
};
// Smooth spin starts and ends a little softer than plain ease-in-out
const SPIN_SMOOTH = [0.6, 0, 0.4, 1];
export const BUILD_EASE = [0.3, 1.4, 0.5, 1];

export function easingOf(preset, easing) {
  if (!easing || easing === "smooth") return preset === "spin" ? SPIN_SMOOTH : BEZIER.smooth;
  return BEZIER[easing] ?? BEZIER.smooth;
}
export const cssEasing = (b) => `cubic-bezier(${b.join(",")})`;

// seconds of stillness after each play, while looping
export const PAUSES = [0, 0.5, 1, 2];

// presets that move the icon as a whole (Build and Draw work on its parts)
export const wholeIcon = (preset) => preset !== "build" && preset !== "draw";

// how long one play of the motion runs (Draw traces slower than it fills)
export const motionLength = (preset, duration) => (preset === "draw" ? duration * 1.8 : duration);

// the whole-icon presets; d(percent of the icon's size) gives a distance
export function wholeIconFrames(preset, d) {
  return {
    bounce: `0%,100%{transform:translateY(0)}30%{transform:translateY(${d(-16)})}50%{transform:translateY(0) scale(1.04,.96)}65%{transform:translateY(${d(-5)})}`,
    pop: "0%{transform:scale(.6);opacity:0}45%{transform:scale(1.12);opacity:1}70%{transform:scale(.96)}100%{transform:scale(1)}",
    spin: "0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}",
    shake: `0%,100%{transform:translateX(0) rotate(0)}20%{transform:translateX(${d(-5)}) rotate(-6deg)}40%{transform:translateX(${d(5)}) rotate(6deg)}60%{transform:translateX(${d(-3)}) rotate(-3deg)}80%{transform:translateX(${d(3)}) rotate(3deg)}`,
    pulse: "0%,100%{transform:scale(1)}50%{transform:scale(1.12)}",
    float: `0%,100%{transform:translateY(0)}50%{transform:translateY(${d(-8)})}`,
    swing: "0%,100%{transform:rotate(0)}25%{transform:rotate(12deg)}75%{transform:rotate(-12deg)}",
  }[preset];
}

const BUILD = "0%{transform:scale(0);opacity:0}60%,100%{transform:scale(1);opacity:1}";
const DRAW = "0%{fill-opacity:0}55%{stroke-dashoffset:0;fill-opacity:0}75%,100%{stroke-dashoffset:0;fill-opacity:1}";
const TRACE = "0%{fill-opacity:0;stroke-opacity:1}55%{stroke-dashoffset:0;fill-opacity:0;stroke-opacity:1}75%,100%{stroke-dashoffset:0;fill-opacity:1;stroke-opacity:0}";

// Squeezes keyframes into the first share r of the time, so the motion plays
// and then holds its last pose for the rest: a pause before the next loop.
export function stretch(body, r) {
  if (r >= 0.999) return body;
  return body.replace(/(^|\})([^{}]+)\{/g, (_, close, selector) => {
    const stops = selector.split(",").map((s) => s.trim()).map((s) => (s === "from" ? 0 : s === "to" ? 100 : parseFloat(s)));
    const moved = stops.map((p) => `${round(p * r)}%`);
    if (stops.includes(100)) moved.push("100%");
    return `${close}${moved.join(",")}{`;
  });
}

// One play plus its pause, and the share of it the motion takes. The pause
// is given only while looping (the studio sends 0 otherwise); GIF and MP4
// render one play but keep the pause, so the clip loops with it.
export function timing(preset, { duration, pause = 0 }) {
  const length = motionLength(preset, duration);
  const rest = pause;
  return { period: round(length + rest), share: length / (length + rest) };
}

// The stylesheet that runs a preset. sel names the elements: icon (the
// whole-icon mover), part (Build) and draw / trace (Draw). d turns a percent
// of the icon's size into a CSS distance.
export function motionStyles(preset, { duration, loop, easing, pause, sel, d, name = "kd" }) {
  const { period, share } = timing(preset, { duration, pause });
  const repeat = loop ? "infinite" : "1";
  if (preset === "build") {
    return `${sel.part}{animation:${name}-build ${period}s ${cssEasing(BUILD_EASE)} ${repeat} both}`
      + `@keyframes ${name}-build{${stretch(BUILD, share)}}`;
  }
  if (preset === "draw") {
    return `${sel.draw}{animation:${name}-draw ${period}s ease-in-out ${repeat} both}`
      + `${sel.trace}{animation-name:${name}-trace}`
      + `@keyframes ${name}-draw{${stretch(DRAW, share)}}`
      + `@keyframes ${name}-trace{${stretch(TRACE, share)}}`;
  }
  return `${sel.icon}{animation:${name}-m ${period}s ${cssEasing(easingOf(preset, easing))} ${repeat} both}`
    + `@keyframes ${name}-m{${stretch(wholeIconFrames(preset, d), share)}}`;
}
