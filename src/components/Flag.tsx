// A country flag as a bundled SVG image rather than emoji text: desktop emoji
// fonts (Segoe UI Emoji on Windows) have no flag glyphs and show letters.
// Decorative: every caller pairs it with the language name.
import type { LangCode } from '../data/languages.ts'
import { flagSrc } from '../data/flags.ts'

interface Props {
  code: LangCode
  className?: string
}

export function Flag({ code, className }: Props) {
  return (
    <img
      className={className ? `flag ${className}` : 'flag'}
      src={flagSrc(code)}
      alt=""
      aria-hidden="true"
      width={20}
      height={15}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  )
}
