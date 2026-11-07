// Basic icons for the Create editor: the everyday symbols most designs need,
// drawn here in one line style (24 px grid, 2 px stroke, round ends). They are
// stroke-only SVG, so the editor's color picker recolors them like any icon.

const line = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1d1d1d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const basicIcons = [
  ["arrow-right", "Arrow right", '<path d="M5 12h14M13 6l6 6-6 6"/>'],
  ["arrow-left", "Arrow left", '<path d="M19 12H5M11 6l-6 6 6 6"/>'],
  ["arrow-up", "Arrow up", '<path d="M12 19V5M6 11l6-6 6 6"/>'],
  ["arrow-down", "Arrow down", '<path d="M12 5v14M6 13l6 6 6-6"/>'],
  ["check", "Check", '<path d="M5 12.5l4.5 4.5L19 7"/>'],
  ["close", "Close", '<path d="M6 6l12 12M18 6L6 18"/>'],
  ["plus", "Plus", '<path d="M12 5v14M5 12h14"/>'],
  ["star", "Star", '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'],
  ["heart", "Heart", '<path d="M12 20s-7.5-4.6-8.8-9.4C2.3 7.3 4.4 4.5 7.5 4.5c1.9 0 3.4 1 4.5 2.6 1.1-1.6 2.6-2.6 4.5-2.6 3.1 0 5.2 2.8 4.3 6.1C19.5 15.4 12 20 12 20z"/>'],
  ["home", "Home", '<path d="M3 11l9-8 9 8M5 9.5V20h14V9.5M10 20v-6h4v6"/>'],
  ["phone", "Phone", '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>'],
  ["mail", "Mail", '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>'],
  ["location", "Location", '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'],
  ["search", "Search", '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>'],
  ["user", "User", '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'],
  ["cart", "Cart", '<path d="M3 4h2l2.3 10.6a1 1 0 0 0 1 .8h9.3a1 1 0 0 0 1-.8L20.5 8H6"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>'],
  ["calendar", "Calendar", '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
  ["clock", "Clock", '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
  ["bell", "Bell", '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'],
  ["chat", "Chat", '<path d="M4 5h16v11H9l-5 4z"/>'],
  ["camera", "Camera", '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l2-3h4l2 3"/><circle cx="12" cy="13.5" r="3.5"/>'],
  ["globe", "Globe", '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-3 3.3-3 14.7 0 18M12 3c3 3.3 3 14.7 0 18"/>'],
  ["bolt", "Bolt", '<path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/>'],
  ["gift", "Gift", '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8c-1.5-4-6-4-5.5-1S12 8 12 8zm0 0c1.5-4 6-4 5.5-1S12 8 12 8z"/>'],
  ["tag", "Tag", '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'],
  ["percent", "Percent", '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>'],
  ["download", "Download", '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'],
  ["share", "Share", '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>'],
].map(([id, name, body]) => ({ id, name, svg: line(body) }));
