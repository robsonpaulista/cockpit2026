-- ============================================
-- Módulo Presença & Conteúdo (cards, agenda, obras)
-- Execute no SQL Editor do Supabase após revisar.
-- Usa tabelas existentes: obras, agendas (campo).
-- ============================================

-- ----- Colunas opcionais em agendas (campo) -----
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES obras(id) ON DELETE SET NULL;
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS hora_evento TIME;
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS territorio TEXT;

CREATE INDEX IF NOT EXISTS idx_agendas_obra_id ON agendas(obra_id) WHERE obra_id IS NOT NULL;

COMMENT ON COLUMN agendas.obra_id IS 'Obra relacionada (módulo presença / cards)';
COMMENT ON COLUMN agendas.hora_evento IS 'Horário do evento de campo';
COMMENT ON COLUMN agendas.territorio IS 'Território (texto livre, além da cidade)';

-- ----- Colunas opcionais em obras (demandas/planilha) -----
ALTER TABLE obras ADD COLUMN IF NOT EXISTS imagem_url TEXT;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS latitude NUMERIC(12, 8);
ALTER TABLE obras ADD COLUMN IF NOT EXISTS longitude NUMERIC(12, 8);
ALTER TABLE obras ADD COLUMN IF NOT EXISTS territorio TEXT;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS parceiro TEXT;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS descricao_obra TEXT;

COMMENT ON COLUMN obras.imagem_url IS 'URL pública de foto da obra (cards)';
COMMENT ON COLUMN obras.descricao_obra IS 'Descrição curta para comunicação';

-- ----- Conteúdos planejados -----
CREATE TABLE IF NOT EXISTS conteudos_planejados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES obras(id) ON DELETE SET NULL,
  agenda_id UUID REFERENCES agendas(id) ON DELETE CASCADE,
  cidade TEXT,
  territorio TEXT,
  fase TEXT,
  formato TEXT,
  template TEXT,
  titulo TEXT,
  texto_arte TEXT,
  legenda TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  storage_path_rascunho TEXT,
  imagem_url TEXT,
  storage_path TEXT,
  campanha_geral BOOLEAN NOT NULL DEFAULT false,
  data_sugerida DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conteudos_planejados_obra ON conteudos_planejados(obra_id);
CREATE INDEX IF NOT EXISTS idx_conteudos_planejados_agenda ON conteudos_planejados(agenda_id);
CREATE INDEX IF NOT EXISTS idx_conteudos_planejados_status ON conteudos_planejados(status);

ALTER TABLE conteudos_planejados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage conteudos_planejados" ON conteudos_planejados;
CREATE POLICY "Authenticated manage conteudos_planejados"
  ON conteudos_planejados FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ----- Publicações (métricas manuais) -----
CREATE TABLE IF NOT EXISTS publicacoes_conteudo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conteudo_id UUID NOT NULL REFERENCES conteudos_planejados(id) ON DELETE CASCADE,
  plataforma TEXT,
  link TEXT,
  views INTEGER,
  likes INTEGER,
  comentarios INTEGER,
  compartilhamentos INTEGER,
  data_coleta DATE NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publicacoes_conteudo_id ON publicacoes_conteudo(conteudo_id);
CREATE INDEX IF NOT EXISTS idx_publicacoes_data_coleta ON publicacoes_conteudo(data_coleta);

ALTER TABLE publicacoes_conteudo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage publicacoes_conteudo" ON publicacoes_conteudo;
CREATE POLICY "Authenticated manage publicacoes_conteudo"
  ON publicacoes_conteudo FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ----- Storage: dois buckets (rascunhos privado, aprovados público) -----
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('rascunhos', 'rascunhos', false, 5242880, ARRAY['image/png']::text[]),
  ('aprovados', 'aprovados', true, 5242880, ARRAY['image/png']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas storage.objects — time interno autenticado
DROP POLICY IF EXISTS "Authenticated read rascunhos" ON storage.objects;
CREATE POLICY "Authenticated read rascunhos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rascunhos');

DROP POLICY IF EXISTS "Authenticated write rascunhos" ON storage.objects;
CREATE POLICY "Authenticated write rascunhos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rascunhos');

DROP POLICY IF EXISTS "Authenticated update rascunhos" ON storage.objects;
CREATE POLICY "Authenticated update rascunhos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'rascunhos') WITH CHECK (bucket_id = 'rascunhos');

DROP POLICY IF EXISTS "Authenticated delete rascunhos" ON storage.objects;
CREATE POLICY "Authenticated delete rascunhos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'rascunhos');

DROP POLICY IF EXISTS "Authenticated read aprovados" ON storage.objects;
CREATE POLICY "Authenticated read aprovados"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'aprovados');

DROP POLICY IF EXISTS "Authenticated write aprovados" ON storage.objects;
CREATE POLICY "Authenticated write aprovados"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'aprovados');

DROP POLICY IF EXISTS "Authenticated update aprovados" ON storage.objects;
CREATE POLICY "Authenticated update aprovados"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'aprovados') WITH CHECK (bucket_id = 'aprovados');

DROP POLICY IF EXISTS "Authenticated delete aprovados" ON storage.objects;
CREATE POLICY "Authenticated delete aprovados"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'aprovados');

-- Leitura pública dos aprovados (URL permanente sem login)
DROP POLICY IF EXISTS "Public read aprovados" ON storage.objects;
CREATE POLICY "Public read aprovados"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'aprovados');

COMMENT ON TABLE conteudos_planejados IS 'Cards e textos planejados; imagens só em Storage (paths/URLs)';
COMMENT ON TABLE publicacoes_conteudo IS 'Registro manual de publicação e métricas; data_coleta = frescor dos números';

-- ----- Banco de referências visuais -----
CREATE TABLE IF NOT EXISTS referencias_visuais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imagem_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tema TEXT NOT NULL,
  formato TEXT NOT NULL,
  engajamento TEXT NOT NULL DEFAULT 'medio',
  origem TEXT NOT NULL DEFAULT 'instagram',
  observacoes TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE referencias_visuais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage referencias_visuais" ON referencias_visuais;
CREATE POLICY "Authenticated manage referencias_visuais"
  ON referencias_visuais FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE conteudos_planejados
  ADD COLUMN IF NOT EXISTS referencia_id UUID REFERENCES referencias_visuais(id);

ALTER TABLE conteudos_planejados
  ADD COLUMN IF NOT EXISTS fundo_origem TEXT;

CREATE INDEX IF NOT EXISTS idx_conteudos_planejados_referencia ON conteudos_planejados(referencia_id);
CREATE INDEX IF NOT EXISTS idx_referencias_visuais_tema_formato ON referencias_visuais(tema, formato);
CREATE INDEX IF NOT EXISTS idx_referencias_visuais_ativa ON referencias_visuais(ativa);

-- Bucket público para referências internas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'referencias',
  'referencias',
  true,
  8388608,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/webp', 'image/heic', 'image/heif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read referencias" ON storage.objects;
CREATE POLICY "Public read referencias"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'referencias');

DROP POLICY IF EXISTS "Authenticated read referencias" ON storage.objects;
CREATE POLICY "Authenticated read referencias"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'referencias');

DROP POLICY IF EXISTS "Authenticated write referencias" ON storage.objects;
CREATE POLICY "Authenticated write referencias"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'referencias');

DROP POLICY IF EXISTS "Authenticated update referencias" ON storage.objects;
CREATE POLICY "Authenticated update referencias"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'referencias')
  WITH CHECK (bucket_id = 'referencias');

DROP POLICY IF EXISTS "Authenticated delete referencias" ON storage.objects;
CREATE POLICY "Authenticated delete referencias"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'referencias');
