// node eleven.mjs <voiceId> <outDir> [story] — one MP3 per beat (01-01.mp3 …) from ElevenLabs.
// The key is read from ~/.elevenlabs-key and never printed.
import fs from "fs";
import os from "os";

const [voice, out, story = "./stories/01-create.mjs"] = process.argv.slice(2);
const { chapters } = await import(new URL(story, import.meta.url));
const key = fs.readFileSync(os.homedir() + "/.elevenlabs-key", "utf8").trim();
fs.mkdirSync(out, { recursive: true });
const beats = chapters.flatMap((ch, ci) => ch.beats.map((b, bi) => ({ id: `${String(ci + 1).padStart(2, "0")}-${String(bi + 1).padStart(2, "0")}`, text: b.say })));
for (let i = 0; i < beats.length; i++) {
  const b = beats[i];
  const file = `${out}/${b.id}.mp3`;
  if (fs.existsSync(file)) continue;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_192`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: b.text,
      model_id: "eleven_multilingual_v2",
      // neighbours keep the tone even from sentence to sentence
      previous_text: beats[i - 1]?.text,
      next_text: beats[i + 1]?.text,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
    }),
  });
  if (!res.ok) { console.log(b.id, "failed", res.status, (await res.text()).slice(0, 200)); process.exit(1); }
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log(b.id, "ok");
}
