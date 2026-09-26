const paths = {
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  eye: <><path d="M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.2"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  edit: <><path d="m4 20 4.2-1 9.9-9.9-3.2-3.2L5 15.8 4 20Z"/><path d="m13.8 6.2 3.2 3.2"/></>,
  trash: <><path d="M4 7h16"/><path d="M10 11v5M14 11v5"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/></>,
  heart: <path d="M20.8 8.9c0 5-8.8 10.6-8.8 10.6S3.2 13.9 3.2 8.9A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.7Z"/>,
  check: <><path d="m5 12 4 4 10-10"/></>,
  close: <><path d="M6 6l12 12M18 6 6 18"/></>,
  chevron: <path d="m8 10 4 4 4-4"/>,
  filter: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
  sort: <><path d="M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3"/></>,
  grid: <><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></>,
  home: <><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></>,
  list: <><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,
  chart: <><path d="M5 20V10M12 20V4M19 20v-7"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.5 1.5-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.1v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.5-1.5.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H5.3v-2.1h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.5-1.5.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5h2.1v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.5 1.5-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2.1h-.2a1.7 1.7 0 0 0-1.6 1Z"/></>,
  logout: <><path d="M9 5H5v14h4M13 8l4 4-4 4M17 12H8"/></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  play: <path d="m9 6 9 6-9 6V6Z"/>,
  back: <><path d="M19 12H5M11 18l-6-6 6-6"/></>,
  clapperboard: <><path d="M4 7h16v13H4z"/><path d="M4 7h16l-2-4H2z"/><path d="M7 3l2 4M13 3l2 4M19 3l-2 4"/><path d="M8 11h8M8 15h5"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.7-4L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.7 4L20 15"/><path d="M20 20v-5h-5"/></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16"/></>,
  award: <><circle cx="12" cy="8.5" r="4.2"/><path d="m9.8 12.2-1.4 8 3.6-2.1 3.6 2.1-1.4-8"/></>,
}

export function Icon({ name, size = 18, strokeWidth = 1.8, className = '' }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.grid}
    </svg>
  )
}
