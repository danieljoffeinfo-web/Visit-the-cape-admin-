-- Content Supabase (ufcawaywfgzrhfbzxtgz): allow website booking enquiries from anon clients
-- Run in Supabase SQL editor for the content project if the admin proxy is unavailable.

ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enquiries_insert_website ON enquiries;
CREATE POLICY enquiries_insert_website ON enquiries
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS enquiries_select_anon ON enquiries;
CREATE POLICY enquiries_select_anon ON enquiries
  FOR SELECT TO anon
  USING (false);
