// Tables for Create. A table is a Group rebuilt from its data (kdTable): the
// words in each cell, the style, font and sizes. Every part carries a role
// (kdRole), so colors changed from the Colors panel survive a rebuild.
import { Group, Rect, Textbox } from "fabric";

export const TABLE_STYLES = [
  ["header", "Header"],
  ["lines", "Lines"],
  ["striped", "Striped"],
];

export const TABLE_MAX = 12; // rows or columns

const DEFAULT_COLORS = {
  head: "#1B2B4B", // header row fill
  headText: "#FFFFFF",
  text: "#1B2B4B",
  stripe: "#EEF1F6",
  line: "#C9CFD9",
  body: "#FFFFFF",
};

// a new table's data: 4 rows (one header) by 3 columns, sized to the page
export function newTable(style, unit) {
  const cols = 3;
  const size = Math.round(unit * 0.026);
  return {
    style,
    font: "Inter",
    size,
    colW: Math.round((unit * 0.72) / cols),
    rows: [
      Array.from({ length: cols }, (_, i) => `Column ${i + 1}`),
      ...Array.from({ length: 3 }, () => Array(cols).fill("")),
    ],
  };
}

// rows or columns changed, keeping what's typed and the table's width
export function resizeTable(data, rows, cols) {
  const r = Math.max(1, Math.min(TABLE_MAX, rows));
  const c = Math.max(1, Math.min(TABLE_MAX, cols));
  const width = data.colW * data.rows[0].length;
  return {
    ...data,
    colW: width / c,
    rows: Array.from({ length: r }, (_, i) =>
      Array.from({ length: c }, (_, j) => data.rows[i]?.[j] ?? (i === 0 ? `Column ${j + 1}` : ""))),
  };
}

// colors of an existing table, by role
export function tableColors(group) {
  const colors = { ...DEFAULT_COLORS };
  const seen = new Set();
  for (const o of group?.getObjects?.() ?? []) {
    if (!o.kdRole || seen.has(o.kdRole) || typeof o.fill !== "string") continue;
    seen.add(o.kdRole);
    colors[o.kdRole] = o.fill;
  }
  return colors;
}

// the table as a Group; its top-left corner at (0, 0) before placing.
// Also returns where each row starts, for finding the cell under a click.
export function buildTable(data, colors = DEFAULT_COLORS) {
  const { style, font, size, colW, rows } = data;
  const cols = rows[0].length;
  const pad = Math.round(size * 0.6);
  const minH = Math.round(size * 1.3 + pad * 2);
  const stroke = Math.max(1, Math.round(size * 0.06));
  const width = colW * cols;
  const header = style !== "lines";

  // the words first: they decide each row's height
  const texts = rows.map((row, r) =>
    row.map((text, c) => {
      const head = r === 0;
      return new Textbox(text, {
        left: c * colW + pad,
        width: colW - pad * 2,
        fontFamily: font,
        fontSize: size,
        fontWeight: head ? 700 : 400,
        lineHeight: 1.2,
        fill: head && header ? colors.headText : colors.text,
        kdRole: head && header ? "headText" : "text",
        kdCell: [r, c],
        strokeWidth: 0,
      });
    }));
  const heights = texts.map((row) => Math.max(minH, ...row.map((t) => t.height + pad * 2)));
  const tops = [];
  heights.reduce((y, h, i) => ((tops[i] = y), y + h), 0);
  const height = heights.reduce((a, b) => a + b, 0);
  texts.forEach((row, r) => row.forEach((t) => t.set({ top: tops[r] + (heights[r] - t.height) / 2 })));

  const parts = [new Rect({ left: 0, top: 0, width, height, fill: colors.body, kdRole: "body", strokeWidth: 0 })];
  rows.forEach((_, r) => {
    if (r === 0 && header) {
      parts.push(new Rect({ left: 0, top: 0, width, height: heights[0], fill: colors.head, kdRole: "head", strokeWidth: 0 }));
    } else if (style === "striped" && r % 2 === 0) {
      parts.push(new Rect({ left: 0, top: tops[r], width, height: heights[r], fill: colors.stripe, kdRole: "stripe", strokeWidth: 0 }));
    }
  });
  // lines between rows; Lines also draws columns and the outside edge
  const line = (left, top, w, h) => new Rect({ left, top, width: w, height: h, fill: colors.line, kdRole: "line", strokeWidth: 0 });
  for (let r = 1; r < rows.length; r++) {
    if (style === "striped") break;
    parts.push(line(0, tops[r] - stroke / 2, width, stroke));
  }
  if (style === "lines") {
    for (let c = 1; c < cols; c++) parts.push(line(c * colW - stroke / 2, 0, stroke, height));
    parts.push(line(0, 0, width, stroke), line(0, height - stroke, width, stroke));
    parts.push(line(0, 0, stroke, height), line(width - stroke, 0, stroke, height));
    // the header row stands out by weight and a stronger line
    parts.push(new Rect({ left: 0, top: heights[0] - stroke, width, height: stroke * 2, fill: colors.rule ?? colors.text, kdRole: "rule", strokeWidth: 0 }));
  }

  const group = new Group([...parts, ...texts.flat()]);
  return { group, tops, heights, width, height };
}

// the cell under a point given in the table's own plane (center at 0, 0);
// tops: where each row starts, as buildTable returned them
export function cellAt(data, tops, group, local) {
  const x = local.x + group.width / 2;
  const y = local.y + group.height / 2;
  const c = Math.floor(x / data.colW);
  if (c < 0 || c >= data.rows[0].length || y < 0 || y > group.height) return null;
  let r = 0;
  while (r + 1 < tops.length && y >= tops[r + 1]) r += 1;
  return [r, c];
}

// a small picture of each style for the Elements panel
export function tableArt(style) {
  const head = style !== "lines";
  const rows = [0, 1, 2, 3];
  const cells = rows.map((r) => {
    const y = 10 + r * 20;
    const fill = r === 0 && head ? "#1B2B4B" : style === "striped" && r % 2 === 0 ? "#EEF1F6" : "#FFFFFF";
    const bar = r === 0 ? (head ? "#FFFFFF" : "#1B2B4B") : "#9AA3B2";
    return `<rect x="10" y="${y}" width="80" height="20" fill="${fill}"/>` +
      [0, 1, 2].map((c) => `<rect x="${14 + c * 27}" y="${y + 8}" width="${r === 0 ? 16 : 12}" height="4" rx="2" fill="${bar}"/>`).join("");
  }).join("");
  const lines = style === "striped" ? "" :
    [1, 2, 3].map((r) => `<rect x="10" y="${10 + r * 20}" width="80" height="1" fill="#C9CFD9"/>`).join("") +
    (style === "lines" ? `<rect x="10" y="10" width="80" height="80" fill="none" stroke="#C9CFD9"/><rect x="36" y="10" width="1" height="80" fill="#C9CFD9"/><rect x="63" y="10" width="1" height="80" fill="#C9CFD9"/><rect x="10" y="29" width="80" height="2" fill="#1B2B4B"/>` : "");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${cells}${lines}</svg>`)}`;
}
