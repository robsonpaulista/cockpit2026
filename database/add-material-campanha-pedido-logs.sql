-- Log de etapas dos pedidos de material (quem analisou, aprovou, entregou…)
-- Execute no Supabase se a base já existir.

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
