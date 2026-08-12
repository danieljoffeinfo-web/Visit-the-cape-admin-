import type { Metadata } from 'next'

/**
 * The preview is public so it can be handed to someone without an account,
 * but it has no reason to be found by anyone who was not given the link — it
 * carries the company's branding and the shape of its operations. Search
 * engines are asked to leave it alone; that is not access control, and it does
 * not decide whether the route should be public at all.
 */
export const metadata: Metadata = {
  title: 'Visit The Cape — admin preview (demo data)',
  robots: { index: false, follow: false },
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children
}
