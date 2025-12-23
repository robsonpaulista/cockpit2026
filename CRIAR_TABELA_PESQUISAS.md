# Criar Tabela de Pesquisas

## Instruções

Execute o script SQL abaixo no Supabase SQL Editor para criar a tabela de pesquisas eleitorais.

### Passo 1: Acesse o Supabase Dashboard
1. Vá para https://app.supabase.com
2. Selecione seu projeto
3. Clique em "SQL Editor" no menu lateral

### Passo 2: Execute o Script

**IMPORTANTE:** Se você já criou a tabela `polls` sem o campo `cidade_id`, execute primeiro o script de migração `database/add-cidade-id-to-polls.sql` para adicionar o campo.

Se ainda não criou a tabela, copie e cole o conteúdo do arquivo `database/create-polls-table.sql`:

```sql
-- Tabela de Pesquisas Eleitorais
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  instituto TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('estimulada', 'espontanea')),
  cargo TEXT NOT NULL CHECK (cargo IN ('dep_estadual', 'dep_federal', 'governador', 'senador', 'presidente')),
  intencao DECIMAL(5, 2) NOT NULL CHECK (intencao >= 0 AND intencao <= 100),
  rejeicao DECIMAL(5, 2) NOT NULL CHECK (rejeicao >= 0 AND rejeicao <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_polls_user_id ON polls(user_id);
CREATE INDEX IF NOT EXISTS idx_polls_data ON polls(data);
CREATE INDEX IF NOT EXISTS idx_polls_cargo ON polls(cargo);
CREATE INDEX IF NOT EXISTS idx_polls_tipo ON polls(tipo);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_polls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_polls_updated_at
  BEFORE UPDATE ON polls
  FOR EACH ROW
  EXECUTE FUNCTION update_polls_updated_at();

-- RLS Policies
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver suas próprias pesquisas
CREATE POLICY "Users can view their own polls"
  ON polls FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuários podem inserir suas próprias pesquisas
CREATE POLICY "Users can insert their own polls"
  ON polls FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem atualizar suas próprias pesquisas
CREATE POLICY "Users can update their own polls"
  ON polls FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem deletar suas próprias pesquisas
CREATE POLICY "Users can delete their own polls"
  ON polls FOR DELETE
  USING (auth.uid() = user_id);
```

### Passo 2.1: Se a tabela já existe (migração)

Se você já criou a tabela `polls` anteriormente, execute este script para adicionar o campo `cidade_id`:

```sql
-- Adicionar coluna cidade_id à tabela polls
ALTER TABLE polls
ADD COLUMN IF NOT EXISTS cidade_id TEXT REFERENCES cities(id);

-- Criar índice para cidade_id
CREATE INDEX IF NOT EXISTS idx_polls_cidade_id ON polls(cidade_id);

-- Comentário na coluna
COMMENT ON COLUMN polls.cidade_id IS 'Referência à cidade do Piauí onde a pesquisa foi realizada';
```

### Passo 3: Verificar

Após executar, verifique se a tabela foi criada:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'polls';
```

Deve retornar uma linha com `polls`.

### Passo 4: Testar

Após criar a tabela, acesse a página "Pesquisa & Relato de Rua" e teste:
1. Clique em "Nova Pesquisa"
2. Preencha os campos
3. Salve e verifique se aparece na lista

