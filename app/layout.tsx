import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'DFT Admin',
  description: 'DF Travel Admin Console',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@300;400;500&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "'Barlow', sans-serif", background: '#f7f4ef', color: '#2c2620', minHeight: '100vh' }}>
        {children}
        <Toaster theme="light" richColors />
      </body>
    </html>
  )
}
