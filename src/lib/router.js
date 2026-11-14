// A small router on the browser's History API: every page has its own
// address (/icons, /logos, /pricing...), Back and Forward work, and links can
// be shared or opened in a new tab. Pages still navigate with go(page, query);
// App keeps the URL in step. Unknown addresses show the 404 page.
//
// The host must send every path to index.html (public/_redirects for Netlify
// and Cloudflare Pages, vercel.json for Vercel); Vite's dev server already does.

// page key -> browser tab title
export const pageTitles = {
  home: "Khulqidesign: Icons, Vectors, Logos & Templates",
  ai: "AI tools",
  icons: "Icons",
  vectors: "Vectors",
  logos: "Logos",
  templates: "Templates",
  footage: "Footage",
  create: "Create",
  downloads: "Your downloads",
  account: "Account",
  pricing: "Pricing",
  license: "License",
  about: "About us",
  terms: "Terms of Service",
  refund: "Refund and Cancellation",
  privacy: "Privacy Policy",
  login: "Log in",
  register: "Create account",
  admin: "Admin",
  notfound: "Page not found",
};

const known = new Set(Object.keys(pageTitles).filter((p) => p !== "notfound"));

export function pathFor(page, query = "") {
  const path = page === "home" ? "/" : `/${page}`;
  return query ? `${path}?q=${encodeURIComponent(query)}` : path;
}

// Every asset has its own address: /vectors/<title-words>-<code>, e.g.
// /vectors/blue-abstract-circle-pattern-kd-vc-1329331. The words are for
// people and search engines; the code at the end is what's looked up.
export const ASSET_PAGES = { icons: "icon", vectors: "vector", logos: "logo", footage: "footage" };
const CODE_AT_END = /(?:^|-)(kd-[a-z]{2}-\d{5,9})$/;

export const slugify = (text = "") =>
  text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export const assetPath = (page, asset) =>
  `/${page}/${[slugify(asset.title ?? asset.name), asset.code.toLowerCase()].filter(Boolean).join("-")}`;

// the asset code in the address ("KD-VC-1329331"), or null
export function assetCodeOf(pathname = window.location.pathname) {
  const [page, rest, extra] = pathname.replace(/^\/+|\/+$/g, "").toLowerCase().split("/");
  if (!ASSET_PAGES[page] || !rest || extra) return null;
  const m = rest.match(CODE_AT_END);
  return m ? m[1].toUpperCase() : null;
}

// the page and search query the current address points to
export function readLocation() {
  const { pathname, search } = window.location;
  const slug = pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  const query = new URLSearchParams(search).get("q") ?? "";
  if (slug === "" || slug === "index.html") return { page: "home", query };
  // an asset address shows its library page with the asset open
  if (assetCodeOf(pathname)) return { page: slug.split("/")[0], query };
  return { page: known.has(slug) && slug !== "home" ? slug : "notfound", query };
}

// the page to come back to after logging in, kept for this tab only
const RETURN_KEY = "kd-return-to";

export function rememberReturn(page) {
  try {
    sessionStorage.setItem(RETURN_KEY, page);
  } catch {
    /* storage unavailable: the visitor lands on Home instead */
  }
}

// clear it: the visitor went somewhere else instead of logging in
export function forgetReturn() {
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* storage unavailable: nothing was kept */
  }
}

// the remembered page, or null; take = also forget it
export function returnPage(take = false) {
  try {
    const page = sessionStorage.getItem(RETURN_KEY);
    if (take) sessionStorage.removeItem(RETURN_KEY);
    return known.has(page) ? page : null;
  } catch {
    return null;
  }
}

// where Google sends the visitor back to after signing in
export const returnUrl = () => window.location.origin + pathFor(returnPage() ?? "home");

export function titleFor(page) {
  return page === "home" ? pageTitles.home : `${pageTitles[page] ?? pageTitles.notfound} · Khulqidesign`;
}

// pages that are personal or for the owner: kept out of search results
const PRIVATE_PAGES = new Set(["admin", "account", "downloads", "login", "register", "notfound"]);

// the canonical address (always without www) and whether search engines may
// list the page; called whenever the page changes
// path: an asset's own address, when one is open
export function updateHeadFor(page, path = page === "home" ? "/" : `/${page}`) {
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = `https://khulqidesign.com${path}`;

  let robots = document.querySelector('meta[name="robots"]');
  if (PRIVATE_PAGES.has(page)) {
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = "noindex";
  } else if (robots) {
    robots.remove();
  }
}

// an open asset names the tab and the canonical address; closing it restores
// the library page's
const KINDS = { icons: "Icon", vectors: "Vector", logos: "Logo", footage: "Stock footage" };
export function assetHead(page, asset) {
  if (!asset) {
    document.title = titleFor(page);
    updateHeadFor(page);
    return;
  }
  document.title = `${asset.title ?? asset.name} · ${KINDS[page] ?? pageTitles[page]} · Khulqidesign`;
  updateHeadFor(page, assetPath(page, asset));
}
