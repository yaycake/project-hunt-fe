import type { CSSProperties } from 'react'

function parseRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '').trim()
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return null
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  }
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Lighter tint (toward white) — top of team card gradient. */
function tintLighter(hex: string, towardWhite: number): string {
  const rgb = parseRgb(hex)
  if (!rgb) return '#f4f4f5'
  const t = towardWhite
  return toHex(
    rgb.r + (255 - rgb.r) * t,
    rgb.g + (255 - rgb.g) * t,
    rgb.b + (255 - rgb.b) * t,
  )
}

/** Darker shade (toward black) — bottom of team card gradient. */
function shadeDarker(hex: string, towardBlack: number): string {
  const rgb = parseRgb(hex)
  if (!rgb) return '#3f3f46'
  const t = towardBlack
  return toHex(rgb.r * (1 - t), rgb.g * (1 - t), rgb.b * (1 - t))
}

/** Full-saturation hex for gradient mid-stop (maximum chroma). */
function canonicalHex(hex: string): string | null {
  const rgb = parseRgb(hex)
  if (!rgb) return null
  return toHex(rgb.r, rgb.g, rgb.b)
}

/**
 * Linear gradient for team card body: lighter tint on top, full team color in the band,
 * deep shade at bottom — less white/black mixing than before so it stays vivid, not muddy.
 */
export function teamCardBackgroundStyle(teamColorHex: string): CSSProperties {
  const mid = canonicalHex(teamColorHex) ?? '#71717a'
  // Less dilution with white/black keeps saturation up; mid-stop adds a punch of pure hue.
  const top = tintLighter(teamColorHex, 0.26)
  const bottom = shadeDarker(teamColorHex, 0.52)
  return {
    background: `linear-gradient(to bottom, ${top} 0%, ${mid} 38%, ${bottom} 100%)`,
  }
}

/**
 * Tailwind text class for readable labels on saturated team color fills (pills, MY TEAM chip).
 */
export function contrastTextClass(bgHex: string): string {
  const h = bgHex.replace('#', '').trim()
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return 'text-white'
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.62 ? 'text-zinc-900' : 'text-white'
}
