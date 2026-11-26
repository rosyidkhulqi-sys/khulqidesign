// A library page (/vectors, /photos...) or a main page (/pricing, /license...)
// for search engines, link previews and crawlers that don't run JavaScript
// (Pinterest, WhatsApp, Facebook, AI crawlers): the site's index.html with the
// page's own title, description and canonical address written in, and inside
// #root a plain heading, a short text and, for a library, its newest assets
// as links with pictures. The app then starts as usual and draws the page.
import { PAGE_TYPES, SITE, assetUrl, cdn, escapeHtml, jsonLd, rest } from "./_seo.js";

// what each page is about, in the words a search result shows
const PAGES = {
  assets: ["Design assets", "Icons, vectors, photos, logos, mockups, footage and fonts in one place. Download them, or edit them in your browser with Create."],
  icons: ["Icons", "Icon sets in SVG and PNG that match in style. Change their colors in the browser and download, free or Premium."],
  vectors: ["Vectors", "Vector illustrations, backgrounds and graphics in EPS with a high-resolution JPG, for print and screen."],
  photos: ["Photos", "Stock photos and illustrations in JPG and PNG, some cut out on transparent backgrounds, for websites, social media and print."],
  logos: ["Logos", "Ready-made logo designs to customize, from free logos to exclusive ones sold to a single buyer."],
  footage: ["Stock footage", "Video clips in MP4 for edits, ads and social media, with a preview before you download."],
  mockups: ["Mockups", "Layered PSD mockups for devices, print, packaging and branding: drop in your design and show it."],
  fonts: ["Fonts", "Original typefaces made by Khulqidesign, bought one by one with a desktop, web, app or extended license."],
  templates: ["Templates", "Editable templates for social media posts, flyers, posters and more, opened straight in Create."],
  create: ["Create", "A simple design editor in the browser: templates, elements, photos and AI tools, then download as PNG, JPG, PDF or SVG."],
  pricing: ["Pricing", "Start free with 10 downloads a day. Premium unlocks the Premium library and Create's Premium features, monthly or yearly."],
  license: ["License", "What you can do with Khulqidesign assets: personal and commercial use, attribution for free assets, and what isn't allowed."],
  about: ["About", "Khulqidesign is a design asset library and editor for designers and institutions, built around a typographic, Swiss-inspired style."],
};

// the other libraries, linked from every page so crawlers find them all
const LIBRARIES = ["icons", "vectors", "photos", "logos", "mockups", "footage", "fonts", "templates"];

const NEWEST = 48;

export async function GET(request) {
  const url = new URL(request.url);
  const page = url.searchParams.get("page");
  const about = PAGES[page];

  const shellRes = await fetch(new URL("/index.html", url));
  let html = await shellRes.text();
  if (!about) return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });

  const [name, description] = about;
  const canonical = `${SITE}/${page}`;
  const title = `${name} · Khulqidesign`;

  // a library's newest assets, as links a crawler can follow
  const type = PAGE_TYPES[page];
  let rows = [];
  if (type) {
    try {
      rows = await rest(
        `assets?select=code,title,license,thumb_key&type=eq.${type}&status=eq.published&order=published_at.desc`,
        { to: NEWEST - 1 },
      );
    } catch {
      rows = [];
    }
  }
  const image = rows.length ? cdn(rows[0].thumb_key) : `${SITE}/preview1.jpg`;

  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Khulqidesign", url: `${SITE}/` },
    ...(rows.length
      ? {
          mainEntity: {
            "@type": "ItemList",
            itemListElement: rows.map((row, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: assetUrl(page, row),
              name: row.title,
              image: cdn(row.thumb_key) ?? undefined,
            })),
          },
        }
      : {}),
  };

  const head = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : "",
    `<script type="application/ld+json">${jsonLd(data)}</script>`,
  ].filter(Boolean).join("\n    ");

  const items = rows
    .map((row) => {
      const thumb = cdn(row.thumb_key);
      const label = `${row.title}${row.license === "free" ? " (free)" : ""}`;
      return `<li><a href="${escapeHtml(assetUrl(page, row))}">` +
        (thumb ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(row.title)}" loading="lazy" width="240" />` : "") +
        `${escapeHtml(label)}</a></li>`;
    })
    .join("");
  const nav = LIBRARIES.filter((p) => p !== page)
    .map((p) => `<a href="/${p}">${escapeHtml(PAGES[p][0])}</a>`)
    .join(" · ");

  // the site-wide versions of these tags make way for the page's own
  html = html
    .replace(/<title>[\s\S]*?<\/title>\s*/, "")
    .replace(/<meta\s+name="description"[\s\S]*?\/>\s*/, "")
    .replace(/<link rel="canonical"[^>]*>\s*/, "")
    .replace(/<meta property="og:(type|url|title|description|image)"[^>]*>\s*/g, "")
    .replace("</head>", `    ${head}\n  </head>`)
    .replace(
      '<div id="root"></div>',
      `<div id="root"><main><h1>${escapeHtml(name)}</h1><p>${escapeHtml(description)}</p>` +
        (items ? `<ul>${items}</ul>` : "") +
        `<nav><a href="/">Khulqidesign</a> · ${nav} · <a href="/pricing">Pricing</a></nav></main></div>`,
    );

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // the CDN keeps the page an hour and refreshes it in the background
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
