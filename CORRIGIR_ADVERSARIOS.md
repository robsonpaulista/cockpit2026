# 🔧 Correção: Tabela Adversaries e Campo Google Alerts

## Problemas Identificados

1. **Erro: "Could not find the table 'public.adversaries' in the schema cache"**
   - A tabela existe no schema, mas pode haver problemas com RLS (Row Level Security)
   - Políticas RLS podem estar bloqueando acesso

2. **Campo de URL do Google Alerts ausente**
   - O formulário não tinha campo para informar o link do feed RSS

## ✅ Correções Aplicadas

### 1. Script SQL para Adicionar Coluna

Execute no Supabase SQL Editor:

```sql
-- Arquivo: database/add-google-alerts-url-to-adversaries.sql
ALTER TABLE adversaries 
ADD COLUMN IF NOT EXISTS google_alerts_rss_url TEXT;

COMMENT ON COLUMN adversaries.google_alerts_rss_url IS 'URL do feed RSS do Google Alerts para monitorar este adversário';
```

### 2. Script SQL para Corrigir RLS

Execute no Supabase SQL Editor:

```sql
-- Arquivo: database/fix-adversaries-rls.sql
-- Remover política antiga se existir
DROP POLICY IF EXISTS "Authenticated users can read adversaries" ON adversaries;

-- Criar políticas completas
CREATE POLICY "Authenticated users can read all adversaries" ON adversaries
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert adversaries" ON adversaries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update adversaries" ON adversaries
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete adversaries" ON adversaries
  FOR DELETE USING (auth.role() = 'authenticated');
```

### 3. Atualizações no Código

- ✅ Adicionado campo `google_alerts_rss_url` no formulário do modal
- ✅ Atualizado schema de validação nas APIs (POST e PUT)
- ✅ Adicionado indicador visual quando feed RSS está configurado
- ✅ Interface atualizada para mostrar o campo de URL

## 📋 Passos para Aplicar

1. **Acesse o Supabase Dashboard**
   - Vá para SQL Editor

2. **Execute o primeiro script** (`add-google-alerts-url-to-adversaries.sql`)
   - Adiciona a coluna `google_alerts_rss_url` na tabela

3. **Execute o segundo script** (`fix-adversaries-rls.sql`)
   - Corrige as políticas RLS para permitir CRUD completo

4. **Teste a aplicação**
   - Acesse "Gerenciar Adversários"
   - Verifique se consegue criar/editar adversários
   - Verifique se o campo de URL do Google Alerts aparece

## 🎯 Como Usar o Campo Google Alerts

1. **Cadastre um adversário**
   - Acesse Notícias → Radar de Adversários → Gerenciar

2. **Adicione a URL do Feed RSS**
   - No formulário, preencha o campo "URL do Feed RSS do Google Alerts"
   - Exemplo: `https://www.google.com/alerts/feeds/123456789/1234567890`

3. **Como obter a URL do Google Alerts**
   - Acesse [Google Alerts](https://www.google.com/alerts)
   - Configure um alerta para o nome do adversário
   - Clique em "Mostrar opções" → "Enviar para" → "Feed RSS"
   - Copie a URL do feed

4. **Benefícios**
   - O sistema pode usar essa URL para coletar notícias específicas do adversário
   - Facilita o monitoramento direcionado

## 🔍 Verificação

Após executar os scripts, verifique:

1. **Tabela existe e tem a coluna:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'adversaries' 
AND column_name = 'google_alerts_rss_url';
```

2. **Políticas RLS estão ativas:**
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'adversaries';
```

3. **Teste de inserção:**
```sql
-- Deve funcionar se estiver autenticado
INSERT INTO adversaries (name, type) 
VALUES ('Teste', 'candidate') 
RETURNING *;
```

## ⚠️ Troubleshooting

### Erro persiste após executar scripts

1. **Verifique se está autenticado no Supabase**
   - As políticas RLS exigem autenticação

2. **Verifique se a tabela existe:**
```sql
SELECT * FROM information_schema.tables 
WHERE table_name = 'adversaries';
```

3. **Verifique permissões do usuário:**
   - O usuário precisa ter role 'authenticated'
   - Verifique em Authentication → Users

### Campo não aparece no formulário

1. **Limpe o cache do navegador**
2. **Reinicie o servidor Next.js**
3. **Verifique se o componente foi atualizado**

## 📝 Notas

- A URL do Google Alerts é opcional
- Pode ser adicionada/atualizada a qualquer momento
- O sistema pode usar essa URL para coletas futuras específicas por adversário




