// Hand-drawn 24×24 stroke icons. Decorative: every caller pairs them with text,
// so they are always aria-hidden. Colour comes from `currentColor`.

const PATHS = {
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />,
  replay: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v4h4" />
    </>
  ),
  arrow: <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cross: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  dash: <path d="M6 12h12" />,
  chevron: <path d="M9.5 6l6 6-6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  share: (
    <>
      <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" />
      <path d="M5 13v5.5h14V13" />
    </>
  ),
  /** The aperture motif, small: a dot inside two arcs. Used as the "fact" glyph. */
  aperture: (
    <>
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <path d="M8.2 8.2a5.4 5.4 0 0 1 7.6 0M15.8 15.8a5.4 5.4 0 0 1-7.6 0" />
      <path d="M5.1 5.1a9.8 9.8 0 0 1 13.8 0M18.9 18.9a9.8 9.8 0 0 1-13.8 0" opacity=".55" />
    </>
  ),
  warn: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
