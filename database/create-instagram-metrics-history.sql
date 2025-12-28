-- Tabela para armazenar histórico de métricas do Instagram
-- Permite rastrear evolução de seguidores, visitas ao perfil e outras métricas

-- Criar tabela de histórico de métricas
CREATE TABLE IF NOT EXISTS instagram_metrics_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Data do snapshot
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Métricas de seguidores
  followers_count INTEGER NOT NULL DEFAULT 0,
  
  -- Métricas de perfil
  profile_views INTEGER DEFAULT 0,
  website_clicks INTEGER DEFAULT 0,
  
  -- Métricas de alcance e engajamento
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  accounts_engaged INTEGER DEFAULT 0,
  total_interactions INTEGER DEFAULT 0,
  
  -- Métricas de conteúdo
  media_count INTEGER DEFAULT 0,
  
  -- Metadados
  instagram_username TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garantir apenas um registro por dia por usuário
  UNIQUE(user_id, snapshot_date)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_instagram_metrics_user_date 
  ON instagram_metrics_history(user_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_instagram_metrics_date 
  ON instagram_metrics_history(snapshot_date DESC);

-- Habilitar RLS
ALTER TABLE instagram_metrics_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Usuários podem ver apenas seus próprios dados
CREATE POLICY "Users can view own metrics" 
  ON instagram_metrics_history FOR SELECT 
  USING (auth.uid() = user_id);

-- Usuários podem inserir seus próprios dados
CREATE POLICY "Users can insert own metrics" 
  ON instagram_metrics_history FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar seus próprios dados
CREATE POLICY "Users can update own metrics" 
  ON instagram_metrics_history FOR UPDATE 
  USING (auth.uid() = user_id);

-- Usuários podem deletar seus próprios dados
CREATE POLICY "Users can delete own metrics" 
  ON instagram_metrics_history FOR DELETE 
  USING (auth.uid() = user_id);

-- Função para calcular crescimento de seguidores
CREATE OR REPLACE FUNCTION get_followers_growth(
  p_user_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  current_followers INTEGER,
  previous_followers INTEGER,
  growth INTEGER,
  growth_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH current_data AS (
    SELECT followers_count
    FROM instagram_metrics_history
    WHERE user_id = p_user_id
    ORDER BY snapshot_date DESC
    LIMIT 1
  ),
  previous_data AS (
    SELECT followers_count
    FROM instagram_metrics_history
    WHERE user_id = p_user_id
      AND snapshot_date <= CURRENT_DATE - p_days
    ORDER BY snapshot_date DESC
    LIMIT 1
  )
  SELECT 
    COALESCE(c.followers_count, 0) AS current_followers,
    COALESCE(p.followers_count, 0) AS previous_followers,
    COALESCE(c.followers_count, 0) - COALESCE(p.followers_count, 0) AS growth,
    CASE 
      WHEN COALESCE(p.followers_count, 0) > 0 
      THEN ROUND(((c.followers_count - p.followers_count)::NUMERIC / p.followers_count) * 100, 2)
      ELSE 0
    END AS growth_percentage
  FROM current_data c
  CROSS JOIN previous_data p;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON TABLE instagram_metrics_history IS 'Histórico diário de métricas do Instagram para análise de evolução';
COMMENT ON COLUMN instagram_metrics_history.followers_count IS 'Número total de seguidores no momento do snapshot';
COMMENT ON COLUMN instagram_metrics_history.profile_views IS 'Número de visitas ao perfil';
COMMENT ON COLUMN instagram_metrics_history.reach IS 'Alcance total (contas únicas alcançadas)';
COMMENT ON COLUMN instagram_metrics_history.impressions IS 'Total de impressões (visualizações do conteúdo)';

