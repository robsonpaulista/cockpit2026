-- Preço de compra nos materiais + snapshot em itens/movimentos
-- (para quem já rodou create-material-campanha.sql)

ALTER TABLE campanha_materiais
  ADD COLUMN IF NOT EXISTS preco_compra NUMERIC(12, 4) NOT NULL DEFAULT 0
    CHECK (preco_compra >= 0);

ALTER TABLE campanha_material_pedido_itens
  ADD COLUMN IF NOT EXISTS preco_unitario NUMERIC(12, 4) NOT NULL DEFAULT 0
    CHECK (preco_unitario >= 0);

ALTER TABLE campanha_material_movimentos
  ADD COLUMN IF NOT EXISTS preco_unitario NUMERIC(12, 4);

ALTER TABLE campanha_material_movimentos
  ADD COLUMN IF NOT EXISTS valor_total NUMERIC(14, 4);

-- Backfill: itens sem preço herdam o preço atual do material
UPDATE campanha_material_pedido_itens i
SET preco_unitario = m.preco_compra
FROM campanha_materiais m
WHERE i.material_id = m.id
  AND (i.preco_unitario IS NULL OR i.preco_unitario = 0)
  AND m.preco_compra > 0;
