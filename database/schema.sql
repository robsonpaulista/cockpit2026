-- ============================================
-- COCKPIT 2026 - Database Schema
-- Supabase PostgreSQL
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USUÁRIOS E AUTENTICAÇÃO
-- ============================================

-- Tabela de perfis de usuário (extende auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('candidato', 'coordenacao', 'comunicacao', 'articulacao', 'juridico', 'bi')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de permissões por módulo
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL,
  module TEXT NOT NULL,
  access_level TEXT NOT NULL CHECK (access_level IN ('read', 'write', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CAMPANHA E FASES
-- ============================================

-- Fases da campanha
CREATE TABLE IF NOT EXISTS campaign_phases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  active BOOLEAN DEFAULT FALSE,
  indicators JSONB DEFAULT '[]'::jsonb,
  restrictions JSONB DEFAULT '[]'::jsonb,
  automations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CAMPO & AGENDA
-- ============================================

-- Tabela de cidades/territórios
CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY, -- Pode ser UUID ou código IBGE (ex: 'ibge-2200051')
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  macro_region TEXT,
  microrregiao TEXT,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, state)
);

-- Agendas
CREATE TABLE IF NOT EXISTS agendas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  city_id UUID REFERENCES cities(id),
  type TEXT NOT NULL CHECK (type IN ('visita', 'evento', 'reuniao', 'outro')),
  status TEXT NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada', 'concluida', 'cancelada')),
  description TEXT,
  candidate_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visitas (check-in/check-out)
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agenda_id UUID REFERENCES agendas(id) ON DELETE CASCADE,
  checkin_time TIMESTAMPTZ,
  checkout_time TIMESTAMPTZ,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  photos JSONB DEFAULT '[]'::jsonb,
  videos JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Demandas
CREATE TABLE IF NOT EXISTS demands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID REFERENCES visits(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'nova' CHECK (status IN ('nova', 'em-andamento', 'encaminhado', 'resolvido')),
  theme TEXT,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  sla_deadline TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promessas
CREATE TABLE IF NOT EXISTS promises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID REFERENCES visits(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'encaminhado', 'cumprida')),
  deadline DATE,
  fulfilled_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TERRITÓRIO & BASE (CRM)
-- ============================================

-- Lideranças
CREATE TABLE IF NOT EXISTS leaderships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  city_id UUID REFERENCES cities(id),
  role TEXT,
  organization TEXT,
  phone TEXT,
  email TEXT,
  support_score INTEGER DEFAULT 0 CHECK (support_score >= 0 AND support_score <= 100),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'bloqueado')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de contatos
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leadership_id UUID REFERENCES leaderships(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('telefone', 'email', 'pessoal', 'evento')),
  date DATE NOT NULL,
  notes TEXT,
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de score de apoio
CREATE TABLE IF NOT EXISTS support_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leadership_id UUID REFERENCES leaderships(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BANCO DE NARRATIVAS
-- ============================================

-- Narrativas
CREATE TABLE IF NOT EXISTS narratives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theme TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  key_message TEXT NOT NULL,
  arguments JSONB DEFAULT '[]'::jsonb,
  proofs JSONB DEFAULT '[]'::jsonb,
  tested_phrases JSONB DEFAULT '[]'::jsonb,
  usage_count INTEGER DEFAULT 0,
  performance_score INTEGER DEFAULT 0 CHECK (performance_score >= 0 AND performance_score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uso de narrativas
CREATE TABLE IF NOT EXISTS narrative_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  narrative_id UUID REFERENCES narratives(id) ON DELETE CASCADE,
  used_by UUID REFERENCES profiles(id),
  used_in TEXT,
  date DATE NOT NULL,
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTÍCIAS, CRISES & RADAR DE ADVERSÁRIOS
-- ============================================

-- Crises (criada primeiro porque news referencia)
CREATE TABLE IF NOT EXISTS crises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'monitoring', 'resolved', 'archived')),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  response_time INTEGER, -- Tempo de resposta em minutos
  narrative_id UUID REFERENCES narratives(id), -- Narrativa sugerida para resposta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notícias (criada depois de crises porque referencia crises)
CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  content TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  theme TEXT,
  actor TEXT,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  crisis_id UUID REFERENCES crises(id), -- Referência à crise relacionada (se houver)
  feed_id UUID REFERENCES news_feeds(id) ON DELETE SET NULL, -- Referência ao feed RSS do usuário que coletou esta notícia
  adversary_id UUID REFERENCES adversaries(id) ON DELETE SET NULL, -- Referência ao adversário cujo feed RSS coletou esta notícia (NULL para notícias gerais)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índice único para evitar duplicatas por URL
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_url_unique ON news(url) WHERE url IS NOT NULL;

-- Adversários
CREATE TABLE IF NOT EXISTS adversaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('candidate', 'party', 'media', 'influencer', 'other')),
  themes JSONB DEFAULT '[]'::jsonb, -- Temas que abordam
  presence_score INTEGER DEFAULT 0 CHECK (presence_score >= 0 AND presence_score <= 100), -- Share of Voice
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ataques de adversários (registro de menções/ataques)
CREATE TABLE IF NOT EXISTS adversary_attacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adversary_id UUID REFERENCES adversaries(id) ON DELETE CASCADE,
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  attack_type TEXT CHECK (attack_type IN ('direct', 'indirect', 'false_claim', 'omission')),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alertas de notícias
CREATE TABLE IF NOT EXISTS news_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  type TEXT CHECK (type IN ('risk_high', 'crisis_detected', 'adversary_attack', 'sentiment_negative')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feeds RSS configurados (por candidato/usuário)
CREATE TABLE IF NOT EXISTS news_feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Nome do feed (ex: "Meu Nome", "Meu Nome + Piauí")
  rss_url TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  auto_classify BOOLEAN DEFAULT TRUE,
  last_collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- KPIs E MÉTRICAS (para Dashboard)
-- ============================================

-- Métricas diárias (cache para performance)
CREATE TABLE IF NOT EXISTS daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  ife_score INTEGER CHECK (ife_score >= 0 AND ife_score <= 100),
  presence_territorial INTEGER,
  base_capilarity INTEGER,
  useful_engagement INTEGER,
  public_sentiment INTEGER CHECK (public_sentiment >= 0 AND public_sentiment <= 100),
  crisis_risk INTEGER CHECK (crisis_risk >= 0 AND crisis_risk <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES E TRIGGERS
-- ============================================

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_agendas_date ON agendas(date);
CREATE INDEX IF NOT EXISTS idx_agendas_city ON agendas(city_id);
CREATE INDEX IF NOT EXISTS idx_agendas_status ON agendas(status);
CREATE INDEX IF NOT EXISTS idx_demands_status ON demands(status);
CREATE INDEX IF NOT EXISTS idx_leaderships_city ON leaderships(city_id);
CREATE INDEX IF NOT EXISTS idx_leaderships_score ON leaderships(support_score);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX IF NOT EXISTS idx_news_collected_at ON news(collected_at);
CREATE INDEX IF NOT EXISTS idx_news_risk_level ON news(risk_level);
CREATE INDEX IF NOT EXISTS idx_news_sentiment ON news(sentiment);
CREATE INDEX IF NOT EXISTS idx_news_theme ON news(theme);
CREATE INDEX IF NOT EXISTS idx_crises_status ON crises(status);
CREATE INDEX IF NOT EXISTS idx_crises_severity ON crises(severity);
CREATE INDEX IF NOT EXISTS idx_adversary_attacks_detected_at ON adversary_attacks(detected_at);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_phases_updated_at BEFORE UPDATE ON campaign_phases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agendas_updated_at BEFORE UPDATE ON agendas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_demands_updated_at BEFORE UPDATE ON demands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promises_updated_at BEFORE UPDATE ON promises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leaderships_updated_at BEFORE UPDATE ON leaderships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_narratives_updated_at BEFORE UPDATE ON narratives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_news_updated_at BEFORE UPDATE ON news
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crises_updated_at BEFORE UPDATE ON crises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_adversaries_updated_at BEFORE UPDATE ON adversaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_news_feeds_updated_at BEFORE UPDATE ON news_feeds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_metrics_updated_at BEFORE UPDATE ON daily_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderships ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE narratives ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE crises ENABLE ROW LEVEL SECURITY;
ALTER TABLE adversaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE adversary_attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ajustar conforme necessidade)
-- Perfis: usuário pode ver/editar seu próprio perfil
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Por enquanto, permitir leitura para todos autenticados (ajustar depois)
CREATE POLICY "Authenticated users can read campaign_phases" ON campaign_phases
  FOR SELECT USING (auth.role() = 'authenticated');

-- Notícias, Crises e Adversários: todos autenticados podem ler
CREATE POLICY "Authenticated users can read news" ON news
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read crises" ON crises
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read adversaries" ON adversaries
  FOR SELECT USING (auth.role() = 'authenticated');

-- TODO: Implementar políticas mais granulares baseadas em roles

