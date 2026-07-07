import type { Theme } from '@glideapps/glide-data-grid'

export const GLIDE_COLORS = {
  primary: '#0e8ed6',
  primarySoft: '#e0f2fe',
  ink: '#060f1c',
  inkMuted: '#4e5561',
  inkHeader: '#303643',
  canvas: '#ffffff',
  gridHeader: '#f2f4f7',
  gridHeaderHover: '#e7ebf1',
  gridRowAlt: '#eef2f7',
  gridRowAltStrong: '#e7edf4',
  surfaceSoft: '#f9fafb',
  warningSoft: '#fff7e6',
  borderSoft: '#e5e7eb',
} as const

/** Glide Data Grid theme matching the app's tokens. */
export const GLIDE_THEME: Partial<Theme> = {
  accentColor: GLIDE_COLORS.primary,
  accentLight: GLIDE_COLORS.primarySoft,
  textDark: GLIDE_COLORS.ink,
  textMedium: GLIDE_COLORS.inkMuted,
  textHeader: GLIDE_COLORS.inkHeader,
  bgCell: GLIDE_COLORS.canvas,
  bgHeader: GLIDE_COLORS.gridHeader,
  bgHeaderHovered: GLIDE_COLORS.gridHeaderHover,
  bgHeaderHasFocus: GLIDE_COLORS.gridHeaderHover,
  borderColor: GLIDE_COLORS.borderSoft,
  fontFamily: 'Inter, system-ui, sans-serif',
  baseFontStyle: '13px',
  headerFontStyle: '600 12px',
}
