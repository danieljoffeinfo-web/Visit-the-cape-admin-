-- Sequential invoice numbers (run in the admin Supabase SQL editor)
--
-- Produces INV-0001, INV-0002, … matching the existing invoice series.
-- Starts at 12 because INV-0011 was the last number issued by hand.

CREATE SEQUENCE IF NOT EXISTS vtc_invoice_seq START WITH 12 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 'INV-' || LPAD(nextval('vtc_invoice_seq')::TEXT, 4, '0');
$$;

-- The admin API calls this with the service role. Approved admins may also call
-- it directly if a client-side flow ever needs a number.
REVOKE ALL ON FUNCTION next_invoice_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_invoice_number() TO service_role, authenticated;
