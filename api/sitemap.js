// /sitemap.xml: the site's public pages and every published asset's own
// address, read fresh from the catalog (cached on the CDN for a few hours),
// so a new upload is listed without a new deploy.
import { PAGE_TYPES, SITE, assetUrl, escapeHtml, rest } from "./_seo.js";
import { CATEGORIES, setUrl, storedValues } from "./_listing.js";

const PAGES = ["", "assets", "icons", "vectors", "photos", "logos", "templates", "mockups", "footage", "fonts", "create", "ai", "pricing", "license", "about", "refund", "terms", "privacy"];
const MAX = 45000; // one sitemap holds 50,000 addresses; split before that

export async function GET() {
  const urls = PAGES.map((p) => `  <url><loc>${SITE}/${p}</loc></url>`);
  const typeToPage = Object.fromEntries(Object.entries(PAGE_TYPES).map(([page, type]) => [type, page]));
  // icons are listed by their sets (each set page links its icons), as one
  // set page says more than dozens of near-alike single-icon pages
  const types = Object.values(PAGE_TYPES).filter((t) => t !== "icon").join(",");
  try {
    const sets = await rest("asset_sets?select=id,code,name&type=eq.icon&status=eq.published");
    const used = await rest("assets?select=set_id&type=eq.icon&status=eq.published&set_id=not.is.null", { to: 49999 });
    const withIcons = new Set(used.map((r) => r.set_id));
    for (const set of sets) if (withIcons.has(set.id)) urls.push(`  <url><loc>${escapeHtml(setUrl(set))}</loc></url>`);
  } catch {
    /* the sets wait for the next read */
  }

  // each category that holds at least one asset has its own page
  const checks = Object.entries(CATEGORIES).flatMap(([page, options]) =>
    options.map(async ([id]) => {
      try {
        const values = storedValues(page, id).map(encodeURIComponent).join(",");
        const [row] = await rest(`assets?select=code&type=eq.${PAGE_TYPES[page]}&status=eq.published&category=in.(${values})&limit=1`);
        return row ? `  <url><loc>${SITE}/${page}/${id}</loc></url>` : null;
      } catch {
        return null;
      }
    }),
  );
  urls.push(...(await Promise.all(checks)).filter(Boolean));

  for (let from = 0; urls.length < MAX; from += 1000) {
    let rows;
    try {
      rows = await rest(
        `assets?select=type,code,title,updated_at&type=in.(${types})&status=eq.published&order=published_at.desc`,
        { from, to: from + 999 },
      );
    } catch {
      break;
    }
    for (const row of rows) {
      const lastmod = row.updated_at ? `<lastmod>${row.updated_at.slice(0, 10)}</lastmod>` : "";
      urls.push(`  <url><loc>${escapeHtml(assetUrl(typeToPage[row.type], row))}</loc>${lastmod}</url>`);
    }
    if (rows.length < 1000) break;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
