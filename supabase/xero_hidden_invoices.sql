-- Hidden Xero invoices (run in admin Supabase SQL editor)
-- Lets admins remove an invoice from the Accounting list without touching the
-- record in Xero. Nothing here changes your books — it is a display filter only.

CREATE TABLE IF NOT EXISTS xero_hidden_invoices (
  xero_invoice_id TEXT PRIMARY KEY,
  invoice_number TEXT,
  contact_name TEXT,
  hidden_by_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  hidden_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS xero_hidden_invoices_created_at_idx
  ON xero_hidden_invoices (created_at DESC);

ALTER TABLE xero_hidden_invoices ENABLE ROW LEVEL SECURITY;

-- Admin API routes use the service role (which bypasses RLS); these policies
-- keep the table readable to approved admins if queried directly.
DROP POLICY IF EXISTS xero_hidden_invoices_select ON xero_hidden_invoices;
CREATE POLICY xero_hidden_invoices_select ON xero_hidden_invoices
  FOR SELECT TO authenticated
  USING (is_approved_admin());
