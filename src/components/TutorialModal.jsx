// A tutorial video in a window over the tool, as Magnific shows its Academy
// videos: the player, then the title, length and a link to the channel.
// youtube-nocookie.com sets no tracking cookies until the viewer presses
// play, and the player only loads once the window is open.
import { useEffect } from "react";
import { YOUTUBE_CHANNEL } from "../data/tutorials";
import "./TutorialModal.css";

function TutorialModal({ tutorial, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="tm-overlay" onClick={onClose}>
      <button className="tm-close" onClick={onClose} aria-label="Close tutorial">×</button>
      <div className="tm" role="dialog" aria-modal="true" aria-label={tutorial.title} onClick={(e) => e.stopPropagation()}>
        <div className="tm-player">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${tutorial.id}?autoplay=1&rel=0&modestbranding=1`}
            title={tutorial.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
        <div className="tm-foot">
          <div>
            <strong>{tutorial.title}</strong>
            <span className="tm-time">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
              </svg>
              {tutorial.duration}
            </span>
          </div>
          <a className="tm-more" href={YOUTUBE_CHANNEL} target="_blank" rel="noopener noreferrer">
            More tutorials <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export default TutorialModal;
