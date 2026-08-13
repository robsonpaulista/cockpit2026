-- ============================================
-- Derruba sessões Auth abertas há mais de 3 dias
-- Execute no SQL Editor (além de create-user-presence-sessions.sql)
-- ============================================

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
