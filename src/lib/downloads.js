// Download history kept in this browser; later it moves to the account backend.
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
