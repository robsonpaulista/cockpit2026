-- ============================================
-- Gestão de Material de Campanha
-- Estoque (panfletos, praguinhas, adesivos…) +
-- movimentos + pedidos (WhatsApp / app)
-- Execute no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS campanha_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'outro'
    CHECK (categoria IN (
      'panfleto', 'praguinha', 'adesivo', 'bandeira', 'banner',
      'camiseta', 'bone', 'outro'
    )),
  unidade TEXT NOT NULL DEFAULT 'un'
    CHECK (unidade IN ('un', 'pct', 'cx', 'kit', 'm')),
  descricao TEXT,
  estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  /** Custo de aquisição por unidade (R$) — base para valor enviado às cidades. */
  preco_compra NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (preco_compra >= 0),
  saldo INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campanha_materiais_codigo_unique
  ON campanha_materiais (lower(codigo))
  WHERE codigo IS NOT NULL AND ativo = true;

CREATE INDEX IF NOT EXISTS idx_campanha_materiais_categoria
  ON campanha_materiais (categoria)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_campanha_materiais_ativo
  ON campanha_materiais (ativo, nome);

CREATE TABLE IF NOT EXISTS campanha_material_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES campanha_materiais(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  saldo_anterior INTEGER NOT NULL,
  saldo_posterior INTEGER NOT NULL,
  motivo TEXT,
  destino TEXT,
  origem TEXT,
  pedido_id UUID,
  referencia_externa TEXT,
  /** Snapshot do preço unitário na movimentação (R$). */
  preco_unitario NUMERIC(12, 4),
  valor_total NUMERIC(14, 4),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campanha_material_movimentos_material
  ON campanha_material_movimentos (material_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campanha_material_movimentos_tipo
  ON campanha_material_movimentos (tipo, created_at DESC);

CREATE TABLE IF NOT EXISTS campanha_material_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo TEXT,
  status TEXT NOT NULL DEFAULT 'novo'
    CHECK (status IN (
      'novo', 'em_analise', 'aprovado', 'separado', 'entregue', 'recusado', 'cancelado'
    )),
  solicitante_nome TEXT,
  solicitante_telefone TEXT,
  municipio TEXT,
  destino TEXT,
  observacao TEXT,
  origem TEXT NOT NULL DEFAULT 'app'
    CHECK (origem IN ('app', 'whatsapp', 'manual')),
  whatsapp_message_id TEXT,
  atendido_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  atendido_em TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campanha_material_pedidos_protocolo
  ON campanha_material_pedidos (protocolo)
  WHERE protocolo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campanha_material_pedidos_status
  ON campanha_material_pedidos (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campanha_material_pedidos_telefone
  ON campanha_material_pedidos (solicitante_telefone);

CREATE TABLE IF NOT EXISTS campanha_material_pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES campanha_material_pedidos(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES campanha_materiais(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  quantidade_atendida INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_atendida >= 0),
  /** Snapshot do preço de compra no momento do pedido (R$/un). */
  preco_unitario NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (preco_unitario >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campanha_material_pedido_itens_pedido
  ON campanha_material_pedido_itens (pedido_id);

ALTER TABLE campanha_material_movimentos
  DROP CONSTRAINT IF EXISTS campanha_material_movimentos_pedido_id_fkey;

ALTER TABLE campanha_material_movimentos
  ADD CONSTRAINT campanha_material_movimentos_pedido_id_fkey
  FOREIGN KEY (pedido_id) REFERENCES campanha_material_pedidos(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION update_campanha_materiais_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campanha_materiais_updated_at ON campanha_materiais;
CREATE TRIGGER trg_campanha_materiais_updated_at
  BEFORE UPDATE ON campanha_materiais
  FOR EACH ROW EXECUTE FUNCTION update_campanha_materiais_updated_at();

CREATE OR REPLACE FUNCTION update_campanha_material_pedidos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campanha_material_pedidos_updated_at ON campanha_material_pedidos;
CREATE TRIGGER trg_campanha_material_pedidos_updated_at
  BEFORE UPDATE ON campanha_material_pedidos
  FOR EACH ROW EXECUTE FUNCTION update_campanha_material_pedidos_updated_at();

ALTER TABLE campanha_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanha_material_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanha_material_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanha_material_pedido_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campanha_materiais_select_auth" ON campanha_materiais;
CREATE POLICY "campanha_materiais_select_auth" ON campanha_materiais
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "campanha_materiais_write_auth" ON campanha_materiais;
CREATE POLICY "campanha_materiais_write_auth" ON campanha_materiais
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "campanha_material_movimentos_select_auth" ON campanha_material_movimentos;
CREATE POLICY "campanha_material_movimentos_select_auth" ON campanha_material_movimentos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "campanha_material_movimentos_insert_auth" ON campanha_material_movimentos;
CREATE POLICY "campanha_material_movimentos_insert_auth" ON campanha_material_movimentos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "campanha_material_pedidos_select_auth" ON campanha_material_pedidos;
CREATE POLICY "campanha_material_pedidos_select_auth" ON campanha_material_pedidos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "campanha_material_pedidos_write_auth" ON campanha_material_pedidos;
CREATE POLICY "campanha_material_pedidos_write_auth" ON campanha_material_pedidos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "campanha_material_pedido_itens_select_auth" ON campanha_material_pedido_itens;
CREATE POLICY "campanha_material_pedido_itens_select_auth" ON campanha_material_pedido_itens
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "campanha_material_pedido_itens_write_auth" ON campanha_material_pedido_itens;
CREATE POLICY "campanha_material_pedido_itens_write_auth" ON campanha_material_pedido_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS campanha_material_pedido_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES campanha_material_pedidos(id) ON DELETE CASCADE,
  acao TEXT NOT NULL DEFAULT 'status_alterado'
    CHECK (acao IN ('criado', 'status_alterado')),
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  detalhe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campanha_material_pedido_logs_pedido
  ON campanha_material_pedido_logs (pedido_id, created_at ASC);

ALTER TABLE campanha_material_pedido_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campanha_material_pedido_logs_select_auth" ON campanha_material_pedido_logs;
CREATE POLICY "campanha_material_pedido_logs_select_auth" ON campanha_material_pedido_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "campanha_material_pedido_logs_insert_auth" ON campanha_material_pedido_logs;
CREATE POLICY "campanha_material_pedido_logs_insert_auth" ON campanha_material_pedido_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Página / permissão
INSERT INTO pages (key, label, path) VALUES
  ('material-campanha', 'Gestão de Material', '/dashboard/material-campanha')
ON CONFLICT (key) DO UPDATE
SET label = EXCLUDED.label, path = EXCLUDED.path;

-- Seed inicial (opcional)
INSERT INTO campanha_materiais (codigo, nome, categoria, unidade, estoque_minimo, saldo)
SELECT * FROM (VALUES
  ('PRAG-01', 'Praguinha', 'praguinha', 'un', 100, 0),
  ('ADES-MOTO', 'Adesivo de moto', 'adesivo', 'un', 200, 0),
  ('ADES-CARRO', 'Adesivo de carro', 'adesivo', 'un', 200, 0),
  ('SANT-01', 'Santinhos', 'panfleto', 'un', 500, 0),
  ('PERF-01', 'Perfurados', 'outro', 'un', 100, 0),
  ('BAND-01', 'Bandeiras', 'bandeira', 'un', 50, 0),
  ('PRAGAO-01', 'Pragão de rua', 'banner', 'un', 20, 0),
  ('CART-02', 'Cartaz formato 2', 'outro', 'un', 50, 0),
  ('CART-04', 'Cartaz formato 4', 'outro', 'un', 50, 0)
) AS v(codigo, nome, categoria, unidade, estoque_minimo, saldo)
WHERE NOT EXISTS (SELECT 1 FROM campanha_materiais LIMIT 1);
