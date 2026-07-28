-- Enquiry reply tracking + status fields for admin inbox
-- Run in Supabase SQL editor

ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- enquiry_id is a plain reference, NOT a foreign key: the reply log always lives
-- in the admin project, while the enquiry itself may live in the website/content
-- project. A foreign key here would reject replies to content-project enquiries.
CREATE TABLE IF NOT EXISTS enquiry_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id UUID NOT NULL,
  admin_name TEXT,
  admin_email TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  resend_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drop the constraint on databases created before the reference was relaxed.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'enquiry_replies'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'enquiry_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE enquiry_replies DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

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
