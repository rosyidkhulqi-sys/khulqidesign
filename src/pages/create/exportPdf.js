// Every page of a design in one PDF, for printing and sending.
//
// Each page is drawn off screen at about 300 pixels per inch and placed on a
// PDF page of the design's size, so the file looks exactly like the editor,
// fonts and all. (Vector text would need every web font as TTF inside the
// PDF, which the browser can't get from Google Fonts.) jsPDF loads only when
// someone asks for a PDF.
import { StaticCanvas } from "fabric";
import { loadFontsOf } from "./createFonts";

// print formats get their real paper size; screen formats count 96 px an inch
const PAPER_MM = {
  "1240x1754": [210, 297], // A4
  "1050x600": [88.9, 50.8], // business card, 3.5 x 2 in
};
const MM_PER_PX = 25.4 / 96;
const DPI = 300;
// keeps a page's picture within what browsers draw reliably
const MAX_SIDE = 4800;

export function paperOf(board) {
  return PAPER_MM[`${board.w}x${board.h}`] ?? [board.w * MM_PER_PX, board.h * MM_PER_PX];
}

// pages: Fabric JSON per page; onProgress(0..1). Resolves a PDF Blob.
export async function buildPdf(pages, board, onProgress) {
  const { jsPDF } = await import("jspdf");
  await loadFontsOf(pages);

  const [w, h] = paperOf(board);
  const orientation = w > h ? "landscape" : "portrait";
  const longest = Math.max(board.w, board.h);
  // about 300 px per inch of paper, and never below twice the design's size
  const target = Math.min(MAX_SIDE, Math.max(longest * 2, (Math.max(w, h) / 25.4) * DPI));
  const multiplier = target / longest;

  const doc = new jsPDF({ unit: "mm", format: [w, h], orientation, compress: true });
  for (const [i, page] of pages.entries()) {
    if (i > 0) doc.addPage([w, h], orientation);
    const c = new StaticCanvas(undefined, { width: board.w, height: board.h, renderOnAddRemove: false });
    try {
      await c.loadFromJSON(page);
      // a page left see-through prints white, not black
      if (!c.backgroundColor) c.backgroundColor = "#ffffff";
      c.renderAll();
      const picture = c.toDataURL({ format: "jpeg", quality: 0.92, multiplier });
      doc.addImage(picture, "JPEG", 0, 0, w, h, undefined, "FAST");
    } finally {
      c.dispose();
    }
    onProgress?.((i + 1) / pages.length);
  }
  return doc.output("blob");
}
