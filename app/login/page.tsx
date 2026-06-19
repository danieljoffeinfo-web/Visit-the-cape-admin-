import { Suspense } from 'react'
import { LoginForm } from './login-form'

const shellStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: '#f7f4ef',
} as const

const cardStyle = {
  width: '100%',
  maxWidth: 420,
  background: '#ffffff',
  border: '1px solid #e8e2d8',
  borderRadius: 12,
  padding: '40px 36px',
  boxShadow: '0 12px 40px rgba(44,38,32,0.08)',
} as const

function LoginShell({ children }: { children?: React.ReactNode }) {
  return (
    <div style={shellStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a67c52', lineHeight: 1 }}>
            Visit The Cape
          </div>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9a9088', marginTop: 6 }}>
            Admin Console
          </div>
        </div>
        {children}
        <p style={{ textAlign: 'center', fontSize: 12, color: '#9a9088', marginTop: 24, lineHeight: 1.5 }}>
          Approved staff only. Contact your administrator for access.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <LoginShell>
      <Suspense fallback={<p style={{ textAlign: 'center', color: '#9a9088', fontSize: 14 }}>Loading sign-in…</p>}>
        <LoginForm />
      </Suspense>
    </LoginShell>
  )
}
