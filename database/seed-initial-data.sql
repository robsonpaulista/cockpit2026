-- ============================================
-- DADOS INICIAIS - COCKPIT 2026
-- Execute no SQL Editor do Supabase
-- ============================================

-- Inserir Fases da Campanha (exemplo)
INSERT INTO campaign_phases (name, start_date, end_date, active, indicators, restrictions, automations)
VALUES
  (
    'Pré-campanha',
    '2024-01-01',
    '2024-07-15',
    false,
    '["Base de apoio", "Presença territorial"]'::jsonb,
    '["Sem conteúdo eleitoral explícito"]'::jsonb,
    '["Cadastro de voluntários"]'::jsonb
  ),
  (
    'Convenção',
    '2024-07-16',
    '2024-08-15',
    false,
    '["Tendência de intenção", "Crescimento de base"]'::jsonb,
    '["Conteúdo institucional limitado"]'::jsonb,
    '["WhatsApp básico"]'::jsonb
  ),
  (
    'Campanha Oficial',
    '2024-08-16',
    '2024-10-02',
    true,
    '["IFE", "Sentimento", "Presença"]'::jsonb,
    '["Conteúdo eleitoral permitido"]'::jsonb,
    '["WhatsApp completo", "Mobilização", "Radar"]'::jsonb
  ),
  (
    'Reta Final',
    '2024-10-03',
    '2024-10-30',
    false,
    '["IFE", "Presença", "Mobilização"]'::jsonb,
    '["Conteúdo institucional reduzido"]'::jsonb,
    '["WhatsApp máximo", "Alertas jurídicos"]'::jsonb
  )
ON CONFLICT DO NOTHING;

-- Inserir algumas cidades de exemplo
INSERT INTO cities (name, state, macro_region, priority)
VALUES
  ('São Paulo', 'SP', 'Grande São Paulo', 10),
  ('Rio de Janeiro', 'RJ', 'Metropolitana', 9),
  ('Belo Horizonte', 'MG', 'Metropolitana', 8),
  ('Campinas', 'SP', 'Interior', 7),
  ('Santos', 'SP', 'Litoral', 6)
ON CONFLICT DO NOTHING;

-- Verificar inserções
SELECT 'Fases criadas:' as info, COUNT(*) as total FROM campaign_phases;
SELECT 'Cidades criadas:' as info, COUNT(*) as total FROM cities;




