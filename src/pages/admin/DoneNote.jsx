// After publishing, the published cards leave the list and this note stays,
// as on The Noun Project: nothing to clear by hand. Failed files stay below.
function DoneNote({ finished, noun, onClose }) {
  if (!finished?.published) return null;
  const { published, failed, where } = finished;
  return (
    <div className={`ad-done ${failed ? "has-failed" : ""}`} role="status">
      <span className="ad-done-check" aria-hidden="true">✓</span>
      <div>
        <strong>Done · {published} {published === 1 ? noun[0] : noun[1]} published</strong>
        <span>
          {where ? `In ${where}. ` : ""}
          {failed ? `${failed} failed: they stay below, press Publish to try them again.` : "They're on the site now."}
        </span>
      </div>
      <button onClick={onClose} aria-label="Close">×</button>
    </div>
  );
}

export default DoneNote;
