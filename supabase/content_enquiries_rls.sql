-- Run on the PUBLIC SITE Supabase project (ufcawaywfgzrhfbzxtgz)
-- Fixes enquiry form submissions from visitthecape.co.za and lets the admin inbox read rows.

CREATE TABLE IF NOT EXISTS enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  experience TEXT,
  tour_type TEXT,
  message TEXT,
  date TEXT,
  passengers INTEGER,
  status TEXT DEFAULT 'new',
  replied_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS experience TEXT;
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

-- Website contact / booking forms submit with the publishable (anon) key
DROP POLICY IF EXISTS enquiries_insert_website ON enquiries;
CREATE POLICY enquiries_insert_website ON enquiries
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS enquiries_insert_authenticated ON enquiries;
CREATE POLICY enquiries_insert_authenticated ON enquiries
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Optional: allow approved admins signed into the public project to read in dashboard SQL
DROP POLICY IF EXISTS enquiries_select ON enquiries;
CREATE POLICY enquiries_select ON enquiries
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS enquiries_update ON enquiries;
CREATE POLICY enquiries_update ON enquiries
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
