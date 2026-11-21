// node record.mjs <outDir> [--story ./stories/01-create.mjs] [--voice "Samantha"] [--rate 175] [--audio dir] [--K 2.5] [--chapters 1-2] [--scale 2]
// 1) voices every beat (macOS say, or MP3/WAV files named 01-01.* in --audio)
// 2) records Create at 4K, each beat held as long as its sentence
// 3) writes timeline.json for assemble.mjs
import { director, FFMPEG } from "./director.mjs";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const out = path.resolve(args[0]);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i < 0 ? d : args[i + 1]; };
const K = Number(opt("K", 2.5));
const scale = Number(opt("scale", 2));
const voice = opt("voice", "Samantha");
const rate = opt("rate", "172");
const audioDir = opt("audio", null);
const { chapters } = await import(new URL(opt("story", "./stories/01-create.mjs"), import.meta.url));
const [c0, c1] = (opt("chapters", "1-99")).split("-").map(Number);
const FF = FFMPEG;
fs.mkdirSync(out + "/voice", { recursive: true });

const dur = (f) => {
  const r = execFileSync(FF, ["-i", f, "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] }).toString();
  return 0;
};
const probe = (f) => {
  try { execFileSync(FF, ["-hide_banner", "-i", f], { stdio: ["ignore", "ignore", "pipe"] }); } catch (e) {
    const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/);
    if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  }
  throw new Error("no duration: " + f);
};

// 1) the voice
const beats = [];
chapters.forEach((ch, ci) => {
  if (ci + 1 < c0 || ci + 1 > c1) return;
  ch.beats.forEach((b, bi) => {
    const id = `${String(ci + 1).padStart(2, "0")}-${String(bi + 1).padStart(2, "0")}`;
    let file;
    if (audioDir) {
      const f = fs.readdirSync(audioDir).find((n) => n.startsWith(id + "."));
      if (!f) throw new Error("missing audio " + id);
      file = `${out}/voice/${id}.wav`;
      execFileSync(FF, ["-y", "-loglevel", "error", "-i", `${audioDir}/${f}`, "-ar", "48000", "-ac", "2", file]);
    } else {
      const aiff = `${out}/voice/${id}.aiff`;
      execFileSync("say", ["-v", voice, "-r", rate, "-o", aiff, b.say]);
      file = `${out}/voice/${id}.wav`;
      execFileSync(FF, ["-y", "-loglevel", "error", "-i", aiff, "-ar", "48000", "-ac", "2", file]);
    }
    beats.push({ id, chapter: ci, title: ch.title, say: b.say, act: b.act, file, dur: probe(file) });
  });
});
console.log("voice:", beats.length, "beats,", beats.reduce((s, b) => s + b.dur, 0).toFixed(1), "s of speech");

// 2) the recording
const d = await director({ profile: `${out}/profile-${Date.now()}`, port: 9360, K, scale, frameDir: `${out}/frames` });
const timeline = [];
try {
  await d.goto("http://localhost:5173/", 6);
  if (c0 > 1) {
    // later chapters only: play the earlier ones unrecorded, to reach the same state
    for (let ci = 0; ci < c0 - 1; ci++) for (const b of chapters[ci].beats) await b.act(d);
  }
  d.startRec();
  await d.wait(0.8);
  let last = -1;
  for (const b of beats) {
    if (b.chapter !== last && last !== -1) await d.wait(0.5);
    last = b.chapter;
    const start = d.now();
    timeline.push({ id: b.id, title: b.title, say: b.say, file: b.file, dur: b.dur, start });
    const t = Date.now();
    try { await b.act(d); } catch (e) { console.log("ERR", b.id, e.message.slice(0, 160)); }
    const left = start + b.dur + 0.35 - d.now();
    if (left > 0) await d.wait(left);
    console.log(b.id, "voice", b.dur.toFixed(1), "s, screen", (d.now() - start).toFixed(1), "s");
  }
  await d.wait(1.2);
  const rec = await d.stopRec();
  fs.writeFileSync(`${out}/timeline.json`, JSON.stringify({ K, scale, beats: timeline, frames: rec.frames, duration: rec.duration }, null, 1));
  console.log("frames", rec.frames.length, "video", rec.duration.toFixed(1), "s");
} finally { d.close(); }
