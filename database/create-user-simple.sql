-- ============================================
-- MÉTODO SIMPLES: Criar usuário via Supabase Auth
-- ============================================
-- 
-- RECOMENDADO: Use a interface do Supabase em vez de SQL
-- 
-- 1. Vá em Authentication > Users
-- 2. Clique em "Add user" > "Create new user"
-- 3. Preencha:
--    - Email: admin@cockpit2026.com
--    - Password: (sua senha)
--    - Auto Confirm User: SIM (marcar)
-- 4. Clique em "Create user"
-- 
-- 5. Depois, copie o UUID do usuário criado e execute:
--    (substitua 'USER_UUID_AQUI' pelo UUID real)

-- INSERT INTO public.profiles (id, email, name, role)
-- VALUES (
--   'USER_UUID_AQUI',  -- Cole o UUID do usuário aqui
--   'admin@cockpit2026.com',
--   'Administrador',
--   'coordenacao'  -- ou 'candidato', 'comunicacao', 'articulacao', 'juridico', 'bi'
-- );

-- ============================================
-- ALTERNATIVA: Via SQL direto (mais complexo)
-- ============================================

-- Nota: Este método requer permissões especiais no Supabase
-- É mais fácil usar a interface web

-- Para usar via SQL, veja: create-first-user.sql




