// A library page (/vectors, /photos...) or a main page (/pricing, /license...)
// with its own title, description and content for crawlers (see _listing.js).
import { renderListing } from "./_listing.js";

export async function GET(request) {
  const url = new URL(request.url);
  const response = await renderListing(url, url.searchParams.get("page"));
  if (response) return response;
  // not a page this function knows: the plain app
  const shell = await fetch(new URL("/index.html", url));
  return new Response(await shell.text(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
