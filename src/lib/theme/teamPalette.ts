/**
 * Selectable team / accent colors (product data). Stored on teams as hex strings.
 * Not the same as app theme tokens in `index.css` — those are brand + semantic UI.
 */
export const TEAM_COLORS = [
  { id: 'sky', label: 'Sky', hex: '#11F4F7' },
  { id: 'red', label: 'Red', hex: '#EF4444' },
  { id: 'orange', label: 'Orange', hex: '#FF6200' },
  { id: 'yellow', label: 'Yellow', hex: '#FFD000' },
  { id: 'green', label: 'Green', hex: '#C2E812' },
  { id: 'teal', label: 'Teal', hex: '#01F181' },
  { id: 'blue', label: 'Blue', hex: '#263CFF' },
  { id: 'purple', label: 'Purple', hex: '#6320EE' },
  { id: 'pink', label: 'Pink', hex: '#DC0490' },
] as const
