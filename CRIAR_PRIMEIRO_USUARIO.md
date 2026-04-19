# 👤 Como Criar o Primeiro Usuário no Supabase

## 🎯 Método 1: Interface do Supabase (RECOMENDADO - Mais Fácil)

### Passo a Passo:

1. **Acesse o Painel do Supabase**
   - Vá em [supabase.com](https://supabase.com)
   - Entre no seu projeto

2. **Vá em Authentication**
   - No menu lateral, clique em **Authentication**
   - Depois clique em **Users**

3. **Criar Novo Usuário**
   - Clique no botão **"Add user"** (ou "New user")
   - Selecione **"Create new user"**

4. **Preencher Dados**
   ```
   Email: admin@cockpit2026.com
   Password: SuaSenhaSegura123!
   Auto Confirm User: ✅ (MARCAR ESTA OPÇÃO)
   ```
   - ⚠️ **IMPORTANTE**: Marque "Auto Confirm User" para poder fazer login imediatamente

5. **Criar Usuário**
   - Clique em **"Create user"**
   - ✅ Usuário criado!

6. **Criar Perfil no Banco**
   - Copie o **UUID** do usuário criado (aparece na lista de usuários)
   - Vá em **SQL Editor** no Supabase
   - Execute o script abaixo (substituindo `USER_UUID_AQUI` pelo UUID real):

```sql
-- Cole o UUID do usuário que você copiou
INSERT INTO public.profiles (id, email, name, role)
VALUES (
  'USER_UUID_AQUI',  -- ⚠️ SUBSTITUA PELO UUID REAL
  'admin@cockpit2026.com',
  'Administrador',
  'coordenacao'  -- Opções: 'candidato', 'coordenacao', 'comunicacao', 'articulacao', 'juridico', 'bi'
);
```

7. **Pronto!** ✅
   - Agora você pode fazer login na aplicação

---

## 🔧 Método 2: Via SQL (Avançado)

Se preferir criar tudo via SQL:

1. **Abra o SQL Editor** no Supabase

2. **Execute o script** em `database/create-first-user.sql`

3. **IMPORTANTE**: Antes de executar, edite as variáveis:
   ```sql
   user_email TEXT := 'seu@email.com';      -- ALTERE
   user_password TEXT := 'SuaSenha123!';    -- ALTERE
   user_name TEXT := 'Seu Nome';            -- ALTERE
   user_role TEXT := 'coordenacao';         -- ALTERE se necessário
   ```

4. **Execute o script**
   - Clique em "Run" ou pressione F5
   - Verifique se apareceu mensagem de sucesso

5. **Verificar criação**
   - Execute o SELECT no final do arquivo para confirmar

---

## 🎭 Perfis Disponíveis (Role)

Escolha um dos perfis ao criar:

- `candidato` - Acesso total (candidato principal)
- `coordenacao` - Coordenação geral (recomendado para primeiro usuário)
- `comunicacao` - Equipe de comunicação
- `articulacao` - Equipe de articulação/campo
- `juridico` - Equipe jurídica
- `bi` - BI/Inteligência (análise de dados)

---

## ✅ Verificar se Funcionou

### 1. No Supabase
Execute este SQL para ver os usuários:

```sql
SELECT 
  p.id,
  p.email,
  p.name,
  p.role,
  u.email_confirmed_at,
  u.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY u.created_at DESC;
```

### 2. Na Aplicação
1. Certifique-se de que `.env.local` está configurado
2. Inicie o servidor: `npm run dev`
3. Acesse `http://localhost:3000`
4. Será redirecionado para `/login`
5. Faça login com:
   - Email: `admin@cockpit2026.com` (ou o que você definiu)
   - Senha: `SuaSenhaSegura123!` (ou a que você definiu)

---

## 🐛 Problemas Comuns

### Erro: "Invalid login credentials"
- Verifique se o email está correto
- Verifique se marcou "Auto Confirm User" ao criar
- Tente resetar a senha pelo Supabase

### Erro: "User profile not found"
- Você precisa executar o INSERT na tabela `profiles`
- Verifique se o UUID está correto
- Execute o SELECT acima para verificar

### Erro: "User not found in profiles"
- Execute o INSERT na tabela `profiles` com o UUID correto
- Verifique se a tabela `profiles` existe (deve existir se rodou o schema)

### Não consigo criar usuário via SQL
- Use o Método 1 (Interface) que é mais fácil
- Verifique permissões do seu projeto Supabase

---

## 📝 Próximos Passos

Após criar o usuário:

1. ✅ Testar login na aplicação
2. ✅ Verificar se o dashboard carrega
3. ✅ Começar a usar o sistema!

---

**Dica**: Mantenha as credenciais seguras e não commite no Git!




