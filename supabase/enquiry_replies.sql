-- Enquiry reply tracking + status fields for the admin inbox.
--
-- IMPORTANT: this file spans BOTH Supabase projects. Enquiry rows are owned by
-- whichever project `lib/enquiries-server.ts` resolves to — normally the
-- website/content project, because that is where the public site writes them —
-- while the reply log always lives in the admin project. Run each section in
-- the project named in its header.

-- ===========================================================================
-- SECTION A — run in the project that OWNS ENQUIRY ROWS
-- (the website/content project when CONTENT_SUPABASE_SERVICE_ROLE_KEY is set,
--  otherwise the admin project)
--
-- Without these columns the admin's "mark as replied" update fails outright,
-- because the public site only ever created name/email/phone/experience/message.
-- ===========================================================================

ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Rows created before the column existed would otherwise read as NULL status.
UPDATE enquiries SET status = 'new' WHERE status IS NULL;

-- ===========================================================================
-- SECTION B — run in the ADMIN project only
--
-- enquiry_id is a plain reference, NOT a foreign key: the reply log lives here
-- while the enquiry itself may live in the content project. A foreign key
-- rejects replies to content-project enquiries.
-- ===========================================================================

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
  fk_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'enquiry_replies'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'enquiry_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE enquiry_replies DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS enquiry_replies_enquiry_id_idx ON enquiry_replies(enquiry_id);

ALTER TABLE enquiry_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enquiry_replies_select ON enquiry_replies;
CREATE POLICY enquiry_replies_select ON enquiry_replies
  FOR SELECT TO authenticated
  USING (is_approved_admin());

-- ===========================================================================
-- SECTION C — ADMIN project only, and only if enquiries are stored there.
-- Skip when enquiries live in the content project: is_approved_admin() is
-- defined in the admin project and does not exist there. The admin writes to
-- enquiries with the service role, which bypasses RLS either way.
-- ===========================================================================

DROP POLICY IF EXISTS enquiries_update ON enquiries;
CREATE POLICY enquiries_update ON enquiries
  FOR UPDATE TO authenticated
  USING (is_approved_admin())
  WITH CHECK (is_approved_admin());
