// Library search: "coffee logo" or "red heart" should find what people mean,
// as on Freepik and Envato. The whole phrase counts first; otherwise every
// word has to match somewhere, in any order. Words that only name the page's
// own kind of asset ("logo" on Logos) are skipped.
//
// hit(term) is the page's own test for one term (title, keywords...).
export function matchesSearch(query, hit, kindWords = []) {
  const q = query.trim().toLowerCase();
  if (!q || hit(q)) return true;
  const words = q.split(/\s+/).filter((w) => !kindWords.includes(w));
  if (!words.length) return true;
  return words.every(hit);
}
