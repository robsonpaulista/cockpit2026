-- ============================================
-- OPORTUNIDADES FEDERAIS (fora de emenda)
-- Programas discricionários do Transferegov
-- Execute no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS public.oportunidades_federais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_programa INTEGER NOT NULL,
  cod_programa TEXT,
  nome_programa TEXT NOT NULL,
  descricao TEXT,
  observacao TEXT,
  criterios_selecao TEXT,
  orgao_superior TEXT,
  cod_orgao_superior TEXT,
  orgao_executor TEXT,
  acao_orcamentaria TEXT,
  situacao TEXT,
  modalidade TEXT,
  qualificacao_proposta TEXT,
  natureza_juridica TEXT,
  uf TEXT,
  area TEXT,
  data_disponibilizacao DATE,
  ano_disponibilizacao TEXT,
  dt_ini_receb_prop DATE,
  dt_fim_receb_prop DATE,
  expiracao_prop TEXT,
  chamamento_projeto TEXT,
  emenda_flag TEXT,
  fonte TEXT NOT NULL DEFAULT 'transferegov',
  raw JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_programa, uf)
);

CREATE INDEX IF NOT EXISTS idx_oportunidades_federais_situacao
  ON public.oportunidades_federais (situacao);
CREATE INDEX IF NOT EXISTS idx_oportunidades_federais_uf
  ON public.oportunidades_federais (uf);
CREATE INDEX IF NOT EXISTS idx_oportunidades_federais_fim
  ON public.oportunidades_federais (dt_fim_receb_prop);
CREATE INDEX IF NOT EXISTS idx_oportunidades_federais_orgao
  ON public.oportunidades_federais (orgao_superior);
CREATE INDEX IF NOT EXISTS idx_oportunidades_federais_area
  ON public.oportunidades_federais (area);
CREATE INDEX IF NOT EXISTS idx_oportunidades_federais_synced
  ON public.oportunidades_federais (synced_at DESC);

CREATE TABLE IF NOT EXISTS public.oportunidades_federais_sync (
  id TEXT PRIMARY KEY DEFAULT 'transferegov',
  last_sync_at TIMESTAMPTZ,
  last_source_update TEXT,
  last_status TEXT,
  last_error TEXT,
  items_upserted INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.update_oportunidades_federais_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_oportunidades_federais_updated_at ON public.oportunidades_federais;
CREATE TRIGGER trg_oportunidades_federais_updated_at
  BEFORE UPDATE ON public.oportunidades_federais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_oportunidades_federais_updated_at();

ALTER TABLE public.oportunidades_federais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oportunidades_federais_sync ENABLE ROW LEVEL SECURITY;

-- Data API: sem acesso anônimo; leitura só para logados. Escrita via service role (bypassa RLS).
REVOKE ALL ON TABLE public.oportunidades_federais FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.oportunidades_federais_sync FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.oportunidades_federais TO authenticated;
GRANT SELECT ON TABLE public.oportunidades_federais_sync TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can view oportunidades_federais"
  ON public.oportunidades_federais;
CREATE POLICY "Authenticated users can view oportunidades_federais"
  ON public.oportunidades_federais FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can view oportunidades_federais_sync"
  ON public.oportunidades_federais_sync;
CREATE POLICY "Authenticated users can view oportunidades_federais_sync"
  ON public.oportunidades_federais_sync FOR SELECT
  TO authenticated
  USING (true);
