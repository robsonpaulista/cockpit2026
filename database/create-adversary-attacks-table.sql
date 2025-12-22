-- Garantir que a extensão UUID está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar tabela adversary_attacks se não existir
-- IMPORTANTE: Esta tabela depende de 'adversaries' e 'news'
-- Certifique-se de que essas tabelas existem antes de executar este script

CREATE TABLE IF NOT EXISTS adversary_attacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adversary_id UUID REFERENCES adversaries(id) ON DELETE CASCADE,
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  attack_type TEXT CHECK (attack_type IN ('direct', 'indirect', 'false_claim', 'omission')),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_adversary_attacks_adversary_id ON adversary_attacks(adversary_id);
CREATE INDEX IF NOT EXISTS idx_adversary_attacks_news_id ON adversary_attacks(news_id);
CREATE INDEX IF NOT EXISTS idx_adversary_attacks_detected_at ON adversary_attacks(detected_at);
CREATE INDEX IF NOT EXISTS idx_adversary_attacks_attack_type ON adversary_attacks(attack_type);

-- Habilitar RLS
ALTER TABLE adversary_attacks ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
DROP POLICY IF EXISTS "Authenticated users can read adversary_attacks" ON adversary_attacks;
DROP POLICY IF EXISTS "Authenticated users can insert adversary_attacks" ON adversary_attacks;

CREATE POLICY "Authenticated users can read adversary_attacks" ON adversary_attacks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert adversary_attacks" ON adversary_attacks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Comentários
COMMENT ON TABLE adversary_attacks IS 'Registros de ataques/menções de adversários em notícias';
COMMENT ON COLUMN adversary_attacks.attack_type IS 'Tipo de ataque: direct, indirect, false_claim, omission';

