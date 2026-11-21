import { director, sleep } from "./director.mjs";
import fs from "fs";
const out = process.argv[2];
const { chapters } = await import(new URL(process.argv[3] || "./stories/01-create.mjs", import.meta.url));
fs.mkdirSync(out + "/pv", { recursive: true });
const d = await director({ profile: out + "/prof-pv-" + Date.now(), port: 9351, K: 1, scale: 1 });
try {
  await d.goto("http://localhost:5173/", 5);
  let ci = 0;
  for (const ch of chapters) {
    ci++;
    let bi = 0;
    for (const beat of ch.beats) {
      bi++;
      const t = Date.now();
      try { await beat.act(d); } catch (e) { console.log(`ERR ch${ci}.${bi}`, e.message.slice(0, 200)); }
      console.log(`ch${ci}.${bi} ${((Date.now() - t) / 1000).toFixed(1)}s  ${beat.say.slice(0, 50)}`);
      await d.shot(`${out}/pv/${ci}-${bi}.png`);
    }
  }
} finally { d.close(); }
