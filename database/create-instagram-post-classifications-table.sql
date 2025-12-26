-- Garantir que a extensão UUID está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar tabela para classificações de posts do Instagram
CREATE TABLE IF NOT EXISTS instagram_post_classifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id TEXT, -- ID do post do Instagram (pode ser null se usar identifier)
  identifier TEXT NOT NULL, -- Identificador único (postId ou gerado de data+caption)
  post_date TIMESTAMPTZ, -- Data da postagem
  post_caption TEXT, -- Legenda do post
  theme TEXT NOT NULL, -- Tema da postagem (ex: Saúde, Educação, etc.)
  is_boosted BOOLEAN DEFAULT FALSE, -- Se o post foi impulsionado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Garantir que identifier é único por usuário
  UNIQUE(user_id, identifier)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_instagram_classifications_user_id ON instagram_post_classifications(user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_classifications_identifier ON instagram_post_classifications(identifier);
CREATE INDEX IF NOT EXISTS idx_instagram_classifications_theme ON instagram_post_classifications(theme);
CREATE INDEX IF NOT EXISTS idx_instagram_classifications_post_id ON instagram_post_classifications(post_id) WHERE post_id IS NOT NULL;

-- Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_instagram_classifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_instagram_classifications_updated_at ON instagram_post_classifications;
CREATE TRIGGER update_instagram_classifications_updated_at 
  BEFORE UPDATE ON instagram_post_classifications
  FOR EACH ROW
  EXECUTE FUNCTION update_instagram_classifications_updated_at();

-- Habilitar RLS
ALTER TABLE instagram_post_classifications ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
DROP POLICY IF EXISTS "Users can read their own classifications" ON instagram_post_classifications;
DROP POLICY IF EXISTS "Users can insert their own classifications" ON instagram_post_classifications;
DROP POLICY IF EXISTS "Users can update their own classifications" ON instagram_post_classifications;
DROP POLICY IF EXISTS "Users can delete their own classifications" ON instagram_post_classifications;

-- Política para leitura: usuários podem ler apenas suas próprias classificações
CREATE POLICY "Users can read their own classifications"
  ON instagram_post_classifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política para inserção: usuários podem inserir apenas suas próprias classificações
CREATE POLICY "Users can insert their own classifications"
  ON instagram_post_classifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Política para atualização: usuários podem atualizar apenas suas próprias classificações
CREATE POLICY "Users can update their own classifications"
  ON instagram_post_classifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política para exclusão: usuários podem excluir apenas suas próprias classificações
CREATE POLICY "Users can delete their own classifications"
  ON instagram_post_classifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Comentários
COMMENT ON TABLE instagram_post_classifications IS 'Classificações de temas e impulsionamento para posts do Instagram';
COMMENT ON COLUMN instagram_post_classifications.identifier IS 'Identificador único do post (postId ou gerado de data+caption)';
COMMENT ON COLUMN instagram_post_classifications.theme IS 'Tema da postagem (ex: Saúde, Educação, Infraestrutura)';
COMMENT ON COLUMN instagram_post_classifications.is_boosted IS 'Indica se o post foi impulsionado (anúncio pago)';

