// Download history kept in this browser; uploaded assets are also recorded
// in the account (the downloads table) by requestDownload below.
export function saveDownload(entry) {
  try {
    const list = JSON.parse(localStorage.getItem("kd-downloads") || "[]");
    localStorage.setItem(
      "kd-downloads",
      JSON.stringify([entry, ...list].slice(0, 100))
    );
  } catch {
    /* storage unavailable */
  }
}

// Saves a file made in the browser (an edited icon, for example).
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// What the site says when a download is refused; the codes come from
// record_download() in the database, through the r2-sign function.
export const DOWNLOAD_REFUSALS = {
  sign_in_required: {
    title: "Log in to download",
    text: "A free account takes 10 assets a day.",
  },
  premium_required: {
    title: "This file is part of Premium",
    text: "Premium files come with a subscription: every format, commercial use, no attribution.",
  },
  purchase_required: {
    title: "This logo is exclusive",
    text: "An exclusive logo is sold once; only its buyer can download the files.",
  },
  daily_limit: {
    title: "You've reached today's limit",
    text: "Free accounts take 10 assets a day (it resets at midnight UTC). Premium has no daily cap for normal use.",
  },
};

// Downloads an uploaded original: the server checks the license, plan and
// daily limit, records the download, and hands back a link valid for five
// minutes. Resolves { license } or throws an Error whose .code is one of
// DOWNLOAD_REFUSALS (or something unexpected).
export async function requestDownload(assetId, format) {
  const { supabase } = await import("./supabaseClient");
  const { data, error } = await supabase.functions.invoke("r2-sign", {
    body: { action: "download", asset: assetId, format },
  });
  if (error) {
    let message = error.message;
    try {
      message = (await error.context.json()).error ?? message;
    } catch {
      /* not a JSON body */
    }
    const code = message?.startsWith("sign in first") ? "sign_in_required" : message;
    const e = new Error(DOWNLOAD_REFUSALS[code]?.title ?? message);
    e.code = code;
    throw e;
  }
  const a = document.createElement("a");
  a.href = data.url;
  a.download = data.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return data;
}
