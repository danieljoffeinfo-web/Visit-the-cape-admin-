export type UserColor = 'Bronze' | 'Blue' | 'Green' | 'Purple' | 'Red'

export const USER_COLOR_MAP: Record<UserColor, { hex: string; bg: string; border: string }> = {
  Bronze: { hex: '#b8956a', bg: 'rgba(184,149,106,0.15)', border: 'rgba(184,149,106,0.35)' },
  Blue: { hex: '#6495ed', bg: 'rgba(100,149,237,0.15)', border: 'rgba(100,149,237,0.35)' },
  Green: { hex: '#4caf84', bg: 'rgba(76,175,132,0.15)', border: 'rgba(76,175,132,0.35)' },
  Purple: { hex: '#8e6ad8', bg: 'rgba(142,106,216,0.15)', border: 'rgba(142,106,216,0.35)' },
  Red: { hex: '#ef5350', bg: 'rgba(239,83,80,0.15)', border: 'rgba(239,83,80,0.35)' },
}

export function colorStyles(color?: string | null) {
  const key = (color || 'Bronze') as UserColor
  return USER_COLOR_MAP[key] || USER_COLOR_MAP.Bronze
}
