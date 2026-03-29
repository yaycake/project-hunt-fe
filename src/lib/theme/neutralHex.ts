/**
 * Hex fallbacks for team color math (`teamColorUtils`) when parsing fails or for
 * neutral UI derived from zinc — **not** user-chosen team hues.
 * Aligns with Tailwind zinc-100 / 500 / 600 / 700 approximations; change here only.
 */
export const NEUTRAL_HEX = {
  zinc100: '#f4f4f5',
  zinc500: '#71717a',
  zinc600: '#52525b',
  zinc700: '#3f3f46',
} as const
