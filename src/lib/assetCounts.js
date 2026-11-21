// How many published assets each library has, straight from the database
// (asset_counts()), so Home's numbers grow by themselves with every upload.
// Kept for the visit in sessionStorage, so going back to Home doesn't wait.
import { supabase } from "./supabaseClient";

const KEY = "kd-asset-counts";

export async function fetchAssetCounts() {
  try {
    const kept = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (kept && Date.now() - kept.at < 10 * 60 * 1000) return kept.counts;
  } catch { /* no storage: ask the database */ }
  const { data, error } = await supabase.rpc("asset_counts");
  if (error) throw error;
  const counts = Object.fromEntries((data ?? []).map((row) => [row.type, Number(row.n)]));
  try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), counts })); } catch { /* fine */ }
  return counts;
}

// a count as stock sites write it: exact below 1,000, then rounded down
// with a plus (1.2K+, 27K+), so the number never claims more than there is
export function formatCount(n) {
  if (n < 1000) return n.toLocaleString("en-US");
  if (n < 10000) return `${Math.floor(n / 100) / 10}K+`;
  return `${Math.floor(n / 1000)}K+`;
}
