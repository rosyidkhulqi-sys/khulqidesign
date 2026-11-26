// A library page (/vectors), a library's category (/photos/food) or a main
// page (/pricing) for search engines, link previews and crawlers that don't
// run JavaScript (Pinterest, WhatsApp, Facebook, AI crawlers): the site's
// index.html with the page's own title, description and canonical address
// written in, and inside #root a plain heading, a short text and, for a
// library, its newest assets as links with pictures. Everyone gets the same
// page (nothing hidden for robots); the app then starts and draws it in full.
import { PAGE_TYPES, SITE, assetUrl, cdn, escapeHtml, jsonLd, rest, slugify } from "./_seo.js";
import { MOCKUP_CATEGORY_OPTIONS, PHOTO_CATEGORY_OPTIONS } from "../src/data/stockCategories.js";
import { VECTOR_CATEGORY_OPTIONS, vectorCategoryStorageValues } from "../src/data/vectorCategories.js";
import { FONT_CATEGORIES } from "../src/data/fontCategories.js";

// what each page is about, in the words a search result shows
export const PAGES = {
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

// the libraries whose categories have their own address, as the app shows
// them (same ids, same labels); stored: the values a category is saved under
export const CATEGORIES = {
  photos: PHOTO_CATEGORY_OPTIONS,
  mockups: MOCKUP_CATEGORY_OPTIONS,
  vectors: VECTOR_CATEGORY_OPTIONS,
  fonts: FONT_CATEGORIES,
};
export const storedValues = (page, id) => (page === "vectors" ? vectorCategoryStorageValues(id) : [id]);
export const categoryLabel = (page, id) => CATEGORIES[page]?.find(([c]) => c === id)?.[1] ?? null;

// the other libraries, linked from every page so crawlers find them all
const LIBRARIES = ["icons", "vectors", "photos", "logos", "mockups", "footage", "fonts", "templates"];

const NEWEST = 48;

// an icon set's own address, as the app gives it (router.js setPath)
export const setUrl = (set) =>
  `${SITE}/icons/${[slugify(set.name), set.code.toLowerCase()].filter(Boolean).join("-")}`;

// An icon set's page (/icons/<words>-kd-is-<digits>): search engines list the
// sets, and each set links its icons. null when there's no such set.
export async function renderIconSet(requestUrl, code) {
  let set;
  let icons = [];
  try {
    [set] = await rest(`asset_sets?select=id,code,name,style,license,description,keywords&type=eq.icon&status=eq.published&code=eq.${encodeURIComponent(code)}`);
    if (set) {
      icons = await rest(`assets?select=code,title,keywords,thumb_key&type=eq.icon&status=eq.published&set_id=eq.${set.id}&order=published_at.desc`, { to: 499 });
    }
  } catch {
    return null;
  }
  if (!set || !icons.length) return null;

  const shellRes = await fetch(new URL("/index.html", requestUrl));
  let html = await shellRes.text();

  const canonical = setUrl(set);
  const title = `${set.name} · Icon set · Khulqidesign`;
  const words = [...new Set(icons.flatMap((i) => i.keywords ?? []))].slice(0, 12).join(", ");
  const description = set.description ||
    `${icons.length} ${set.style ? `${set.style} ` : ""}icons in one matching set, SVG and PNG${set.license === "free" ? ", free" : ""}: ${words}.`;

  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Khulqidesign", url: `${SITE}/` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: icons.length,
      itemListElement: icons.slice(0, 100).map((icon, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: assetUrl("icons", icon),
        name: icon.title,
      })),
    },
  };
  const head = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<script type="application/ld+json">${jsonLd(data)}</script>`,
  ].join("\n    ");
  const items = icons
    .map((icon) => `<li><a href="${escapeHtml(assetUrl("icons", icon))}">` +
      (icon.thumb_key ? `<img src="${escapeHtml(cdn(icon.thumb_key))}" alt="${escapeHtml(icon.title)}" loading="lazy" width="64" />` : "") +
      `${escapeHtml(icon.title)}</a></li>`)
    .join("");

  html = html
    .replace(/<title>[\s\S]*?<\/title>\s*/, "")
    .replace(/<meta\s+name="description"[\s\S]*?\/>\s*/, "")
    .replace(/<link rel="canonical"[^>]*>\s*/, "")
    .replace(/<meta property="og:(type|url|title|description)"[^>]*>\s*/g, "")
    .replace("</head>", `    ${head}\n  </head>`)
    .replace(
      '<div id="root"></div>',
      `<div id="root"><main class="seo-shell"><h1>${escapeHtml(set.name)}</h1><p>${escapeHtml(description)}</p>` +
        `<ul>${items}</ul><nav><a href="/icons">All icons</a> · <a href="/">Khulqidesign</a></nav></main></div>`,
    );
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

// the page as a Response; null for a page or category this site doesn't have
export async function renderListing(requestUrl, page, category = null) {
  const about = PAGES[page];
  const label = category ? categoryLabel(page, category) : null;
  if (!about || (category && !label)) return null;

  const shellRes = await fetch(new URL("/index.html", requestUrl));
  let html = await shellRes.text();

  const noun = about[0].toLowerCase();
  // "Food & Drink · Photos" reads right for every label ("Illustrations")
  const name = label ? `${label} · ${about[0]}` : about[0];
  const description = label ? `Browse ${label} in ${about[0]} on Khulqidesign. ${about[1]}` : about[1];
  const path = label ? `/${page}/${category}` : `/${page}`;
  const canonical = `${SITE}${path}`;
  const title = `${name} · Khulqidesign`;

  // the newest assets of the library (or category), as links to follow
  const type = PAGE_TYPES[page];
  let rows = [];
  if (type) {
    const inCategory = label ? `&category=in.(${storedValues(page, category).map(encodeURIComponent).join(",")})` : "";
    try {
      rows = await rest(
        `assets?select=code,title,license,thumb_key&type=eq.${type}&status=eq.published${inCategory}&order=published_at.desc`,
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
    // an empty category isn't worth a search result yet
    label && !rows.length ? `<meta name="robots" content="noindex" />` : "",
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
      const text = `${row.title}${row.license === "free" ? " (free)" : ""}`;
      return `<li><a href="${escapeHtml(assetUrl(page, row))}">` +
        (thumb ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(row.title)}" loading="lazy" width="240" />` : "") +
        `${escapeHtml(text)}</a></li>`;
    })
    .join("");
  // a library links its categories, so crawlers reach each of them
  const categoryLinks = !label && CATEGORIES[page]
    ? `<p>${CATEGORIES[page].map(([id, text]) => `<a href="/${page}/${id}">${escapeHtml(text)}</a>`).join(" · ")}</p>`
    : label ? `<p><a href="/${page}">All ${escapeHtml(noun)}</a></p>` : "";
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
      `<div id="root"><main class="seo-shell"><h1>${escapeHtml(name)}</h1><p>${escapeHtml(description)}</p>` +
        categoryLinks +
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
