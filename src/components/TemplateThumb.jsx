// Renders a template scene as a scalable SVG preview, using the same element
// data that Create loads, so the thumbnail always matches the editable design.
// AI designs may also set opacity, a turn (around the top-left corner, as in
// Create), an outline, italic text, line height and letter spacing.
function TemplateThumb({ scene }) {
  return (
    <svg
      viewBox={`0 0 ${scene.w} ${scene.h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      <rect width={scene.w} height={scene.h} fill={scene.bg} />
      {scene.elements.map((el, i) => {
        const turn = el.angle ? `rotate(${el.angle} ${el.x} ${el.y})` : undefined;
        const outline = el.strokeWidth ? { stroke: el.stroke, strokeWidth: el.strokeWidth } : {};
        const opacity = el.opacity ?? 1;
        if (el.type === "rect") {
          return (
            <rect key={i} x={el.x} y={el.y} width={el.w} height={el.h} rx={el.r || 0} fill={el.fill}
                  opacity={opacity} transform={turn} {...outline} />
          );
        }
        if (el.type === "circle") {
          return <circle key={i} cx={el.x + el.r} cy={el.y + el.r} r={el.r} fill={el.fill} opacity={opacity} {...outline} />;
        }
        if (el.type === "image") {
          return (
            <image key={i} href={el.src} x={el.x} y={el.y} width={el.w} height={el.h}
                   preserveAspectRatio="xMidYMid slice" />
          );
        }
        return (
          <foreignObject key={i} x={el.x} y={el.y} width={el.w} height={scene.h} opacity={opacity} transform={turn}>
            <div
              style={{
                fontFamily: el.font,
                fontSize: el.size,
                fontWeight: el.weight || 400,
                fontStyle: el.italic ? "italic" : "normal",
                color: el.fill,
                textAlign: el.align || "left",
                lineHeight: el.lineHeight || 1.16,
                letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
                whiteSpace: "pre-wrap",
              }}
            >
              {el.text}
            </div>
          </foreignObject>
        );
      })}
    </svg>
  );
}

export default TemplateThumb;
