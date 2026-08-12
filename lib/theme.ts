/** Visit The Cape admin — Atlantic operations palette. */
export const theme = {
  bg: '#f3f6f4',
  surface: '#ffffff',
  surfaceMuted: '#e8efec',
  border: 'rgba(18, 48, 58, 0.10)',
  borderStrong: 'rgba(18, 48, 58, 0.18)',
  text: '#12303a',
  textMuted: 'rgba(18, 48, 58, 0.64)',
  textFaint: 'rgba(18, 48, 58, 0.42)',
  bronze: '#d36b4d',
  bronzeLight: '#e59a82',
  bronzeDark: '#a84932',
  bronzeBg: 'rgba(211, 107, 77, 0.10)',
  bronzeBorder: 'rgba(211, 107, 77, 0.30)',
  success: '#557a63',
  danger: '#b5453b',
  modalOverlay: 'rgba(18, 48, 58, 0.24)',
  modalShadow: '0 20px 60px rgba(18, 48, 58, 0.16)',
  headingFont: "'Barlow Condensed', sans-serif",
  bodyFont: "'Source Sans 3', sans-serif",
  utilityFont: "'IBM Plex Mono', monospace",
} as const

export const cardStyle = {
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  borderRadius: 10,
  padding: '20px 24px',
  boxShadow: '0 1px 2px rgba(18, 48, 58, 0.04)',
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

export const dangerButton = {
  padding: '9px 14px',
  borderRadius: 6,
  background: 'rgba(196, 92, 74, 0.08)',
  color: theme.danger,
  border: `1px solid rgba(196, 92, 74, 0.25)`,
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 13,
  fontFamily: theme.bodyFont,
} as const
