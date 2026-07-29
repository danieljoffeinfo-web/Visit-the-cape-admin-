import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Next number in the INV-#### series.
 *
 * Uses a Postgres sequence via next_invoice_number() so two admins booking at
 * the same moment can never land on the same number. If the function is missing
 * (migration not run yet) we fall back to a timestamp-derived number so a
 * booking is never blocked by invoice numbering.
 */
export async function nextInvoiceNumber(): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('next_invoice_number')

  if (!error && typeof data === 'string' && data.trim()) {
    return data.trim()
  }

  if (error) {
    console.error('Invoice numbering unavailable, using fallback:', error.message)
  }

  return `INV-T${Date.now().toString().slice(-8)}`
}
