// Renders a template scene as a scalable SVG preview, using the same element
// data that Create loads, so the thumbnail always matches the editable design.
function TemplateThumb({ scene }) {
  return (
    <svg
      viewBox={`0 0 ${scene.w} ${scene.h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      <rect width={scene.w} height={scene.h} fill={scene.bg} />
      {scene.elements.map((el, i) => {
        if (el.type === "rect") {
          return <rect key={i} x={el.x} y={el.y} width={el.w} height={el.h} rx={el.r || 0} fill={el.fill} />;
        }
        if (el.type === "circle") {
          return <circle key={i} cx={el.x + el.r} cy={el.y + el.r} r={el.r} fill={el.fill} />;
        }
        if (el.type === "image") {
          return (
            <image key={i} href={el.src} x={el.x} y={el.y} width={el.w} height={el.h}
                   preserveAspectRatio="xMidYMid slice" />
          );
        }
        return (
          <foreignObject key={i} x={el.x} y={el.y} width={el.w} height={scene.h}>
            <div
              style={{
                fontFamily: el.font,
                fontSize: el.size,
                fontWeight: el.weight || 400,
                color: el.fill,
                textAlign: el.align || "left",
                lineHeight: 1.16,
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
