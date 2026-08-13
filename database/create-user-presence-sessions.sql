-- ============================================
-- Presença / sessões ativas (Gestão de Usuários)
-- Execute no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_presence (
  session_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_path TEXT,
  ip TEXT,
  user_agent TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  device_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_presence_user_id
  ON public.user_presence (user_id);

CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen
  ON public.user_presence (last_seen_at DESC);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_presence_own_write" ON public.user_presence;
CREATE POLICY "user_presence_own_write"
  ON public.user_presence
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_presence_admin_read" ON public.user_presence;
CREATE POLICY "user_presence_admin_read"
  ON public.user_presence
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  );

COMMENT ON TABLE public.user_presence IS
  'Heartbeat de sessão: última página, IP, cidade (Vercel) e user-agent. A sessão Auth vive em auth.sessions.';

CREATE OR REPLACE FUNCTION public.admin_list_auth_sessions()
RETURNS TABLE (
  session_id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  session_created_at timestamptz,
  session_refreshed_at timestamptz,
  session_ip text,
  session_user_agent text,
  last_seen_at timestamptz,
  last_path text,
  city text,
  region text,
  country text,
  device_label text,
  presence_ip text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    pr.name,
    pr.email,
    s.created_at,
    s.refreshed_at::timestamptz,
    s.ip::text,
    s.user_agent,
    up.last_seen_at,
    up.last_path,
    up.city,
    up.region,
    up.country,
    up.device_label,
    up.ip
  FROM auth.sessions s
  JOIN public.profiles pr ON pr.id = s.user_id
  LEFT JOIN public.user_presence up ON up.session_id = s.id
  ORDER BY COALESCE(up.last_seen_at, s.refreshed_at::timestamptz, s.created_at) DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_auth_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_auth_sessions() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_auth_session(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM auth.refresh_tokens WHERE session_id = p_session_id;
  DELETE FROM auth.sessions WHERE id = p_session_id;
  DELETE FROM public.user_presence WHERE session_id = p_session_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_auth_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_auth_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM auth.refresh_tokens
  WHERE session_id IN (SELECT id FROM auth.sessions WHERE user_id = p_user_id);
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.user_presence WHERE user_id = p_user_id;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_user_sessions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_sessions(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_own_session_max_age(
  p_session_id uuid,
  p_max_age interval DEFAULT interval '3 days'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  created timestamptz;
  uid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT s.created_at, s.user_id
  INTO created, uid
  FROM auth.sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'expired', true, 'reason', 'missing');
  END IF;

  IF uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF created < (now() - p_max_age) THEN
    DELETE FROM auth.refresh_tokens WHERE session_id = p_session_id;
    DELETE FROM auth.sessions WHERE id = p_session_id;
    DELETE FROM public.user_presence WHERE session_id = p_session_id;
    RETURN jsonb_build_object(
      'ok', false,
      'expired', true,
      'reason', 'max_age',
      'created_at', created
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'expired', false, 'created_at', created);
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_own_session_max_age(uuid, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_own_session_max_age(uuid, interval) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_stale_auth_sessions(
  p_max_age interval DEFAULT interval '3 days'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM auth.refresh_tokens
  WHERE session_id IN (
    SELECT id FROM auth.sessions WHERE created_at < (now() - p_max_age)
  );
  DELETE FROM auth.sessions WHERE created_at < (now() - p_max_age);
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.user_presence
  WHERE session_id NOT IN (SELECT id FROM auth.sessions);
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_stale_auth_sessions(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_stale_auth_sessions(interval) TO service_role;
