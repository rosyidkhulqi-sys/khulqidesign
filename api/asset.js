// An asset's own address (/vectors/<title-words>-<code>) for search engines
// and link previews: the site's index.html with this asset's title,
// description, picture, canonical address and structured data written in,
// plus a plain heading and picture inside #root for crawlers that don't run
// JavaScript. The app then starts as usual and opens the asset.
import { PAGE_TYPES, SITE, assetUrl, cdn, escapeHtml, jsonLd, rest } from "./_seo.js";

const KINDS = { icon: "Icon", vector: "Vector", logo: "Logo", footage: "Stock footage" };
const CODE_AT_END = /(?:^|-)(kd-[a-z]{2}-\d{5,9})$/;

// the words a search result shows under the title
function describe(row, kind) {
  if (row.description) return row.description;
  const words = (row.keywords ?? []).slice(0, 8).join(", ");
  const price = row.license === "free" ? "Free" : "Premium";
  return `${row.title}. ${price} ${kind.toLowerCase()} from Khulqidesign${words ? `: ${words}` : ""}.`;
}

// schema.org data: Google Images shows a "Licensable" label from these fields
function structured(row, page, kind, url, image) {
  const common = {
    "@context": "https://schema.org",
    name: row.title,
    description: describe(row, kind),
    url,
    keywords: (row.keywords ?? []).join(", "),
    creator: { "@type": "Organization", name: "Khulqidesign", url: `${SITE}/` },
    creditText: "Khulqidesign",
    copyrightNotice: "Khulqidesign",
    license: `${SITE}/license`,
    acquireLicensePage: `${SITE}/pricing`,
    datePublished: row.published_at,
  };
  if (page === "footage") {
    const secs = Math.round(Number(row.duration_s) || 0);
    return {
      ...common,
      "@type": "VideoObject",
      thumbnailUrl: image,
      uploadDate: row.published_at,
      contentUrl: cdn(row.preview_video_key) ?? undefined,
      duration: secs ? `PT${secs}S` : undefined,
    };
  }
  return { ...common, "@type": "ImageObject", contentUrl: image, thumbnailUrl: cdn(row.thumb_key) };
}

export async function GET(request) {
  const url = new URL(request.url);
  const page = url.searchParams.get("page");
  const slug = (url.searchParams.get("slug") || "").toLowerCase();
  const type = PAGE_TYPES[page];
  const code = slug.match(CODE_AT_END)?.[1]?.toUpperCase();

  const shellRes = await fetch(new URL("/index.html", url));
  let html = await shellRes.text();

  let row = null;
  if (type && code) {
    try {
      const fields = "code,title,description,keywords,license,thumb_key,preview_key,preview_video_key,duration_s,published_at";
      [row] = await rest(`assets?select=${fields}&type=eq.${type}&code=eq.${encodeURIComponent(code)}&status=eq.published`);
    } catch {
      row = null;
    }
  }

  if (!row) {
    // unknown or hidden asset: the app shows its library; search engines skip it
    html = html.replace("</head>", '    <meta name="robots" content="noindex" />\n  </head>');
    return new Response(html, {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=300" },
    });
  }

  const kind = KINDS[type];
  const canonical = assetUrl(page, row);
  const image = cdn(page === "icons" ? row.thumb_key : row.preview_key || row.thumb_key);
  const title = `${row.title} · ${row.license === "free" ? "Free" : "Premium"} ${kind} · Khulqidesign`;
  const description = describe(row, kind);

  const head = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="${page === "footage" ? "video.other" : "website"}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : "",
    `<script type="application/ld+json">${jsonLd(structured(row, page, kind, canonical, image))}</script>`,
  ].filter(Boolean).join("\n    ");

  // the site-wide versions of these tags make way for the asset's own
  html = html
    .replace(/<title>[\s\S]*?<\/title>\s*/, "")
    .replace(/<meta\s+name="description"[\s\S]*?\/>\s*/, "")
    .replace(/<link rel="canonical"[^>]*>\s*/, "")
    .replace(/<meta property="og:(type|url|title|description|image)"[^>]*>\s*/g, "")
    .replace("</head>", `    ${head}\n  </head>`)
    .replace(
      '<div id="root"></div>',
      `<div id="root"><main><h1>${escapeHtml(row.title)}</h1><p>${escapeHtml(description)}</p>` +
        (image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(row.title)}" />` : "") +
        `<p><a href="/${page}">More ${escapeHtml(kind.toLowerCase())}s on Khulqidesign</a></p></main></div>`,
    );

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // the CDN keeps the page an hour and refreshes it in the background
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
