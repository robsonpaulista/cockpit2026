-- Arena de Apoiadores — schema complementar (spec §4)

DO $$ BEGIN
  CREATE TYPE public.arena_interaction_type AS ENUM ('comentario', 'curtida');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.arena_interaction_source AS ENUM ('api_oficial', 'scraper', 'interno');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.arena_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_media_id TEXT NOT NULL UNIQUE,
  caption TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  permalink TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.arena_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.leads_militancia(id) ON DELETE SET NULL,
  post_id UUID NOT NULL REFERENCES public.arena_posts(id) ON DELETE CASCADE,
  type public.arena_interaction_type NOT NULL,
  raw_instagram_username TEXT NOT NULL,
  base_points INT NOT NULL,
  is_early_comment BOOLEAN NOT NULL DEFAULT false,
  early_bonus_points INT NOT NULL DEFAULT 0,
  source public.arena_interaction_source NOT NULL,
  interacted_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arena_interactions_member ON public.arena_interactions(member_id);
CREATE INDEX IF NOT EXISTS idx_arena_interactions_post ON public.arena_interactions(post_id);
CREATE INDEX IF NOT EXISTS idx_arena_interactions_username ON public.arena_interactions(raw_instagram_username);

ALTER TABLE public.leads_militancia
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS lgpd_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lgpd_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS instagram_user_id TEXT;

ALTER TABLE public.leaders
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS afiliacao_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaders_instagram_unique
  ON public.leaders (lower(instagram))
  WHERE instagram IS NOT NULL AND btrim(instagram) <> '';

COMMENT ON COLUMN public.leaders.instagram IS 'Handle Instagram da liderança (sem @, lowercase).';
COMMENT ON COLUMN public.leaders.email IS 'E-mail de contato da liderança.';
COMMENT ON COLUMN public.leaders.afiliacao_url IS 'Link de afiliação Engaja / cadastro.';

COMMENT ON TABLE public.arena_posts IS 'Posts da campanha rastreados pela Arena de Apoiadores.';
COMMENT ON TABLE public.arena_interactions IS 'Interações IG (comentário/curtida) — fonte da verdade de pontuação.';
