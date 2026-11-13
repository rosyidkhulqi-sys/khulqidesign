// Upload batches on /admin: a named group per upload, such as "M 1026".
import { supabase } from "../../lib/supabaseClient";

// the batch's id, made on the server if new (an empty name means today's
// dated batch); called once per publish
export async function openBatch(type, name) {
  const { data, error } = await supabase.rpc("open_upload_batch", { p_type: type, p_name: name ?? "" });
  if (error) throw new Error(`Couldn't open the batch: ${error.message}`);
  return data;
}
