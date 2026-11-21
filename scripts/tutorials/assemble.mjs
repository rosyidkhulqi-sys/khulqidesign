// node assemble.mjs <outDir> [name] — frames + voice from record.mjs into a 4K MP4 and an SRT
import { execFileSync } from "child_process";
import { FFMPEG } from "./director.mjs";
import fs from "fs";
import path from "path";

const out = path.resolve(process.argv[2]);
const name = process.argv[3] || "tutorial";
const FF = FFMPEG;
const tl = JSON.parse(fs.readFileSync(`${out}/timeline.json`, "utf8"));
const frames = tl.frames.filter((f) => fs.existsSync(f.file));
const total = tl.duration;

// frames, each shown until the next one arrived
let list = "";
frames.forEach((f, i) => {
  const next = i + 1 < frames.length ? frames[i + 1].t : total;
  list += `file '${f.file}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}\n`;
});
list += `file '${frames.at(-1).file}'\n`;
fs.writeFileSync(`${out}/frames.txt`, list);

// the voice: each sentence placed where its beat starts
const inputs = [], filters = [];
tl.beats.forEach((b, i) => {
  inputs.push("-i", b.file);
  filters.push(`[${i + 1}:a]adelay=${Math.round(b.start * 1000)}|${Math.round(b.start * 1000)}[a${i}]`);
});
const mix = `${filters.join(";")};${tl.beats.map((_, i) => `[a${i}]`).join("")}amix=inputs=${tl.beats.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11[aout]`;

execFileSync(FF, [
  "-y", "-loglevel", "error", "-stats",
  "-f", "concat", "-safe", "0", "-i", `${out}/frames.txt`,
  ...inputs,
  "-filter_complex", `[0:v]fps=30,scale=3840:2160:flags=lanczos:out_color_matrix=bt709,format=yuv420p[vout];${mix}`,
  "-map", "[vout]", "-map", "[aout]",
  "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-profile:v", "high", "-level", "5.1", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart",
  "-t", total.toFixed(3),
  `${out}/${name}.mp4`,
], { stdio: "inherit" });

// captions: one cue per sentence (split if long)
const ts = (s) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
let srt = "", n = 0;
for (const b of tl.beats) {
  const parts = b.say.match(/[^.!?]+[.!?]+/g) ?? [b.say];
  const words = parts.map((p) => p.trim().split(/\s+/).length), all = words.reduce((a, c) => a + c, 0);
  let t = b.start;
  parts.forEach((p, i) => {
    const len = (b.dur * words[i]) / all;
    srt += `${++n}\n${ts(t)} --> ${ts(t + len)}\n${p.trim()}\n\n`;
    t += len;
  });
}
fs.writeFileSync(`${out}/${name}.srt`, srt);

// chapters for the YouTube description
let chapters = "", seen = new Set();
for (const b of tl.beats) if (!seen.has(b.title)) { seen.add(b.title); const s = Math.floor(b.start); chapters += `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} ${b.title}\n`; }
fs.writeFileSync(`${out}/${name}-chapters.txt`, chapters);
console.log(chapters);
