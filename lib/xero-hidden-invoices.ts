import { supabaseAdmin } from '@/lib/supabase-admin'
import type { AdminUser } from '@/lib/auth-types'

/**
 * Invoices an admin has removed from the Accounting list.
 *
 * Hiding is a display filter only — the invoice is never voided, deleted, or
 * otherwise altered in Xero, so the books stay intact and a hide is reversible.
 */

const SETUP_HINT = 'Run supabase/xero_hidden_invoices.sql in the admin Supabase SQL editor.'

function isMissingTable(message?: string | null) {
  const text = (message || '').toLowerCase()
  return text.includes('xero_hidden_invoices') || text.includes('does not exist')
}

export type HiddenInvoice = {
  xero_invoice_id: string
  invoice_number: string | null
  contact_name: string | null
  hidden_by_name: string | null
  created_at: string
}

export type HiddenInvoicesResult = {
  ids: Set<string>
  rows: HiddenInvoice[]
  setupRequired: boolean
}

export async function listHiddenInvoices(): Promise<HiddenInvoicesResult> {
  const { data, error } = await supabaseAdmin
    .from('xero_hidden_invoices')
    .select('xero_invoice_id,invoice_number,contact_name,hidden_by_name,created_at')
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingTable(error.message)) {
      return { ids: new Set(), rows: [], setupRequired: true }
    }
    throw error
  }

  const rows = (data || []) as HiddenInvoice[]
  return { ids: new Set(rows.map((row) => row.xero_invoice_id)), rows, setupRequired: false }
}

export async function hideInvoice(input: {
  invoiceId: string
  invoiceNumber?: string | null
  contactName?: string | null
  admin: AdminUser
}) {
  const { error } = await supabaseAdmin.from('xero_hidden_invoices').upsert(
    {
      xero_invoice_id: input.invoiceId,
      invoice_number: input.invoiceNumber || null,
      contact_name: input.contactName || null,
      hidden_by_user_id: input.admin.id,
      hidden_by_name: input.admin.full_name,
    },
    { onConflict: 'xero_invoice_id' },
  )

  if (error) {
    throw new Error(isMissingTable(error.message) ? SETUP_HINT : error.message)
  }
}

export async function unhideInvoice(invoiceId: string) {
  const { error } = await supabaseAdmin
    .from('xero_hidden_invoices')
    .delete()
    .eq('xero_invoice_id', invoiceId)

  if (error) {
    throw new Error(isMissingTable(error.message) ? SETUP_HINT : error.message)
  }
}
