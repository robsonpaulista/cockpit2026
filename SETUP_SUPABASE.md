# 🔧 Configuração do Supabase - Cockpit 2026

## Passo 1: Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Faça login ou crie uma conta
3. Clique em "New Project"
4. Preencha:
   - **Name**: `cockpit-2026`
   - **Database Password**: (guarde essa senha!)
   - **Region**: Escolha a mais próxima
5. Aguarde o projeto ser criado (pode levar alguns minutos)

## Passo 2: Obter Credenciais

1. No painel do projeto, vá em **Settings** → **API**
2. Copie as seguintes informações:
   - **Project URL** (ex: `https://xxxxx.supabase.co`)
   - **anon/public key** (chave pública)
   - **service_role key** (chave privada - NUNCA exponha no frontend!)

## Passo 3: Configurar Variáveis de Ambiente

1. Crie um arquivo `.env.local` na raiz do projeto:

```bash
# Copiar de .env.local.example
cp .env.local.example .env.local
```

2. Edite `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=gerar_com_openssl_rand_-base64_32
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. Para gerar `NEXTAUTH_SECRET`:
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

## Passo 4: Executar Schema SQL

1. No Supabase, vá em **SQL Editor**
2. Abra o arquivo `database/schema.sql` do projeto
3. Copie todo o conteúdo
4. Cole no SQL Editor do Supabase
5. Execute (botão "Run" ou F5)

Isso criará:
- ✅ Todas as tabelas necessárias
- ✅ Índices para performance
- ✅ Triggers para updated_at
- ✅ Row Level Security (RLS) básico

## Passo 5: Criar Primeiro Usuário

### Opção A: Via Interface do Supabase

1. No Supabase, vá em **Authentication** → **Users**
2. Clique em **Add User** → **Create New User**
3. Preencha email e senha
4. **Importante**: Copie o UUID do usuário criado

### Opção B: Via SQL (Recomendado)

1. No SQL Editor, execute:

```sql
-- Criar usuário (substitua email e senha)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@cockpit2026.com', -- SEU EMAIL
  crypt('sua_senha_aqui', gen_salt('bf')), -- SUA SENHA
  NOW(),
  NOW(),
  NOW()
)
RETURNING id;
```

2. **Copie o ID retornado** e execute (substitua o ID):

```sql
-- Criar perfil do usuário
INSERT INTO profiles (id, email, name, role)
VALUES (
  'ID_COPIADO_ACIMA', -- Cole o ID aqui
  'admin@cockpit2026.com',
  'Administrador',
  'coordenacao' -- ou 'candidato', 'comunicacao', etc.
);
```

## Passo 6: Configurar Row Level Security (RLS)

Por enquanto, as políticas básicas já estão no schema. Para produção, você precisará ajustar:

1. No Supabase, vá em **Authentication** → **Policies**
2. Revise as políticas criadas
3. Ajuste conforme necessidades de segurança

**Nota**: Por segurança, ajuste as políticas RLS para produção!

## Passo 7: Testar

1. Instale as dependências:
```bash
npm install
```

2. Inicie o servidor:
```bash
npm run dev
```

3. Acesse `http://localhost:3000/login`
4. Faça login com o usuário criado

## Problemas Comuns

### Erro: "Invalid API key"
- Verifique se as variáveis `.env.local` estão corretas
- Reinicie o servidor após alterar `.env.local`

### Erro: "relation does not exist"
- Execute o schema SQL no Supabase
- Verifique se todas as tabelas foram criadas

### Erro de autenticação
- Verifique se o usuário foi criado corretamente
- Confirme que o perfil foi criado na tabela `profiles`

## Próximos Passos

Após configurar:
1. ✅ Criar dados iniciais (cities, campaign_phases)
2. ✅ Testar autenticação
3. ✅ Conectar dashboard a dados reais




