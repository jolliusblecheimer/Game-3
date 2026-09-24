// Hand-drawn SVG icon set (24×24). Colour icons for game things,
// single-colour (currentColor) icons for interface actions.
const O = '#2b2118'; // ink outline

const ICONS = {
  wheat: `<path d="M12 22.5V7" stroke="#7a5a1c" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <g fill="#e6b84a" stroke="#7a5a1c" stroke-width=".8">
      <ellipse cx="12" cy="4.4" rx="1.7" ry="2.7"/>
      <ellipse cx="9.5" cy="8.2" rx="1.5" ry="2.6" transform="rotate(-38 9.5 8.2)"/><ellipse cx="14.5" cy="8.2" rx="1.5" ry="2.6" transform="rotate(38 14.5 8.2)"/>
      <ellipse cx="9.5" cy="12.4" rx="1.5" ry="2.6" transform="rotate(-38 9.5 12.4)"/><ellipse cx="14.5" cy="12.4" rx="1.5" ry="2.6" transform="rotate(38 14.5 12.4)"/>
      <ellipse cx="9.8" cy="16.5" rx="1.4" ry="2.4" transform="rotate(-38 9.8 16.5)"/><ellipse cx="14.2" cy="16.5" rx="1.4" ry="2.4" transform="rotate(38 14.2 16.5)"/>
    </g>`,
  wood: `<g stroke="${O}" stroke-width="1.1">
      <circle cx="7.5" cy="16" r="4.6" fill="#c99a62"/><circle cx="16.5" cy="16" r="4.6" fill="#c3925a"/><circle cx="12" cy="8.2" r="4.6" fill="#cfa46c"/>
    </g>
    <g fill="none" stroke="#8a5b33" stroke-width=".9"><circle cx="7.5" cy="16" r="2.2"/><circle cx="16.5" cy="16" r="2.2"/><circle cx="12" cy="8.2" r="2.2"/></g>
    <g fill="#8a5b33"><circle cx="7.5" cy="16" r=".7"/><circle cx="16.5" cy="16" r=".7"/><circle cx="12" cy="8.2" r=".7"/></g>`,
  stone: `<path d="M2.5 20.5l1.5-7 6-2 4 2 .5 7z" fill="#8f8a80" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M11 13.5l2.5-8 6.5-1.5 2 5-1 11.5-5.5 0z" fill="#a9a497" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M14 7l5-1M4.6 14.6l4.8-1.6" stroke="#d6d1c4" stroke-width="1" fill="none" stroke-linecap="round"/>`,
  gold: `<ellipse cx="12" cy="12" rx="7.6" ry="10" fill="#e6b84a" stroke="#7d5a10" stroke-width="1.2"/>
    <ellipse cx="12" cy="12" rx="5.6" ry="7.8" fill="none" stroke="#b98a24" stroke-width=".8"/>
    <path d="M7.5 8.5h9M7 12h10M7.5 15.5h9" stroke="#b98a24" stroke-width=".9"/>
    <rect x="10" y="5" width="4" height="3" rx=".6" fill="#c9922a" stroke="#7d5a10" stroke-width=".6"/><rect x="10" y="16.2" width="4" height="3" rx=".6" fill="#c9922a" stroke="#7d5a10" stroke-width=".6"/>`,
  people: `<g stroke="${O}" stroke-width="1" stroke-linejoin="round">
      <path d="M1.8 21.5c.4-4 2-6 4.6-6s4.2 2 4.6 6z" fill="#7b6a8e"/><circle cx="6.4" cy="11.6" r="2.6" fill="#f1d2b0"/>
      <path d="M11.5 21.5c.5-5 2.6-7.5 5.8-7.5s5.3 2.5 5.8 7.5z" fill="#5f7392"/><circle cx="17.3" cy="9.7" r="3" fill="#e8c29c"/>
      <path d="M12.6 8.4l4.7-3.2 4.7 3.2z" fill="#d2b06a"/>
    </g>`,
  soldier: `<path d="M4 15.5c0-5 3.6-8.6 8-8.6s8 3.6 8 8.6z" fill="#3a3f4a" stroke="${O}" stroke-width="1.1"/>
    <path d="M2.5 15.2h19l-2 4.2H4.5z" fill="#23262d" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M12 7.5L7 1.8M12 7.5l5-5.7" stroke="#e0b04a" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="12" cy="10.5" r="1.8" fill="#b8392a" stroke="${O}" stroke-width=".7"/>`,
  sakura: `<g fill="#f6bccb" stroke="#c0607a" stroke-width=".9" stroke-linejoin="round">
      ${[0, 72, 144, 216, 288].map(a => `<path d="M12 12c-2.6-2.4-3.2-5.8-1.4-8.3l1.4 1.2 1.4-1.2c1.8 2.5 1.2 5.9-1.4 8.3z" transform="rotate(${a} 12 12)"/>`).join('')}
    </g><circle cx="12" cy="12" r="1.8" fill="#e0587a"/>`,
  sun: `<g stroke="#c47f12" stroke-width="1.6" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M12 2.3v2.6" transform="rotate(${a} 12 12)"/>`).join('')}</g>
    <circle cx="12" cy="12" r="5.2" fill="#f3b43d" stroke="#c47f12" stroke-width="1.1"/>`,
  moon: `<path d="M15.5 3.2a9 9 0 1 0 5.3 13.2A7.2 7.2 0 0 1 15.5 3.2z" fill="#ece6c6" stroke="#8d8662" stroke-width="1.1"/>
    <circle cx="10" cy="14" r="1.3" fill="#d6cfa8"/><circle cx="13.5" cy="17.5" r=".9" fill="#d6cfa8"/>`,
  house: `<path d="M3 11.5L12 4l9 7.5" fill="#c9a764" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M1.5 12.5L12 4.2l10.5 8.3-2.2.4L12 6.8l-8.3 6.1z" fill="#b8955a" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/>
    <rect x="5.5" y="12" width="13" height="8.5" fill="#efe7d6" stroke="${O}" stroke-width="1.1"/><rect x="10" y="14.5" width="4" height="6" fill="#5a3a28"/>`,
  storage: `<rect x="4" y="9" width="16" height="12" fill="#efe7d6" stroke="${O}" stroke-width="1.1"/><rect x="4" y="15.5" width="16" height="5.5" fill="#34363b" stroke="${O}" stroke-width="1.1"/>
    <path d="M2 9.5L12 3l10 6.5z" fill="#3a414d" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/><rect x="10" y="12" width="4" height="9" fill="#5a3a28" stroke="${O}" stroke-width=".8"/>
    <path d="M4 18h16M8 15.5v5.5M16 15.5v5.5" stroke="#d6d0c2" stroke-width=".6"/>`,
  worker: `<circle cx="10" cy="6" r="3" fill="#f1d2b0" stroke="${O}" stroke-width="1"/><path d="M5.5 4.8L10 1.8l4.5 3z" fill="#d2b06a" stroke="${O}" stroke-width=".9" stroke-linejoin="round"/>
    <path d="M4.5 21.5c.3-6 2.4-9.5 5.5-9.5s5.2 3.5 5.5 9.5z" fill="#8a6c41" stroke="${O}" stroke-width="1"/>
    <path d="M14 12l7-7" stroke="#6b4a2e" stroke-width="1.6" stroke-linecap="round"/><path d="M19 3.5l3.5 3.5-2 1-2.5-2.5z" fill="#9aa0a6" stroke="${O}" stroke-width=".8"/>`,
  katana: `<path d="M4 20L18.5 5.5c1.2-1.2 2.6-1.8 3.2-1.2.6.6 0 2-1.2 3.2L6 22z" fill="#dfe3e8" stroke="${O}" stroke-width="1"/>
    <path d="M3.2 17.6l3.2 3.2" stroke="#caa04a" stroke-width="2.2" stroke-linecap="round"/><path d="M1.8 22.2l2.6-2.6" stroke="#2a2320" stroke-width="2.4" stroke-linecap="round"/>`,
  tower: `<path d="M5 22l1.6-7h10.8l1.6 7z" fill="#8e897e" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/>
    <rect x="7" y="9" width="10" height="6" fill="#efe7d6" stroke="${O}" stroke-width="1.1"/><path d="M10.5 11h3" stroke="${O}" stroke-width="1.4"/>
    <path d="M3.5 9.5L12 3.5l8.5 6z" fill="#3a414d" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/>`,
  torii: `<path d="M2 5.5c3 1 17 1 20 0l-.6 2.2c-3 .8-15.8.8-18.8 0z" fill="#23252a" stroke="${O}" stroke-width=".8"/>
    <rect x="3.6" y="8.2" width="16.8" height="2" fill="#c2412d" stroke="${O}" stroke-width=".8"/><rect x="5.5" y="7.5" width="2.2" height="15" fill="#c2412d" stroke="${O}" stroke-width=".8"/>
    <rect x="16.3" y="7.5" width="2.2" height="15" fill="#c2412d" stroke="${O}" stroke-width=".8"/><rect x="11" y="10" width="2" height="2.6" fill="#c2412d"/>`,
  road: `<path d="M8 22L10.5 2h3L16 22z" fill="#a8906c" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M12 4.5v3M12 10.5v3.5M12 17v3.5" stroke="#efe3c8" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M3 22l3.5-9M21 22l-3.5-9" stroke="#79a24e" stroke-width="1.6" stroke-linecap="round"/>`,
  hourglass: `<path d="M6 2.5h12M6 21.5h12" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M7.5 3c0 5 4.5 6 4.5 9s-4.5 4-4.5 9h9c0-5-4.5-6-4.5-9s4.5-4 4.5-9z" fill="#f2e6c8" stroke="${O}" stroke-width="1.1"/>
    <path d="M9.2 20c.6-2.4 2.8-3 2.8-4.2 0 1.2 2.2 1.8 2.8 4.2z" fill="#d7a64a"/>`,
  grid: `<rect x="3" y="3" width="18" height="18" rx="1.5" fill="#e9dfc8" stroke="${O}" stroke-width="1.1"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke="${O}" stroke-width=".9"/>`,
  wall: `<path d="M1.5 21l1.4-7h18.2l1.4 7z" fill="#8e897e" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/><rect x="3.5" y="8.5" width="17" height="5.5" fill="#efe7d6" stroke="${O}" stroke-width="1.1"/>
    <path d="M1.8 9L4 5.5h16L22.2 9z" fill="#3a414d" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/><path d="M8 11h2M14 11h2" stroke="${O}" stroke-width="1.3"/>`,
  map: `<path d="M2.5 5.5l6-2.5 7 2.5 6-2.5v15.5l-6 2.5-7-2.5-6 2.5z" fill="#efe3c4" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M8.5 3v15.5M15.5 5.5V21" stroke="${O}" stroke-width=".9"/><path d="M4.5 14c2-2 3-1 5-3s4-1 5.5-3 3-1 4.5-2" stroke="#6fa6c9" stroke-width="1.2" fill="none"/>
    <path d="M11.5 16l1.5-3 1.5 3z" fill="#6d685f"/><circle cx="6" cy="8.5" r="1.4" fill="#b8392a"/>`,
  scout: `<circle cx="12" cy="5.5" r="2.8" fill="#e8c29c" stroke="${O}" stroke-width="1"/><path d="M7.2 5l4.8-3.4L16.8 5z" fill="#c9a764" stroke="${O}" stroke-width=".9" stroke-linejoin="round"/>
    <path d="M7 21.5l2-8.5h6l2 8.5" fill="#56603f" stroke="${O}" stroke-width="1" stroke-linejoin="round"/><path d="M15.5 13l4 -3" stroke="#6b4a2e" stroke-width="1.6" stroke-linecap="round"/>`,
  flag: `<path d="M5 22V3" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/><path d="M5.5 3.5h13l-3 4 3 4h-13z" fill="#b8392a" stroke="${O}" stroke-width="1" stroke-linejoin="round"/><circle cx="11" cy="7.5" r="1.8" fill="#f4ecdb"/>`,
  castle: `<path d="M3 22l1.5-6h15l1.5 6z" fill="#8e897e" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/><rect x="6" y="11" width="12" height="5" fill="#efe7d6" stroke="${O}" stroke-width="1"/>
    <path d="M3.5 11.5L12 7l8.5 4.5z" fill="#3a414d" stroke="${O}" stroke-width="1" stroke-linejoin="round"/><rect x="8.5" y="4.5" width="7" height="3" fill="#efe7d6" stroke="${O}" stroke-width=".9"/><path d="M6.5 5L12 1.5 17.5 5z" fill="#3a414d" stroke="${O}" stroke-width=".9" stroke-linejoin="round"/>`,
  camp: `<path d="M2 21L12 5l10 16z" fill="#b8955a" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/><path d="M12 21l-3-6h6z" fill="#3b2619"/><path d="M12 5V2" stroke="${O}" stroke-width="1.2"/><path d="M12 2l4 1.2-4 1.2z" fill="#6b4a2e"/>`,
  village2: `<path d="M1.5 14L7 9l5.5 5" fill="#b8955a" stroke="${O}" stroke-width="1" stroke-linejoin="round"/><rect x="3" y="13.5" width="8" height="6" fill="#efe7d6" stroke="${O}" stroke-width="1"/>
    <path d="M11 12L16.5 7l5.5 5" fill="#b8955a" stroke="${O}" stroke-width="1" stroke-linejoin="round"/><rect x="12.5" y="11.5" width="8" height="8" fill="#efe7d6" stroke="${O}" stroke-width="1"/><path d="M1 21.5h22" stroke="#79a24e" stroke-width="1.6"/>`,
  sword: `<path d="M5 19L18 6" stroke="#dfe3e8" stroke-width="2.6" stroke-linecap="round"/><path d="M5 19L18 6" stroke="${O}" stroke-width=".7"/><path d="M4 15.5l4.5 4.5" stroke="#caa04a" stroke-width="2" stroke-linecap="round"/><path d="M2.5 21.5l2.5-2.5" stroke="#2a2320" stroke-width="2.4" stroke-linecap="round"/>`,
  ram: `<rect x="3" y="10" width="17" height="4.5" rx="2" fill="#7a5438" stroke="${O}" stroke-width="1"/><path d="M20 10.5l2.5 1.7-2.5 1.8z" fill="#6f7378" stroke="${O}" stroke-width=".8"/>
    <path d="M5 10l3-5h7l3 5" fill="none" stroke="${O}" stroke-width="1.3"/><circle cx="6.5" cy="18" r="2.4" fill="#4a3222" stroke="${O}" stroke-width="1"/><circle cx="16.5" cy="18" r="2.4" fill="#4a3222" stroke="${O}" stroke-width="1"/>`,
  // interface (single colour)
  move: `<path d="M12 2.5v19M2.5 12h19M12 2.5l-3 3M12 2.5l3 3M12 21.5l-3-3M12 21.5l3-3M2.5 12l3-3M2.5 12l3 3M21.5 12l-3-3M21.5 12l-3 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  demolish: `<path d="M14.5 3.5l6 6-2.4 2.4-6-6z" fill="currentColor"/><path d="M13.4 8.6L3.5 18.5l2 2 9.9-9.9" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  eye: `<path d="M1.8 12s3.8-6.5 10.2-6.5S22.2 12 22.2 12s-3.8 6.5-10.2 6.5S1.8 12 1.8 12z" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>`,
  rotate: `<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M20.5 3.5v5h-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  close: `<path d="M5.5 5.5l13 13M18.5 5.5l-13 13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
  sound: `<path d="M3.5 9.5h4l5-4v13l-5-4h-4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/>`,
  muted: `<path d="M3.5 9.5h4l5-4v13l-5-4h-4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  menu: `<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
  info: `<circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 11v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="7.4" r="1.4" fill="currentColor"/>`,
  up: `<path d="M5 15l7-7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  down: `<path d="M5 9l7 7 7-7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  stop: `<rect x="5" y="5" width="14" height="14" rx="2.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9 12h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
  build: `<path d="M3 21h18M5 21V11l7-6 7 6v10" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linejoin="round"/><path d="M10 21v-5h4v5" stroke="currentColor" stroke-width="1.9" fill="none"/>`,
  copy: `<rect x="8" y="8" width="12" height="13" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M5 16V5a2 2 0 0 1 2-2h9" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
};
// category & resource aliases
ICONS.village = ICONS.house; ICONS.resources = ICONS.wheat; ICONS.military = ICONS.katana; ICONS.defense = ICONS.tower; ICONS.beauty = ICONS.torii;

export function icon(name, size = 18, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'icon ' + cls);
  s.innerHTML = ICONS[name] || '';
  return s;
}
