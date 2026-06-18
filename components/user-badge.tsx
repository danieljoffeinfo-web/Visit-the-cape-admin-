import { colorStyles } from '@/lib/user-colors'
import { theme } from '@/lib/theme'

export function UserColorDot({ color, size = 8 }: { color?: string | null; size?: number }) {
  const styles = colorStyles(color)
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: styles.hex,
        flexShrink: 0,
        boxShadow: `0 0 6px ${styles.hex}66`,
        display: 'inline-block',
      }}
    />
  )
}

export function UserColorBadge({ name, color }: { name: string; color?: string | null }) {
  const styles = colorStyles(color)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 12,
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        fontSize: 11,
        fontWeight: 600,
        color: styles.hex,
        letterSpacing: '0.02em',
      }}
    >
      <UserColorDot color={color} size={6} />
      {name}
    </span>
  )
}

export function SourceBadge({ source }: { source?: string | null }) {
  const label = source === 'website' ? 'Website' : source === 'manual' ? 'Manual' : source === 'internal' ? 'Internal' : source || 'Unknown'
  const colors =
    source === 'website'
      ? { bg: 'rgba(100,149,237,0.15)', color: '#6495ed', border: 'rgba(100,149,237,0.3)' }
      : source === 'internal'
        ? { bg: 'rgba(184,149,106,0.15)', color: '#b8956a', border: 'rgba(184,149,106,0.3)' }
        : { bg: 'rgba(76,175,132,0.15)', color: '#4caf84', border: 'rgba(76,175,132,0.3)' }

  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 10,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        background: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    >
      {label}
    </span>
  )
}

export function StatusBadge({ status }: { status?: string | null }) {
  const s = (status || 'pending').toLowerCase()
  const colors: Record<string, { bg: string; color: string }> = {
    confirmed: { bg: 'rgba(76,175,132,0.15)', color: '#4caf84' },
    paid: { bg: 'rgba(76,175,132,0.15)', color: '#4caf84' },
    pending: { bg: 'rgba(44, 38, 32, 0.08)', color: theme.textMuted },
    enquiry: { bg: 'rgba(184, 149, 106, 0.12)', color: theme.bronzeDark },
    cancelled: { bg: 'rgba(239,83,80,0.15)', color: '#ef5350' },
    authorised: { bg: 'rgba(100,149,237,0.15)', color: '#6495ed' },
  }
  const c = colors[s] || colors.pending
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', background: c.bg, color: c.color }}>
      {status || 'pending'}
    </span>
  )
}
