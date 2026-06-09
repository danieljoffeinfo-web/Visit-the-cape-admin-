-- Visit The Cape Admin: auth, audit logging, and booking source tracking
-- Run this in the Supabase SQL editor for your project.

-- ---------------------------------------------------------------------------
-- admin_users — approved admin profiles (max 5 users for now)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'staff')),
  color TEXT NOT NULL DEFAULT 'Bronze' CHECK (color IN ('Bronze', 'Blue', 'Green', 'Purple', 'Red')),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_users_auth_user_id_idx ON admin_users(auth_user_id);
CREATE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users(email);
CREATE INDEX IF NOT EXISTS admin_users_approved_idx ON admin_users(is_approved) WHERE is_approved = true;

-- ---------------------------------------------------------------------------
-- activity_logs — audit trail for dashboard changes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_color TEXT NOT NULL DEFAULT 'Bronze',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_label TEXT,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_user_id_idx ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS activity_logs_entity_type_idx ON activity_logs(entity_type);
CREATE INDEX IF NOT EXISTS activity_logs_action_idx ON activity_logs(action);

-- ---------------------------------------------------------------------------
-- Extend tag_along_bookings for source / created-by tracking (tour bookings)
-- Safe to run multiple times — skips existing columns.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tag_along_bookings' AND column_name = 'booking_reference') THEN
    ALTER TABLE tag_along_bookings ADD COLUMN booking_reference TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tag_along_bookings' AND column_name = 'source') THEN
    ALTER TABLE tag_along_bookings ADD COLUMN source TEXT DEFAULT 'website' CHECK (source IN ('website', 'manual', 'internal'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tag_along_bookings' AND column_name = 'booking_type') THEN
    ALTER TABLE tag_along_bookings ADD COLUMN booking_type TEXT DEFAULT 'tour';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tag_along_bookings' AND column_name = 'status') THEN
    ALTER TABLE tag_along_bookings ADD COLUMN status TEXT DEFAULT 'confirmed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tag_along_bookings' AND column_name = 'payment_status') THEN
    ALTER TABLE tag_along_bookings ADD COLUMN payment_status TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tag_along_bookings' AND column_name = 'invoice_status') THEN
    ALTER TABLE tag_along_bookings ADD COLUMN invoice_status TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tag_along_bookings' AND column_name = 'created_by_user_id') THEN
    ALTER TABLE tag_along_bookings ADD COLUMN created_by_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tag_along_bookings' AND column_name = 'created_by_name') THEN
    ALTER TABLE tag_along_bookings ADD COLUMN created_by_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tag_along_bookings' AND column_name = 'created_by_color') THEN
    ALTER TABLE tag_along_bookings ADD COLUMN created_by_color TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tag_along_bookings' AND column_name = 'tour_id') THEN
    ALTER TABLE tag_along_bookings ADD COLUMN tour_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tag_along_bookings' AND column_name = 'vehicle_name') THEN
    ALTER TABLE tag_along_bookings ADD COLUMN vehicle_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tag_along_bookings' AND column_name = 'notes') THEN
    ALTER TABLE tag_along_bookings ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tag_along_bookings' AND column_name = 'updated_at') THEN
    ALTER TABLE tag_along_bookings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tag_along_bookings_source_idx ON tag_along_bookings(source);
CREATE INDEX IF NOT EXISTS tag_along_bookings_created_by_idx ON tag_along_bookings(created_by_user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger for admin_users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_users_updated_at ON admin_users;
CREATE TRIGGER admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper: is the current auth user an approved admin?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_approved_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE auth_user_id = auth.uid()
      AND is_approved = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Approved admins can read all admin profiles
DROP POLICY IF EXISTS admin_users_select ON admin_users;
CREATE POLICY admin_users_select ON admin_users
  FOR SELECT TO authenticated
  USING (is_approved_admin());

-- Users can read their own row (for approval check during login)
DROP POLICY IF EXISTS admin_users_select_own ON admin_users;
CREATE POLICY admin_users_select_own ON admin_users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- Approved admins can insert/update activity logs
DROP POLICY IF EXISTS activity_logs_select ON activity_logs;
CREATE POLICY activity_logs_select ON activity_logs
  FOR SELECT TO authenticated
  USING (is_approved_admin());

DROP POLICY IF EXISTS activity_logs_insert ON activity_logs;
CREATE POLICY activity_logs_insert ON activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_approved_admin());

-- tag_along_bookings: approved admins read/write
ALTER TABLE tag_along_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tag_along_bookings_select ON tag_along_bookings;
CREATE POLICY tag_along_bookings_select ON tag_along_bookings
  FOR SELECT TO authenticated
  USING (is_approved_admin());

DROP POLICY IF EXISTS tag_along_bookings_insert ON tag_along_bookings;
CREATE POLICY tag_along_bookings_insert ON tag_along_bookings
  FOR INSERT TO authenticated
  WITH CHECK (is_approved_admin());

DROP POLICY IF EXISTS tag_along_bookings_update ON tag_along_bookings;
CREATE POLICY tag_along_bookings_update ON tag_along_bookings
  FOR UPDATE TO authenticated
  USING (is_approved_admin());

-- Allow website booking flow to insert without admin session (service role bypasses RLS)
DROP POLICY IF EXISTS tag_along_bookings_insert_website ON tag_along_bookings;
CREATE POLICY tag_along_bookings_insert_website ON tag_along_bookings
  FOR INSERT TO anon
  WITH CHECK (source IS NULL OR source = 'website');

-- tag_along_tours — approved admins only
ALTER TABLE tag_along_tours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tag_along_tours_select ON tag_along_tours;
CREATE POLICY tag_along_tours_select ON tag_along_tours
  FOR SELECT TO authenticated
  USING (is_approved_admin());

DROP POLICY IF EXISTS tag_along_tours_insert ON tag_along_tours;
CREATE POLICY tag_along_tours_insert ON tag_along_tours
  FOR INSERT TO authenticated
  WITH CHECK (is_approved_admin());

DROP POLICY IF EXISTS tag_along_tours_update ON tag_along_tours;
CREATE POLICY tag_along_tours_update ON tag_along_tours
  FOR UPDATE TO authenticated
  USING (is_approved_admin());

DROP POLICY IF EXISTS tag_along_tours_delete ON tag_along_tours;
CREATE POLICY tag_along_tours_delete ON tag_along_tours
  FOR DELETE TO authenticated
  USING (is_approved_admin());

-- enquiries — approved admins read
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enquiries_select ON enquiries;
CREATE POLICY enquiries_select ON enquiries
  FOR SELECT TO authenticated
  USING (is_approved_admin());

-- ---------------------------------------------------------------------------
-- Seed approved admin users (Visit The Cape — 4 users)
-- Prerequisite: users already exist in Supabase Auth (Authentication → Users)
-- Disable public signups in Supabase Auth settings before going live.
-- ---------------------------------------------------------------------------
INSERT INTO admin_users (auth_user_id, full_name, email, role, color, is_approved) VALUES
  ('95d5bceb-c2b2-47b7-90f6-b3e3aff70192', 'Daniel Joffe', 'danieljoffeinfo@gmail.com', 'owner', 'Bronze', true),
  ('6fafc185-13d4-4843-b437-e006bff96b66', 'Fernando Brito', 'fernando@britos.co.za', 'admin', 'Blue', true),
  ('bb05b641-98ea-4227-b3a2-a62d56b3ac65', 'Tanya', 'tanya@visitthecape.co.za', 'admin', 'Green', true),
  ('6676f498-8e8c-4a85-b450-c341b389a401', 'Tyron', 'tyron@drivingforce.biz', 'staff', 'Purple', true)
ON CONFLICT (auth_user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  color = EXCLUDED.color,
  is_approved = EXCLUDED.is_approved,
  updated_at = now();
