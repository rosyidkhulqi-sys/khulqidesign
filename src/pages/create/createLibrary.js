// Building blocks for the Create editor. Icons, vectors and footage come from
// the same data as the library pages (src/data/), see CreateElements.jsx.

export const artboardPresets = [
  { label: "Instagram Post", ratio: "1:1", w: 1080, h: 1080 },
  { label: "Instagram Portrait", ratio: "4:5", w: 1080, h: 1350 },
  { label: "Story / Reels", ratio: "9:16", w: 1080, h: 1920 },
  { label: "YouTube Thumbnail", ratio: "16:9", w: 1280, h: 720 },
  { label: "Presentation", ratio: "16:9", w: 1920, h: 1080 },
  { label: "A4 Portrait", ratio: "A4", w: 1240, h: 1754 },
  { label: "Business Card", ratio: "7:4", w: 1050, h: 600 },
];

const polygonPoints = (sides, start = -90, innerRadius = null) => {
  const points = [];
  const count = innerRadius ? sides * 2 : sides;
  for (let i = 0; i < count; i += 1) {
    const angle = ((start + (360 * i) / count) * Math.PI) / 180;
    const radius = innerRadius && i % 2 ? innerRadius : 42;
    points.push({ x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius });
  }
  return points;
};

const polygonMarkup = (points) =>
  `<polygon points="${points.map(({ x, y }) => `${x},${y}`).join(" ")}" fill="#000000"/>`;

const line = (id, label, dash = null, cap = "butt") => {
  const dashAttribute = dash ? ` stroke-dasharray="${dash.join(" ")}"` : "";
  const capAttribute = cap === "round" ? ' stroke-linecap="round"' : "";
  return {
    id,
    label,
    group: "lines",
    kind: "line",
    dash,
    cap,
    preview: `<line x1="8" y1="50" x2="92" y2="50" stroke="#000000" stroke-width="6"${dashAttribute}${capAttribute}/>`,
  };
};

const polygon = (id, label, points, group) => ({
  id,
  label,
  group,
  kind: "polygon",
  points,
  preview: polygonMarkup(points),
});

export const shapeGroups = [
  {
    id: "lines",
    name: "Lines",
    items: [
      line("line", "Line"),
      line("dashed-line", "Dashed line", [12, 8]),
      line("dotted-line", "Dotted line", [2, 7], "round"),
      line("rounded-line", "Rounded line", null, "round"),
    ],
  },
  {
    id: "basic-shapes",
    name: "Basic shapes",
    items: [
      { id: "rect", label: "Square", kind: "rect", preview: '<rect x="8" y="8" width="84" height="84" fill="#000000"/>' },
      { id: "rounded", label: "Rounded square", kind: "rounded", preview: '<rect x="8" y="8" width="84" height="84" rx="16" fill="#000000"/>' },
      { id: "circle", label: "Circle", kind: "circle", preview: '<circle cx="50" cy="50" r="42" fill="#000000"/>' },
      { id: "oval", label: "Oval", kind: "oval", preview: '<ellipse cx="50" cy="50" rx="46" ry="32" fill="#000000"/>' },
      { id: "triangle", label: "Triangle", kind: "triangle", preview: '<polygon points="50,8 94,90 6,90" fill="#000000"/>' },
      polygon("triangle-down", "Inverted triangle", [{ x: 6, y: 10 }, { x: 94, y: 10 }, { x: 50, y: 92 }], "basic-shapes"),
      polygon("diamond", "Diamond", [{ x: 50, y: 5 }, { x: 95, y: 50 }, { x: 50, y: 95 }, { x: 5, y: 50 }], "basic-shapes"),
      polygon("plus", "Plus", [{ x: 38, y: 5 }, { x: 62, y: 5 }, { x: 62, y: 38 }, { x: 95, y: 38 }, { x: 95, y: 62 }, { x: 62, y: 62 }, { x: 62, y: 95 }, { x: 38, y: 95 }, { x: 38, y: 62 }, { x: 5, y: 62 }, { x: 5, y: 38 }, { x: 38, y: 38 }], "basic-shapes"),
    ],
  },
  {
    id: "polygons",
    name: "Polygons",
    items: [
      polygon("pentagon", "Pentagon", polygonPoints(5), "polygons"),
      polygon("hexagon", "Hexagon", polygonPoints(6, -90), "polygons"),
      polygon("octagon", "Octagon", polygonPoints(8, -67.5), "polygons"),
      polygon("trapezoid", "Trapezoid", [{ x: 22, y: 8 }, { x: 78, y: 8 }, { x: 96, y: 92 }, { x: 4, y: 92 }], "polygons"),
      polygon("parallelogram", "Parallelogram", [{ x: 28, y: 8 }, { x: 96, y: 8 }, { x: 72, y: 92 }, { x: 4, y: 92 }], "polygons"),
      polygon("chevron", "Chevron", [{ x: 5, y: 8 }, { x: 55, y: 8 }, { x: 95, y: 50 }, { x: 55, y: 92 }, { x: 5, y: 92 }, { x: 45, y: 50 }], "polygons"),
    ],
  },
  {
    id: "stars",
    name: "Stars",
    items: [
      polygon("star-4", "Four-point star", polygonPoints(4, -90, 12), "stars"),
      polygon("star", "Five-point star", polygonPoints(5, -90, 20), "stars"),
      polygon("star-6", "Six-point star", polygonPoints(6, -90, 22), "stars"),
      polygon("star-8", "Eight-point star", polygonPoints(8, -90, 24), "stars"),
    ],
  },
  {
    id: "arrows",
    name: "Arrows",
    items: [
      polygon("arrow-right", "Right arrow", [{ x: 5, y: 38 }, { x: 67, y: 38 }, { x: 67, y: 15 }, { x: 95, y: 50 }, { x: 67, y: 85 }, { x: 67, y: 62 }, { x: 5, y: 62 }], "arrows"),
      polygon("arrow-left", "Left arrow", [{ x: 95, y: 38 }, { x: 33, y: 38 }, { x: 33, y: 15 }, { x: 5, y: 50 }, { x: 33, y: 85 }, { x: 33, y: 62 }, { x: 95, y: 62 }], "arrows"),
      polygon("arrow-up", "Up arrow", [{ x: 38, y: 95 }, { x: 38, y: 33 }, { x: 15, y: 33 }, { x: 50, y: 5 }, { x: 85, y: 33 }, { x: 62, y: 33 }, { x: 62, y: 95 }], "arrows"),
      polygon("arrow-down", "Down arrow", [{ x: 38, y: 5 }, { x: 62, y: 5 }, { x: 62, y: 67 }, { x: 85, y: 67 }, { x: 50, y: 95 }, { x: 15, y: 67 }, { x: 38, y: 67 }], "arrows"),
    ],
  },
];

export const shapes = shapeGroups.flatMap((group) => group.items);

export const textPresets = [
  { id: "heading", label: "Add a heading", size: 96, weight: 700 },
  { id: "subheading", label: "Add a subheading", size: 56, weight: 500 },
  { id: "body", label: "Add body text", size: 36, weight: 400 },
];

export const svgDataUrl = (markup) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;

// Photo frames: shapes a photo is dropped into and cut to, as Canva's Frames.
// Each path is drawn in a w × h box (w and h are the frame's proportions).
export const photoFrames = [
  { id: "frame-circle", label: "Circle", w: 100, h: 100, path: "M50 0 A50 50 0 1 1 49.99 0Z" },
  { id: "frame-rounded", label: "Rounded square", w: 100, h: 100, path: "M16 0 H84 A16 16 0 0 1 100 16 V84 A16 16 0 0 1 84 100 H16 A16 16 0 0 1 0 84 V16 A16 16 0 0 1 16 0Z" },
  { id: "frame-square", label: "Square", w: 100, h: 100, path: "M0 0 H100 V100 H0Z" },
  { id: "frame-portrait", label: "Portrait 4:5", w: 80, h: 100, path: "M6 0 H74 A6 6 0 0 1 80 6 V94 A6 6 0 0 1 74 100 H6 A6 6 0 0 1 0 94 V6 A6 6 0 0 1 6 0Z" },
  { id: "frame-arch", label: "Arch", w: 80, h: 100, path: "M0 100 V40 A40 40 0 0 1 80 40 V100Z" },
  { id: "frame-blob", label: "Blob", w: 100, h: 100, path: "M52 2 C74 0 94 14 98 36 C102 58 92 80 74 92 C56 104 30 102 14 88 C-2 74 -2 48 8 28 C16 12 32 4 52 2Z" },
  { id: "frame-hexagon", label: "Hexagon", w: 100, h: 88, path: "M25 0 H75 L100 44 L75 88 H25 L0 44Z" },
  {
    id: "frame-flower",
    label: "Scalloped",
    w: 100,
    h: 100,
    // twelve round bumps around a circle
    path: (() => {
      const n = 12, r = 42, bump = 9;
      let d = "";
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * 2 * Math.PI - Math.PI / 2;
        const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
        const p0 = [50 + r * Math.cos(a0), 50 + r * Math.sin(a0)];
        const p1 = [50 + r * Math.cos(a1), 50 + r * Math.sin(a1)];
        d += `${i ? "" : `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)} `}A${bump} ${bump} 0 0 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} `;
      }
      return `${d}Z`;
    })(),
  },
];

// a photo frame's look in the panel: the shape in grey with a picture sign
export const frameArt = (frame, fill = "#d4d8de") =>
  svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${frame.w + 4} ${frame.h + 4}"><path d="${frame.path}" fill="${fill}"/>`
    + `<g transform="translate(${frame.w / 2 - 12} ${frame.h / 2 - 9})" fill="#8a929c"><path d="M0 18 L8 8 L13 13 L17 9 L24 18Z"/><circle cx="18" cy="3.5" r="3"/></g></svg>`);

