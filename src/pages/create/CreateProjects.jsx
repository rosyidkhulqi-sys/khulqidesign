// The Projects tab of the Create editor: every saved design, newest first.
// Click one to open it; the open design is marked. Designs are kept in this
// browser for now (see projectsStore.js).
import { useState } from "react";
import Icon from "./CreateIcons";
import { timeAgo } from "./projectsStore";

// designs shown at first, and added by each "Show more"
const STEP = 8;

function ProjectsPanel({ projects, openId, onOpen, onDelete, onNew }) {
  const [shown, setShown] = useState(STEP);

  return (
    <>
      <button className="cp-upload" onClick={onNew}>
        <Icon name="plus" size={16} /> Create a new design
      </button>

      {projects.length === 0 ? (
        <p className="cp-hint">Your designs appear here once you start one.</p>
      ) : (
        <div className="cp-projects">
          {projects.slice(0, shown).map((p) => {
            const open = p.id === openId;
            return (
              <div key={p.id} className={`cp-project ${open ? "open" : ""}`}>
                <button
                  className="cp-project-main"
                  onClick={() => onOpen(p.id)}
                  aria-current={open || undefined}
                  title={open ? "Open now" : `Open ${p.name}`}
                >
                  <span className="cp-project-thumb">
                    {p.thumb ? <img src={p.thumb} alt="" /> : <span>{p.w} × {p.h}</span>}
                  </span>
                  <span className="cp-project-name">{p.name}</span>
                  <span className="cp-project-meta">
                    {open ? "Open now" : timeAgo(p.updated)}
                    {p.pages > 1 && ` · ${p.pages} pages`}
                  </span>
                </button>
                <button
                  className="cp-project-delete"
                  onClick={() => onDelete(p.id)}
                  title="Delete design"
                  aria-label={`Delete ${p.name}`}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {projects.length > shown && (
        <button className="cp-showmore" onClick={() => setShown((n) => n + STEP)}>
          Show more ({projects.length - shown})
        </button>
      )}

      <p className="cp-hint">Designs are saved in this browser.</p>
    </>
  );
}

export default ProjectsPanel;
