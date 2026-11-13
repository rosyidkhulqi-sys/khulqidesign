// One line-icon set for the Create editor, so every button shares the same
// size and stroke instead of mixing text symbols.
const paths = {
  templates: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
  elements: <><circle cx="7.5" cy="7.5" r="4" /><rect x="13" y="13" width="8" height="8" rx="1" /><path d="M17 3l4 7h-8z" /></>,
  background: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 15L15 3M3 21L21 3M9 21L21 9" /></>,
  text: <path d="M5 7V4h14v3M12 4v16M9 20h6" />,
  icons: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z" />,
  vectors: <><path d="M12 19l7-7 3 3-7 7z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z" /><path d="M2 2l7.6 7.6" /><circle cx="11" cy="11" r="2" /></>,
  footage: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M10 9l5 3-5 3z" /></>,
  ai: <><path d="M11 3.5l1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6-4.6-1.7 4.6-1.7z" /><path d="M18 14.5l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z" /></>,
  projects: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  uploads: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  redo: <><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.9M6.3 6.3A16.7 16.7 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.9-1.3" /><path d="M3 3l18 18" /></>,
  crop: <path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  pages: <><rect x="2" y="6" width="6" height="12" rx="1.5" /><rect x="9" y="6" width="6" height="12" rx="1.5" /><rect x="16" y="6" width="6" height="12" rx="1.5" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h9" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  unlock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></>,
  front: <path d="M5 3h14M12 21V8M6 13l6-6 6 6" />,
  forward: <path d="M12 20V5M6 11l6-6 6 6" />,
  backward: <path d="M12 4v15M6 13l6 6 6-6" />,
  back: <path d="M5 21h14M12 3v13M6 11l6 6 6-6" />,
  flipH: <><path d="M12 3v18" /><path d="M8 7l-5 5 5 5z" /><path d="M16 7l5 5-5 5z" /></>,
  flipV: <><path d="M3 12h18" /><path d="M7 8l5-5 5 5z" /><path d="M7 16l5 5 5-5z" /></>,
  group: <><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /><path d="M3 15v4a2 2 0 0 0 2 2h4M21 9V5a2 2 0 0 0-2-2h-4" /></>,
  ungroup: <><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></>,
  download: <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  maximize: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  minimize: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  cloud: <path d="M7 18.5h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.6 1.6A3.5 3.5 0 0 0 7 18.5z" />,
  cloudCheck: <><path d="M7 18.5h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.6 1.6A3.5 3.5 0 0 0 7 18.5z" /><path d="M9.5 14l2 2 3.5-3.5" /></>,
  alignLeft: <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />,
  alignCenter: <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />,
  alignRight: <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />,
};

function Icon({ name, size = 18 }) {
  return (
    <svg
      className="ci"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export default Icon;
