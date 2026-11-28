// Renders a kit with src/lib/mockupRender.js in Node (@napi-rs/canvas), to
// compare with the Python kit render and Photoshop. Usage:
// node test-render.mjs <src/lib/mockupRender.js> <kit dir> <out.png>
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [modPath, kitDir, outPath] = process.argv.slice(2);
const { loadKit, renderMockup } = await import(pathToFileURL(modPath).href);
const makeCanvas = (w, h) => createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
const base = kitDir.endsWith("/") ? kitDir : kitDir + "/";
const t0 = performance.now();
const { kit, images } = await loadKit(base, (p) => loadImage(readFileSync(p)), makeCanvas, async (p) => JSON.parse(readFileSync(p, "utf8")));
const t1 = performance.now();
const canvas = renderMockup({ kit, images, makeCanvas });
const t2 = performance.now();
writeFileSync(outPath, canvas.toBuffer("image/png"));
console.log(`${kitDir.split("/").filter(Boolean).pop()}: load ${Math.round(t1 - t0)} ms, render ${Math.round(t2 - t1)} ms`);
