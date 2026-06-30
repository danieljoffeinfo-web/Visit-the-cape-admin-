-- Jarvis AI chat (run in admin Supabase SQL editor)
-- Per-user private conversation threads and messages.

CREATE TABLE IF NOT EXISTS jarvis_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jarvis_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES jarvis_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jarvis_threads_admin_idx ON jarvis_threads (admin_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS jarvis_messages_thread_idx ON jarvis_messages (thread_id, created_at ASC);
