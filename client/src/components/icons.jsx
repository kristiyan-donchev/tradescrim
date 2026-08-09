// A single hand-drawn icon set replacing every emoji in the app — one
// consistent visual language (24x24, rounded stroke, currentColor) instead of
// whatever emoji art the OS happens to render, and one that actually takes
// the app's color tokens (--muted/--primary/--green/--red) like every other
// themed element already does.
const ICON_PATHS = {
  'bar-chart': (
    <>
      <line x1="5" y1="20" x2="5" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="19" y1="20" x2="19" y2="14" />
    </>
  ),
  newspaper: (
    <>
      <rect x="3" y="5" width="14" height="15" rx="1.5" />
      <path d="M17 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7" />
      <line x1="7" y1="9" x2="13" y2="9" />
      <line x1="7" y1="13" x2="13" y2="13" />
      <line x1="7" y1="16" x2="11" y2="16" />
    </>
  ),
  'graduation-cap': (
    <>
      <path d="M2 9l10-5 10 5-10 5-10-5z" />
      <path d="M6 11.5V17c0 1.5 2.5 3 6 3s6-1.5 6-3v-5.5" />
      <path d="M22 9v6" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.2c2.3.4 4.5 2.2 4.5 5.8" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4" />
      <path d="M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4" />
      <line x1="12" y1="13" x2="12" y2="17" />
      <path d="M8 21h8" />
      <path d="M10 17h4l1 4H9l1-4z" />
    </>
  ),
  'trending-up': (
    <>
      <polyline points="3,17 9,11 13,15 21,6" />
      <polyline points="15,6 21,6 21,12" />
    </>
  ),
  'help-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.2 9a2.8 2.8 0 1 1 4.4 2.3c-.9.7-1.6 1.2-1.6 2.5" />
      <line x1="12" y1="17" x2="12" y2="17.1" />
    </>
  ),
  bug: (
    <>
      <rect x="8" y="8" width="8" height="10" rx="4" />
      <line x1="12" y1="4" x2="12" y2="8" />
      <line x1="9" y1="5.5" x2="10.3" y2="7.5" />
      <line x1="15" y1="5.5" x2="13.7" y2="7.5" />
      <line x1="4" y1="11" x2="8" y2="11" />
      <line x1="16" y1="11" x2="20" y2="11" />
      <line x1="4" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="20" y2="16" />
      <line x1="6" y1="20" x2="9" y2="17.5" />
      <line x1="18" y1="20" x2="15" y2="17.5" />
    </>
  ),
  x: (
    <>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </>
  ),
  check: <polyline points="4,13 9,18 20,6" />,
  'x-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </>
  ),
  star: (
    <polygon points="12,3 14.8,9.2 21.5,9.9 16.6,14.4 18,21 12,17.6 6,21 7.4,14.4 2.5,9.9 9.2,9.2" />
  ),
  bell: (
    <>
      <path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
      <line x1="12" y1="19.5" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4.5" y2="12" />
      <line x1="19.5" y1="12" x2="22" y2="12" />
      <line x1="4.9" y1="4.9" x2="6.6" y2="6.6" />
      <line x1="17.4" y1="17.4" x2="19.1" y2="19.1" />
      <line x1="4.9" y1="19.1" x2="6.6" y2="17.4" />
      <line x1="17.4" y1="6.6" x2="19.1" y2="4.9" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <line x1="8" y1="20" x2="16" y2="20" />
      <line x1="12" y1="16" x2="12" y2="20" />
    </>
  ),
  'arrow-left': (
    <>
      <line x1="20" y1="12" x2="5" y2="12" />
      <polyline points="10,6 4,12 10,18" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
      <path d="M5 14l.6 1.7L7.3 16l-1.7.6L5 18.3l-.6-1.7L2.7 16l1.7-.6L5 14z" />
    </>
  ),
  zap: <polygon points="13,2 4,14 11,14 10,22 20,9 13,9" />,
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3c2.8 2.6 4.3 5.7 4.3 9s-1.5 6.4-4.3 9c-2.8-2.6-4.3-5.7-4.3-9s1.5-6.4 4.3-9z" />
    </>
  ),
  coins: (
    <>
      <circle cx="9" cy="10" r="6.5" />
      <path d="M13 5.5a6.5 6.5 0 1 1 0 12.9" />
    </>
  ),
  'dollar-sign': (
    <>
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 6.5c0-1.9-2.2-3-5-3s-5 1.2-5 3 2.2 2.7 5 3 5 1.4 5 3-2.2 3-5 3-5-1.1-5-3" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="8" r="5" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <path d="M9 12.5L7 21l5-2.8L17 21l-2-8.5" />
    </>
  ),
  sprout: (
    <>
      <path d="M7 20c0-6 3-9 3-9" />
      <path d="M10 11c-4 0-6-2-6-6 4 0 6 2 6 6z" />
      <path d="M10 11c4 0 6-3 6-7-4 0-6 2-6 7z" />
    </>
  ),
  swords: (
    <>
      <line x1="4" y1="4" x2="20" y2="20" />
      <polyline points="14,20 20,20 20,14" />
      <line x1="20" y1="4" x2="4" y2="20" />
      <polyline points="10,20 4,20 4,14" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="14" r="6" />
      <circle cx="12" cy="14" r="2.5" />
      <path d="M9 8.5L7 3" />
      <path d="M15 8.5L17 3" />
    </>
  ),
  repeat: (
    <>
      <polyline points="17,1 21,5 17,9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7,23 3,19 7,15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  crown: (
    <>
      <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z" />
      <line x1="5" y1="21" x2="19" y2="21" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 2c3 2 5 6 5 10 0 2-1 4-1 4H8s-1-2-1-4c0-4 2-8 5-10z" />
      <circle cx="12" cy="10" r="1.8" />
      <path d="M8 16l-3 3 1-4" />
      <path d="M16 16l3 3-1-4" />
      <path d="M10 19l2 3 2-3" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3z" />
      <line x1="8.5" y1="8" x2="15.5" y2="8" />
      <line x1="8.5" y1="12" x2="15.5" y2="12" />
    </>
  ),
  sliders: (
    <>
      <line x1="5" y1="4" x2="5" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="19" y1="4" x2="19" y2="20" />
      <circle cx="5" cy="9" r="2" />
      <circle cx="12" cy="15" r="2" />
      <circle cx="19" cy="7" r="2" />
    </>
  ),
  scale: (
    <>
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="6" y1="6" x2="18" y2="6" />
      <path d="M4 6l-2.5 6a2.8 2.8 0 0 0 5 0L4 6z" />
      <path d="M20 6l-2.5 6a2.8 2.8 0 0 0 5 0L20 6z" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </>
  ),
  brain: (
    <>
      <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.5A3 3 0 0 0 7 18a3 3 0 0 0 5-2V6a2 2 0 0 0-3-2z" />
      <path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.5A3 3 0 0 1 17 18a3 3 0 0 1-5-2V6a2 2 0 0 1 3-2z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  'book-open': (
    <>
      <path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z" />
      <line x1="12" y1="6" x2="12" y2="20" />
    </>
  ),
  brain: (
    <>
      <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5.5 3 3 0 0 0 3 2.5V4z" />
      <path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5.5 3 3 0 0 1-3 2.5V4z" />
    </>
  ),
  flame: (
    <path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c1 1 1.5 2.5 1.5 4a4.5 4.5 0 0 1-9 0C7.5 9 10 6 12 2z" />
  ),
  joystick: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M12 11v6" />
      <path d="M6 21c0-2.5 2.5-4 6-4s6 1.5 6 4" />
    </>
  ),
};

export function Icon({ name, size = 16, filled = false, className = '', ...rest }) {
  const path = ICON_PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`}
      aria-hidden="true"
      {...rest}
    >
      {path}
    </svg>
  );
}
