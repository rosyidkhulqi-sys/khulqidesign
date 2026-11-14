// QR codes for Create: a link or any text as a crisp SVG (one square for the
// background, one path for the dark modules), so it stays sharp at any size
// and both colors can be changed like any other element.
import qrcode from "qrcode-generator";

const QUIET = 4; // the blank margin scanners need, in modules
export const QR_MAX = 900; // characters; longer text makes a code too dense to scan

// what a scanner opens: a bare domain becomes a web link
export function qrText(input) {
  const s = input.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) return `https://${s}`;
  return s;
}

export function qrSvg(text, { color = "#000000", background = "#FFFFFF" } = {}) {
  // byte mode carries UTF-8: pass the bytes as one character each
  const bytes = String.fromCharCode(...new TextEncoder().encode(text));
  const qr = qrcode(0, "M");
  qr.addData(bytes, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const size = n + QUIET * 2;
  let d = "";
  for (let y = 0; y < n; y += 1) {
    // runs of dark modules on a row become one rectangle
    for (let x = 0; x < n; x += 1) {
      if (!qr.isDark(y, x)) continue;
      let run = 1;
      while (x + run < n && qr.isDark(y, x + run)) run += 1;
      d += `M${x + QUIET} ${y + QUIET}h${run}v1h-${run}z`;
      x += run - 1;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 10}" height="${size * 10}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${background}"/><path d="${d}" fill="${color}"/></svg>`;
}
