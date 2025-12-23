-- ============================================
-- TABELAS PARA OPERAÇÃO & EQUIPE
-- Territórios de Desenvolvimento do Piauí
-- ============================================

-- Tabela de Territórios de Desenvolvimento
CREATE TABLE IF NOT EXISTS territories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  vocations TEXT[], -- Array de vocações econômicas
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir os 12 Territórios de Desenvolvimento do Piauí
INSERT INTO territories (name, description, vocations) VALUES
  ('Planície Litorânea', 'Território costeiro com foco em pesca e aquicultura', ARRAY['Pesca', 'Aquicultura', 'Produção de leite']),
  ('Cocais', 'Território com foco em piscicultura e extrativismo', ARRAY['Piscicultura', 'Ovinocaprinocultura', 'Extrativismo']),
  ('Carnaubais', 'Território com produção de açúcar e álcool', ARRAY['Açúcar', 'Álcool', 'Ovinocaprinocultura']),
  ('Entre Rios', 'Território metropolitano incluindo Teresina', ARRAY['Turismo', 'Negócios', 'Infraestrutura']),
  ('Vale do Sambito', 'Território com foco em ovinocaprinocultura e fruticultura', ARRAY['Ovinocaprinocultura', 'Fruticultura irrigada']),
  ('Vale do Rio Guaribas', 'Território com agricultura familiar e apicultura', ARRAY['Ovinocaprinocultura', 'Apicultura', 'Agricultura familiar']),
  ('Chapada do Vale do Rio Itaim', 'Território com foco em fruticultura irrigada', ARRAY['Ovinocaprinocultura', 'Apicultura', 'Fruticultura irrigada']),
  ('Vale do Canindé', 'Território com agricultura familiar', ARRAY['Ovinocaprinocultura', 'Apicultura', 'Agricultura familiar']),
  ('Serra da Capivara', 'Território turístico com sítio arqueológico', ARRAY['Turismo', 'Ovinocaprinocultura', 'Apicultura', 'Artesanato']),
  ('Vale dos Rios Piauí e Itaueira', 'Território com fruticultura irrigada', ARRAY['Fruticultura irrigada', 'Agricultura', 'Pecuária']),
  ('Tabuleiros do Alto Parnaíba', 'Território com agricultura de alto rendimento', ARRAY['Pecuária de corte', 'Soja', 'Milho', 'Algodão']),
  ('Chapada das Mangabeiras', 'Território com agricultura de alto rendimento', ARRAY['Pecuária de corte', 'Soja', 'Milho', 'Algodão'])
ON CONFLICT (name) DO NOTHING;

-- Tabela de Líderes por Território
CREATE TABLE IF NOT EXISTS territory_leaders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  territory_id UUID REFERENCES territories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role TEXT, -- Ex: Coordenador, Líder Regional, etc.
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  notes TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Se for usuário do sistema
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Tarefas
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  territory_id UUID REFERENCES territories(id) ON DELETE CASCADE,
  leader_id UUID REFERENCES territory_leaders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'em-andamento', 'em-revisao', 'concluido', 'cancelado')),
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES territory_leaders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_territory_leaders_territory_id ON territory_leaders(territory_id);
CREATE INDEX IF NOT EXISTS idx_tasks_territory_id ON tasks(territory_id);
CREATE INDEX IF NOT EXISTS idx_tasks_leader_id ON tasks(leader_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- RLS Policies
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Políticas para territories (todos autenticados podem ler)
CREATE POLICY "Authenticated users can view territories"
  ON territories FOR SELECT
  TO authenticated
  USING (true);

-- Políticas para territory_leaders
CREATE POLICY "Authenticated users can view territory leaders"
  ON territory_leaders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert territory leaders"
  ON territory_leaders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update territory leaders"
  ON territory_leaders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete territory leaders"
  ON territory_leaders FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para tasks
CREATE POLICY "Authenticated users can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (true);


