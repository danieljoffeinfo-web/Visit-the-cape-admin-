'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

type Enquiry = {
  id: string
  name: string
  email: string
  phone?: string
  tour_type?: string
  message?: string
  date?: string
  passengers?: number
  created_at: string
}

export function EnquiriesPanel() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('enquiries').select('*').order('created_at', { ascending: false }).limit(100).then(({ data }) => {
      setEnquiries((data || []) as Enquiry[])
      setLoading(false)
    })
  }, [])

  const card = { background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '20px 24px' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Enquiries</h1>
        <div style={{ fontSize: 13, color: 'rgba(240,236,228,0.5)' }}>{enquiries.length} total</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {loading && <div style={{ color: 'rgba(240,236,228,0.4)', padding: 24 }}>Loading...</div>}
        {!loading && enquiries.length === 0 && <div style={{ color: 'rgba(240,236,228,0.4)', padding: 24 }}>No enquiries yet</div>}
        {enquiries.map(e => (
          <div key={e.id} style={{ ...card, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{e.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(240,236,228,0.4)' }}>{format(new Date(e.created_at), 'd MMM yyyy')}</div>
            </div>
            {e.tour_type && (
              <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, background: 'rgba(184,149,106,0.15)', color: '#b8956a', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                {e.tour_type}
              </div>
            )}
            {e.message && (
              <div style={{ fontSize: 13, color: 'rgba(240,236,228,0.65)', lineHeight: 1.5, marginBottom: 10 }}>{e.message}</div>
            )}
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'rgba(240,236,228,0.45)' }}>
              <span>{e.email}</span>
              {e.phone && <span>{e.phone}</span>}
              {e.passengers && <span>{e.passengers} pax</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
