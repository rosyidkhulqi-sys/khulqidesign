// Saves one new row in assets, after its files are already in R2. A dropped
// connection (Safari reports it as "TypeError: Load failed") would lose the
// whole upload at the last step, so the save is tried again. If an earlier
// try did reach the database and only its answer was lost, the row is
// already there under this code: that counts as saved, not as a clash.
// Returns null when saved, else the error (as supabase gives it).
import { supabase } from "./supabaseClient";

const WAITS = [1000, 3000, 6000];

const alreadySaved = async (row) => {
  const { data } = await supabase.from("assets").select("source_name").eq("code", row.code).maybeSingle();
  return Boolean(data) && (data.source_name ?? null) === (row.source_name ?? null);
};

export async function insertAsset(row) {
  for (let attempt = 0; ; attempt++) {
    const { error } = await supabase.from("assets").insert(row);
    if (!error) return null;
    // the database answered: a real refusal, unless it's our own earlier try
    if (error.code) {
      if (error.code === "23505" && attempt > 0 && (await alreadySaved(row).catch(() => false))) return null;
      return error;
    }
    // no answer at all: the connection dropped
    if (attempt >= WAITS.length) return { ...error, message: `${error.message} while saving (check the connection and press Publish again)` };
    await new Promise((r) => setTimeout(r, WAITS[attempt]));
  }
}
