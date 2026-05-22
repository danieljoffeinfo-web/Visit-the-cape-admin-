-- Xero OAuth tokens
CREATE TABLE IF NOT EXISTS xero_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  tenant_id text UNIQUE NOT NULL,
  org_name text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Map DF Travel tour types to Xero tracking categories
CREATE TABLE IF NOT EXISTS xero_tracking_map (
  tour_type text PRIMARY KEY,
  xero_category_id text,
  xero_option_id text,
  updated_at timestamptz DEFAULT now()
);

-- Link bookings to Xero invoices
CREATE TABLE IF NOT EXISTS xero_invoice_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id text NOT NULL,
  booking_type text NOT NULL DEFAULT 'tag_along',
  xero_invoice_id text NOT NULL,
  xero_invoice_number text,
  status text NOT NULL DEFAULT 'DRAFT',
  updated_at timestamptz DEFAULT now()
);

-- Index for fast booking lookups
CREATE INDEX IF NOT EXISTS xero_invoice_links_booking_idx ON xero_invoice_links(booking_id);
