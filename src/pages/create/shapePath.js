const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const lerp = (a, b, amount) => ({ x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount });

const include = (bounds, point) => {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
};

function pathBounds(commands) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  let current = { x: 0, y: 0 };
  let start = current;

  commands.forEach(([type, ...values]) => {
    if (type === "M") {
      current = { x: values[0], y: values[1] };
      start = current;
      include(bounds, current);
    } else if (type === "L") {
      const end = { x: values[0], y: values[1] };
      include(bounds, current);
      include(bounds, end);
      current = end;
    } else if (type === "Q") {
      const control = { x: values[0], y: values[1] };
      const end = { x: values[2], y: values[3] };
      include(bounds, current);
      include(bounds, end);
      ["x", "y"].forEach((axis) => {
        const denominator = current[axis] - 2 * control[axis] + end[axis];
        if (!denominator) return;
        const t = (current[axis] - control[axis]) / denominator;
        if (t > 0 && t < 1) {
          const inverse = 1 - t;
          const value = inverse ** 2 * current[axis] + 2 * inverse * t * control[axis] + t ** 2 * end[axis];
          include(bounds, axis === "x" ? { x: value, y: current.y } : { x: current.x, y: value });
        }
      });
      current = end;
    } else if (type === "Z") {
      include(bounds, current);
      include(bounds, start);
      current = start;
    }
  });

  return bounds;
}

function basicPolygonPoints(width, height, sides) {
  if (sides === 3) {
    return [
      { x: width / 2, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];
  }
  return Array.from({ length: sides }, (_, index) => {
    const angle = (-90 + (360 * index) / sides) * Math.PI / 180;
    return {
      x: width / 2 + Math.cos(angle) * width / 2,
      y: height / 2 + Math.sin(angle) * height / 2,
    };
  });
}

export function regularPolygonPath(width, height, sides = 3, cornerRadius = 0) {
  const safeSides = Math.max(3, Math.min(20, Math.round(sides) || 3));
  const points = basicPolygonPoints(width, height, safeSides);
  let commands;

  if (cornerRadius <= 0) {
    commands = [["M", points[0].x, points[0].y]];
    points.slice(1).forEach((point) => commands.push(["L", point.x, point.y]));
    commands.push(["Z"]);
  } else {
    const corners = points.map((point, index) => {
      const previous = points[(index - 1 + points.length) % points.length];
      const next = points[(index + 1) % points.length];
      const incomingLength = distance(point, previous);
      const outgoingLength = distance(point, next);
      const cut = Math.min(cornerRadius, incomingLength * 0.48, outgoingLength * 0.48);
      return {
        point,
        incoming: lerp(point, previous, cut / incomingLength),
        outgoing: lerp(point, next, cut / outgoingLength),
      };
    });
    commands = [["M", corners[0].incoming.x, corners[0].incoming.y], ["Q", corners[0].point.x, corners[0].point.y, corners[0].outgoing.x, corners[0].outgoing.y]];
    corners.slice(1).forEach(({ point, incoming, outgoing }) => {
      commands.push(["L", incoming.x, incoming.y], ["Q", point.x, point.y, outgoing.x, outgoing.y]);
    });
    commands.push(["L", corners[0].incoming.x, corners[0].incoming.y], ["Z"]);
  }

  // Keep the editable path's bounds stable as corner rounding changes.
  const bounds = pathBounds(commands);
  const scaleX = width / Math.max(0.001, bounds.maxX - bounds.minX);
  const scaleY = height / Math.max(0.001, bounds.maxY - bounds.minY);
  const normalized = commands.map(([type, ...values]) => [
    type,
    ...values.map((value, index) => {
      const axis = index % 2 === 0 ? "x" : "y";
      return (value - bounds[axis === "x" ? "minX" : "minY"]) * (axis === "x" ? scaleX : scaleY);
    }),
  ]);

  return normalized.map(([type, ...values]) => `${type}${values.length ? ` ${values.map((value) => Number(value.toFixed(3))).join(" ")}` : ""}`).join(" ");
}
