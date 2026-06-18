-- Enquiry reply tracking + status fields for admin inbox
-- Run in Supabase SQL editor

ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS enquiry_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id UUID NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  admin_name TEXT,
  admin_email TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  resend_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enquiry_replies_enquiry_id_idx ON enquiry_replies(enquiry_id);

ALTER TABLE enquiry_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enquiry_replies_select ON enquiry_replies;
CREATE POLICY enquiry_replies_select ON enquiry_replies
  FOR SELECT TO authenticated
  USING (is_approved_admin());

DROP POLICY IF EXISTS enquiries_update ON enquiries;
CREATE POLICY enquiries_update ON enquiries
  FOR UPDATE TO authenticated
  USING (is_approved_admin())
  WITH CHECK (is_approved_admin());
