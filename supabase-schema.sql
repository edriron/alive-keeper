-- ============================================================
-- Keep Alive Dashboard — Supabase Schema
-- Run this entire file in the Supabase SQL editor.
-- ============================================================


-- ── 1. PROFILES ─────────────────────────────────────────────────────────────
-- Extends auth.users with role information.

CREATE TABLE public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  role        TEXT        NOT NULL DEFAULT 'user'
                          CHECK (role IN ('admin', 'user')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create a profile row whenever a new user signs up via Auth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 2. SITES ────────────────────────────────────────────────────────────────
-- Endpoints that receive keep-alive pings.

CREATE TABLE public.sites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  url         TEXT        NOT NULL,
  method      TEXT        NOT NULL DEFAULT 'GET'
                          CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH')),
  headers     JSONB       NOT NULL DEFAULT '{}',
  secret      TEXT,                          -- sent as: Authorization: Bearer {secret}
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sites_active ON public.sites(active) WHERE active = true;


-- ── 3. KEEP_ALIVE_LOGS ──────────────────────────────────────────────────────
-- One row per ping attempt for each site.

CREATE TABLE public.keep_alive_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          UUID        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  status_code      INTEGER,
  response_body    JSONB,
  response_time_ms INTEGER,
  success          BOOLEAN     NOT NULL DEFAULT false,
  error_message    TEXT,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_keep_alive_logs_site_id  ON public.keep_alive_logs(site_id);
CREATE INDEX idx_keep_alive_logs_sent_at  ON public.keep_alive_logs(sent_at DESC);


-- ── 4. AUTO-UPDATED updated_at TRIGGER ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_sites_updated_at
  BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ── 5. ROW LEVEL SECURITY ────────────────────────────────────────────────────

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keep_alive_logs ENABLE ROW LEVEL SECURITY;

-- ── profiles: users can read & update their own row ──────────────────────────
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── sites: admins only ───────────────────────────────────────────────────────
CREATE POLICY "Admins can manage sites"
  ON public.sites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── keep_alive_logs: admins only ─────────────────────────────────────────────
CREATE POLICY "Admins can view logs"
  ON public.keep_alive_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- The keep-alive API route uses the service-role key, which bypasses RLS.
-- So no INSERT policy is needed for keep_alive_logs — the service role handles it.


-- ── 6. OPTIONAL: RPC to get sites + last N logs (efficient alternative) ──────
-- You can call this from the app instead of separate queries if you prefer.

CREATE OR REPLACE FUNCTION public.get_sites_with_recent_logs(log_limit INT DEFAULT 10)
RETURNS TABLE (
  site_id          UUID,
  site_name        TEXT,
  site_url         TEXT,
  site_method      TEXT,
  site_active      BOOLEAN,
  log_id           UUID,
  log_status_code  INTEGER,
  log_success      BOOLEAN,
  log_response_ms  INTEGER,
  log_sent_at      TIMESTAMPTZ,
  log_error        TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.url,
    s.method,
    s.active,
    l.id,
    l.status_code,
    l.success,
    l.response_time_ms,
    l.sent_at,
    l.error_message
  FROM public.sites s
  LEFT JOIN LATERAL (
    SELECT *
    FROM public.keep_alive_logs
    WHERE site_id = s.id
    ORDER BY sent_at DESC
    LIMIT log_limit
  ) l ON true
  ORDER BY s.name, l.sent_at DESC NULLS LAST;
$$;


-- ── 7. GRANT YOUR FIRST ADMIN ────────────────────────────────────────────────
-- After signing up with Google OAuth, run this with your email:
--
--   UPDATE public.profiles
--   SET role = 'admin'
--   WHERE email = 'your-email@gmail.com';
--
-- You can also do this directly in the Supabase Table Editor.


-- ── 8. OPTIONAL CLEANUP (old logs) ───────────────────────────────────────────
-- If you want to auto-purge logs older than 30 days, enable pg_cron in
-- Supabase extensions and schedule:
--
--   SELECT cron.schedule(
--     'purge-old-keep-alive-logs',
--     '0 3 * * *',  -- daily at 03:00 UTC
--     $$
--       DELETE FROM public.keep_alive_logs
--       WHERE sent_at < now() - INTERVAL '30 days';
--     $$
--   );
