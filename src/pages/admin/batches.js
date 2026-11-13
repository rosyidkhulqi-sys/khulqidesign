// Upload batches on /admin: a named group per upload, such as "M 1026".
import { supabase } from "../../lib/supabaseClient";
import { deleteFromR2 } from "../../lib/r2";

// the batch's id, made on the server if new (an empty name means today's
// dated batch); called once per publish
export async function openBatch(type, name) {
  const { data, error } = await supabase.rpc("open_upload_batch", { p_type: type, p_name: name ?? "" });
  if (error) throw new Error(`Couldn't open the batch: ${error.message}`);
  return data;
}

// every stored file of an asset, as [bucket, key]
function filesOf(row, type) {
  const files = [
    // templates and Create elements are read by the editor, so they're public
    ...(row.files ?? []).map((f) => [f.bucket ?? (type === "template" ? "public" : "private"), f.key]),
    ["public", row.thumb_key],
    ["public", row.preview_key],
    ["public", row.preview_video_key],
  ].filter(([, key]) => key);
  return [...new Map(files.map((f) => [f.join("/"), f])).values()];
}

// Deletes one asset and its files. An asset someone has downloaded is hidden
// instead, so their license stays valid. Returns "deleted" or "hidden".
export async function deleteAsset(row, type) {
  const { error } = await supabase.from("assets").delete().eq("id", row.id);
  if (error) {
    if (error.code !== "23503") throw new Error(error.message);
    const { error: hideError } = await supabase.from("assets").update({ status: "hidden" }).eq("id", row.id);
    if (hideError) throw new Error(hideError.message);
    return "hidden";
  }
  await Promise.allSettled(filesOf(row, type).map(([bucket, key]) => deleteFromR2(bucket, key)));
  return "deleted";
}

export async function batchOverview(type) {
  const { data, error } = await supabase.rpc("batch_overview", { p_type: type });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setBatchStatus(batchId, status) {
  const { error } = await supabase.from("assets").update({ status }).eq("batch_id", batchId);
  if (error) throw new Error(error.message);
}

export async function renameBatch(batchId, name) {
  const { error } = await supabase.from("upload_batches").update({ name: name.trim() }).eq("id", batchId);
  if (error) throw new Error(error.code === "23505" ? "Another batch already has that name." : error.message);
}

// Empties a batch, a page of assets at a time; onProgress(done, total).
// The batch itself goes once nothing is left in it.
export async function deleteBatch(batchId, type, onProgress) {
  const { count } = await supabase.from("assets").select("id", { count: "exact", head: true }).eq("batch_id", batchId);
  const total = count ?? 0;
  let done = 0;
  let kept = 0;
  // walk the batch in id order, so rows kept (hidden) aren't read twice
  let after = null;
  for (;;) {
    let query = supabase
      .from("assets")
      .select("id, files, thumb_key, preview_key, preview_video_key")
      .eq("batch_id", batchId)
      .order("id", { ascending: true })
      .limit(100);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) {
      if ((await deleteAsset(row, type)) === "hidden") kept += 1;
      done += 1;
      onProgress?.(done, total);
    }
    after = data[data.length - 1].id;
  }
  if (kept === 0) await supabase.from("upload_batches").delete().eq("id", batchId);
  return { deleted: done - kept, kept };
}
