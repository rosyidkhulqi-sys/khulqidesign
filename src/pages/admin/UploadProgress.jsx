// The whole upload's progress, shared by every upload tab: in place of the
// file count while publishing, one line ("42 of 156 published · 27%") and one
// bar, as Google Drive shows a big upload. It counts the files that are
// through (published or failed) plus the bytes of those still sending, so it
// climbs smoothly instead of jumping a file at a time.

// shows the progress while a run is on, otherwise its children (the count)
function UploadProgress({ run, items, children }) {
  if (!run || run.total === 0) return children;
  const sending = items.reduce((sum, it) => sum + (it.status === "uploading" ? it.progress || 0 : 0), 0);
  const published = items.filter((it) => it.status === "done").length;
  const percent = Math.min(100, Math.round(((run.through + sending) / run.total) * 100));
  return (
    <div className="ad-overall" role="status">
      <span>{published} of {run.total} published · {percent}%</span>
      <div className="ad-progress"><span style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

export default UploadProgress;
