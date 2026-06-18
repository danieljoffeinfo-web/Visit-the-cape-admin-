/** Visit The Cape admin — off-white shell with bronze accents */
export const theme = {
  bg: '#f7f4ef',
  surface: '#ffffff',
  surfaceMuted: '#f0ebe3',
  border: 'rgba(44, 38, 32, 0.10)',
  borderStrong: 'rgba(44, 38, 32, 0.16)',
  text: '#2c2620',
  textMuted: 'rgba(44, 38, 32, 0.55)',
  textFaint: 'rgba(44, 38, 32, 0.38)',
  bronze: '#b8956a',
  bronzeLight: '#d4b896',
  bronzeDark: '#8a6e4a',
  bronzeBg: 'rgba(184, 149, 106, 0.12)',
  bronzeBorder: 'rgba(184, 149, 106, 0.28)',
  success: '#3d8b63',
  danger: '#c45c4a',
  headingFont: "'Barlow Condensed', sans-serif",
  bodyFont: "'Barlow', sans-serif",
} as const

export const cardStyle = {
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  borderRadius: 10,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(44, 38, 32, 0.04)',
} as const

export const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  border: `1px solid ${theme.border}`,
  background: theme.surface,
  color: theme.text,
  fontSize: 14,
  fontFamily: theme.bodyFont,
  boxSizing: 'border-box' as const,
  outline: 'none',
}

export const primaryButton = {
  padding: '10px 18px',
  borderRadius: 6,
  background: theme.bronze,
  color: '#ffffff',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 14,
  fontFamily: theme.bodyFont,
} as const

export const secondaryButton = {
  padding: '9px 16px',
  borderRadius: 6,
  background: theme.surface,
  color: theme.bronzeDark,
  border: `1px solid ${theme.bronzeBorder}`,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
  fontFamily: theme.bodyFont,
} as const

export const pageTitle = {
  fontFamily: theme.headingFont,
  fontWeight: 900,
  fontSize: 28,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  color: theme.text,
  margin: 0,
}

export const sectionTitle = {
  fontFamily: theme.headingFont,
  fontWeight: 800,
  fontSize: 18,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  color: theme.text,
}

export const fieldLabel = {
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: theme.textMuted,
}
