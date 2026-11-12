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
