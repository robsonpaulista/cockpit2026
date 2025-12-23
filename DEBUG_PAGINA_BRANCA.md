# 🐛 Debug: Página Branca / Loading Infinito

## Problema
Após login, a página fica em "Carregando..." indefinidamente.

## Correções Aplicadas ✅

1. ✅ `fetchProfile` movido para antes do `useEffect`
2. ✅ Timeout de segurança de 5 segundos
3. ✅ Tratamento de erros melhorado
4. ✅ Proteção contra loops infinitos

## Verificações Necessárias

### 1. Verificar RLS (Row Level Security) no Supabase

O problema pode ser que o RLS está bloqueando a consulta à tabela `profiles`.

**No Supabase SQL Editor, execute:**

```sql
-- Verificar se há políticas na tabela profiles
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Temporariamente desabilitar RLS para testar (APENAS PARA DEBUG!)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Ou criar política permissiva temporária:
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
CREATE POLICY "Enable read access for authenticated users"
ON profiles FOR SELECT
TO authenticated
USING (true);
```

### 2. Verificar se o perfil existe

```sql
-- Ver todos os perfis
SELECT * FROM profiles;

-- Ver se seu usuário tem perfil
SELECT 
  u.id,
  u.email,
  p.name,
  p.role
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email = 'seu@email.com';
```

### 3. Verificar Console do Navegador (F12)

Abra o DevTools (F12) e veja:
- **Console**: Procure por erros em vermelho
- **Network**: Veja se a requisição para buscar perfil está falhando

### 4. Verificar Variáveis de Ambiente

Certifique-se que `.env.local` está configurado:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_aqui
```

E **reinicie o servidor** após alterar!

## Solução Rápida de Teste

Se quiser testar rapidamente sem perfil:

1. **Temporariamente desabilitar verificação de perfil**

Edite `components/protected-route.tsx` e comente a verificação:

```typescript
// Temporariamente permitir acesso mesmo sem perfil
if (!user) {
  router.push('/login')
  return
}
// if (user && !user.profile) { ... } // COMENTAR ESTA LINHA
```

2. **Ou criar perfil via SQL:**

```sql
-- Pegue o UUID do seu usuário em Authentication > Users
INSERT INTO profiles (id, email, name, role)
VALUES (
  'UUID_DO_USUARIO_AQUI',
  'seu@email.com',
  'Administrador',
  'coordenacao'
);
```

## Logs de Debug

O código agora tem logs. Veja no console do navegador:
- `[useAuth] Timeout: forçando parar loading após 5s` - se o timeout ativou
- `Erro ao buscar perfil:` - se há erro ao buscar
- `Erro ao buscar usuário:` - se há erro de autenticação

## Próximos Passos

1. **Verifique o console do navegador** (F12)
2. **Verifique as políticas RLS** no Supabase
3. **Teste criando o perfil manualmente** via SQL
4. **Me avise o que aparece no console!**




