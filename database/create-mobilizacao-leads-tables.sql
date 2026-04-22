-- ============================================
-- Mobilização: Coordenadores, Líderes e Leads
-- Fluxo: QR -> leader_id -> coordinator_id automático
-- ============================================

CREATE TABLE IF NOT EXISTS public.coordinators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  regiao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leaders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  telefone TEXT,
  cidade TEXT,
  municipio TEXT,
  coordinator_id UUID REFERENCES public.coordinators(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaders_coordinator_id ON public.leaders(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_leaders_cidade ON public.leaders(cidade);
CREATE INDEX IF NOT EXISTS idx_leaders_municipio ON public.leaders(municipio);

CREATE TABLE IF NOT EXISTS public.leads_militancia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  instagram TEXT,
  cidade TEXT,
  leader_id UUID NOT NULL REFERENCES public.leaders(id) ON DELETE RESTRICT,
  coordinator_id UUID REFERENCES public.coordinators(id) ON DELETE SET NULL,
  origem TEXT NOT NULL DEFAULT 'qr',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leads_militancia_status_check CHECK (status IN ('ativo', 'inativo')),
  CONSTRAINT leads_militancia_whatsapp_unique UNIQUE (whatsapp)
);

CREATE INDEX IF NOT EXISTS idx_leads_militancia_leader_id ON public.leads_militancia(leader_id);
CREATE INDEX IF NOT EXISTS idx_leads_militancia_coordinator_id ON public.leads_militancia(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_leads_militancia_cidade ON public.leads_militancia(cidade);
CREATE INDEX IF NOT EXISTS idx_leads_militancia_created_at ON public.leads_militancia(created_at DESC);

ALTER TABLE public.coordinators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_militancia ENABLE ROW LEVEL SECURITY;

-- Sem políticas públicas de escrita direta.
-- Inserção da página pública deve acontecer via API server-side com service role.

COMMENT ON TABLE public.coordinators IS 'Coordenação regional da operação de mobilização.';
COMMENT ON TABLE public.leaders IS 'Lideranças vinculadas a um coordenador.';
COMMENT ON TABLE public.leads_militancia IS 'Leads captados via formulário público de mobilização.';
