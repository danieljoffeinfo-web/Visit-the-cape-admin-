'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { SelectMenu } from '@/components/ui/select-menu'
import { UserColorBadge } from '@/components/user-badge'
import type { AdminUser } from '@/lib/auth-types'
import styles from './demo.module.css'

type Panel =
  | 'dashboard' | 'bookings' | 'calendar' | 'enquiries'
  | 'experiences' | 'fleet' | 'accounting' | 'clients' | 'settings'
  | 'activity-logs'

const demoUser: AdminUser = {
  id: 'demo',
  auth_user_id: 'demo',
  full_name: 'Tanya Price',
  email: 'demo@visitthecape.co.za',
  role: 'staff',
  color: 'Green',
  is_approved: true,
  created_at: '2026-08-12T00:00:00.000Z',
  updated_at: '2026-08-12T00:00:00.000Z',
}

const titles: Record<Panel, string> = {
  dashboard: 'Home',
  bookings: 'Bookings',
  calendar: 'Calendar',
  enquiries: 'Messages',
  experiences: 'Experiences',
  fleet: 'Vehicles',
  accounting: 'Money',
  clients: 'Clients',
  settings: 'Connections',
  'activity-logs': 'Activity history',
}

const sampleBookings = [
  ['Fleet', 'VTC-1048', 'Gavin Reid', 'Mercedes Sprinter', '19 Nov 2026', 'R 5 000'],
  ['Tour', 'VTC-1047', 'Amina Patel', 'Cape Peninsula Private Tour', '22 Aug 2026', 'R 8 400'],
  ['Experience', 'VTC-1046', 'Luca Meyer', 'Ocean Water Biking', '18 Aug 2026', 'R 3 200'],
]

export default function DemoPage() {
  const [panel, setPanel] = useState<Panel>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="admin-shell">
      <button
        type="button"
        className={`admin-sidebar-backdrop${mobileOpen ? ' admin-sidebar-backdrop--visible' : ''}`}
        aria-label="Close menu"
        onClick={() => setMobileOpen(false)}
      />
      <Sidebar
        active={panel}
        onChange={setPanel}
        admin={demoUser}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="admin-main">
        <header className="admin-header">
          <button type="button" className="admin-header__menu" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
            <span aria-hidden>☰</span>
          </button>
          <div className="admin-header__title">{titles[panel]}</div>
          <div className="admin-header__meta">
            <span className="user-color-badge"><UserColorBadge name={demoUser.full_name} color={demoUser.color} /></span>
            <span className={styles.demoPill}>Demo data</span>
          </div>
        </header>
        <main className="admin-content">
          {panel === 'dashboard' ? <HomeDemo onChange={setPanel} /> : null}
          {panel === 'bookings' ? <BookingsDemo /> : null}
          {panel === 'accounting' ? <MoneyDemo /> : null}
          {!['dashboard', 'bookings', 'accounting'].includes(panel) ? <SectionDemo panel={panel} /> : null}
        </main>
      </div>
    </div>
  )
}

function HomeDemo({ onChange }: { onChange: (panel: Panel) => void }) {
  const today = new Intl.DateTimeFormat('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  return (
    <div className={styles.dashboard}>
      <section className={styles.briefing}>
        <div>
          <div className={styles.eyebrow}>Daily briefing</div>
          <h1>Good day, Tanya.</h1>
          <p>Here is what needs your attention today.</p>
        </div>
        <div className={styles.date}>{today}</div>
      </section>

      <div className={styles.attentionGrid}>
        <button className={styles.attentionCard} onClick={() => onChange('enquiries')}>
          <span>Messages to answer</span><strong>3</strong><small>Open the inbox and reply</small>
        </button>
        <button className={styles.attentionCard} onClick={() => onChange('accounting')}>
          <span>Payments outstanding</span><strong>R 24 750</strong><small>Invoices still waiting for payment</small>
        </button>
      </div>

      <div className={styles.mainGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeading}><h2>Next 7 days</h2><button onClick={() => onChange('bookings')}>New tour booking</button></div>
          <Schedule time="08:30" title="Cape Peninsula Private Tour" detail="Amina Patel · Hyundai Staria Black · 4 guests" />
          <Schedule time="10:00" title="Winelands Day Tour" detail="Jordan Smith · Mercedes Sprinter · 12 guests" />
          <Schedule time="14:15" title="Ocean Water Biking" detail="Luca Meyer · Simon’s Town · 2 guests" />
        </section>
        <section className={styles.card}>
          <div className={styles.cardHeading}><h2>New messages</h2><span className={styles.count}>3 new</span></div>
          <Message name="Amina Patel" subject="Airport collection time" time="18 min ago" />
          <Message name="Jordan Smith" subject="Dietary requirements" time="1 hr ago" />
          <Message name="Luca Meyer" subject="Experience availability" time="2 hrs ago" />
        </section>
      </div>

      <div className={styles.healthGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeading}><h2>Booking revenue</h2><b>R 34 600</b></div>
          <div className={styles.barChart} aria-label="Seven day revenue chart">
            {[32, 54, 22, 78, 46, 92, 62].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
          </div>
        </section>
        <section className={styles.card}>
          <div className={styles.cardHeading}><h2>Vehicles today</h2><span>5 available</span></div>
          <Fleet name="Mercedes Sprinter" status="On tour until 17:00" busy />
          <Fleet name="Hyundai Staria Black" status="Available" />
          <Fleet name="Toyota Quantum 2" status="Available" />
        </section>
      </div>

      <section className={styles.card}>
        <h2 className={styles.startTitle}>Start something</h2>
        <div className={styles.actionGrid}>
          <Action label="New tour booking" text="Add a customer to a scheduled or private tour" onClick={() => onChange('bookings')} />
          <Action label="Book a vehicle" text="Check availability before confirming a vehicle" onClick={() => onChange('fleet')} />
          <Action label="Book an experience" text="Add an activity for a customer" onClick={() => onChange('experiences')} />
        </div>
      </section>
    </div>
  )
}

function BookingsDemo() {
  const [statuses, setStatuses] = useState<Array<'pending' | 'paid' | 'cancelled'>>(['paid', 'pending', 'cancelled'])
  return (
    <div>
      <div className={styles.pageHeading}><div><h1>Bookings</h1><p>Every confirmed tour, vehicle and experience in one place.</p></div><button>New booking</button></div>
      <div className={styles.tabs}><b>All</b><span>Tours</span><span>Experiences</span><span>Internal</span><span>Website</span></div>
      <section className={styles.card}>
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{['Type','Reference','Customer','Tour / vehicle','Date','Amount','Payment',''].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{sampleBookings.map((row, rowIndex) => <tr key={row[1]}>{row.map((value) => <td key={value}>{value}</td>)}<td><SelectMenu compact ariaLabel={`Payment status for ${row[2]}`} value={statuses[rowIndex]} onChange={(value) => setStatuses((current) => current.map((status, index) => index === rowIndex ? value as 'pending' | 'paid' | 'cancelled' : status))} options={[{ value: 'pending', label: 'Pending' }, { value: 'paid', label: 'Paid' }, { value: 'cancelled', label: 'Cancelled' }]} /></td><td><button className={styles.openButton}>Open booking</button><button className={styles.moreButton} aria-label="More actions">•••</button></td></tr>)}</tbody>
        </table></div>
      </section>
    </div>
  )
}

function MoneyDemo() {
  return (
    <div>
      <div className={styles.pageHeading}><div><h1>Money</h1><p>Xero is the official record for invoices and payments. See what has been paid and what still needs to be collected.</p></div><span className={styles.connected}>● Xero connected</span></div>
      <div className={styles.tabs}><b>Invoices &amp; payments</b><span>Business reports</span></div>
      <div className={styles.moneyGrid}><Metric label="Paid invoices" value="R 89 600" /><Metric label="Waiting for payment" value="R 24 750" /><Metric label="Recent payments" value="R 12 400" /><Metric label="Overdue" value="R 5 750" danger /></div>
      <section className={styles.card}>
        <div className={styles.cardHeading}><h2>Invoices</h2><div className={styles.filters}><b>All</b><span>Paid</span><span>Waiting</span><span>Overdue</span></div></div>
        <p className={styles.helper}>Create customer invoices from a booking so each invoice stays linked to the correct service.</p>
        <table className={styles.table}><thead><tr><th>Customer</th><th>Invoice</th><th>Amount</th><th>Due date</th><th>Status</th></tr></thead><tbody>
          <tr><td>Amina Patel</td><td>INV-1048</td><td>R 8 400</td><td>26 Aug 2026</td><td><span className={styles.waiting}>Waiting for payment</span></td></tr>
          <tr><td>Jordan Smith</td><td>INV-1047</td><td>R 10 600</td><td>20 Aug 2026</td><td><span className={styles.waiting}>Waiting for payment</span></td></tr>
          <tr><td>Luca Meyer</td><td>INV-1046</td><td>R 5 750</td><td>8 Aug 2026</td><td><span className={styles.overdue}>Overdue</span></td></tr>
        </tbody></table>
      </section>
    </div>
  )
}

function SectionDemo({ panel }: { panel: Panel }) {
  const copy: Partial<Record<Panel, string>> = {
    calendar: 'See every tour, vehicle and experience by date.',
    enquiries: 'Read and reply to customer messages from the website.',
    fleet: 'Check vehicle availability and create a fleet booking.',
    experiences: 'Book an extra activity for a customer.',
    clients: 'Find repeat customers and update their details.',
  }
  return <div><div className={styles.pageHeading}><div><h1>{titles[panel]}</h1><p>{copy[panel] || 'This section is available in the signed-in admin.'}</p></div></div><section className={`${styles.card} ${styles.placeholder}`}><span>Demo section</span><h2>{titles[panel]} keeps the same clear, task-first layout.</h2><p>The public preview contains fake data only. No customer, booking or Xero information is loaded here.</p></section></div>
}

function Schedule({ time, title, detail }: { time: string; title: string; detail: string }) { return <div className={styles.schedule}><time>{time}</time><div><b>{title}</b><span>{detail}</span></div></div> }
function Message({ name, subject, time }: { name: string; subject: string; time: string }) { return <div className={styles.message}><i /><div><b>{name}</b><span>{subject}</span></div><time>{time}</time></div> }
function Fleet({ name, status, busy }: { name: string; status: string; busy?: boolean }) { return <div className={styles.fleet}><i className={busy ? styles.busy : ''} /><b>{name}</b><span>{status}</span></div> }
function Action({ label, text, onClick }: { label: string; text: string; onClick: () => void }) { return <button className={styles.action} onClick={onClick}><b>{label}</b><span>{text}</span></button> }
function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) { return <div className={styles.metric}><span>{label}</span><strong className={danger ? styles.danger : ''}>{value}</strong></div> }
