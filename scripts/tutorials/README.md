# Tutorial recorder

Makes the YouTube tutorials automatically: drives Create in headless Chrome
like a person (cursor, clicks, typing), records it at 4K, voices every
sentence and puts it together as an MP4 with captions and chapters.

It runs against the dev server (`npm run dev`, http://localhost:5173) in a
fresh, logged-out browser, so admin menus never show.

## Files

- `stories/NN-name.mjs` — one tutorial: chapters of beats, each beat a
  sentence (`say`) and what happens on screen while it's said (`act`)
- `director.mjs` — the browser driver: cursor, clicks, drags, typing, upload,
  4K capture in slow motion (K times slower, played back K times faster)
- `preview.mjs` — runs a story fast at 1080p and saves a screenshot per beat
- `record.mjs` — voices and records a story (writes `timeline.json`)
- `assemble.mjs` — frames + voice into a 4K MP4, an SRT and a chapter list
- `eleven.mjs` — ElevenLabs voices, one MP3 per beat
- `media/` — pictures a story uploads

## Run

Keep the output outside the repo (it's hundreds of MB):

```sh
OUT=~/Downloads/Khulqidesign-YouTube/renders/01-create
node scripts/tutorials/preview.mjs "$OUT-preview"            # check every beat
node scripts/tutorials/record.mjs "$OUT" --voice Samantha      # ~2.5× the video length
node scripts/tutorials/assemble.mjs "$OUT" getting-started-with-create
```

With ElevenLabs voices instead of macOS `say`:

```sh
node scripts/tutorials/eleven.mjs <voiceId> "$OUT-voice"
node scripts/tutorials/record.mjs "$OUT" --audio "$OUT-voice"
```

The ElevenLabs key is read from `~/.elevenlabs-key` (never from the repo,
never printed).

## Needs

- Google Chrome
- ffmpeg: set `KD_FFMPEG`, or keep the `ffmpeg-static` package in
  `~/Downloads/Khulqidesign-YouTube/recorder/tools`

## Lessons

- Every input goes through `exclusive()` in the director: a click or drag
  sent while a 4K screenshot is being taken can get lost.
- Wait for lazy content with `waitFor()` (search results, for example)
  before clicking it.
