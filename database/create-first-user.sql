-- ============================================
-- CRIAR PRIMEIRO USUÁRIO - COCKPIT 2026
-- ============================================
-- Este script cria um usuário administrador
-- Execute no SQL Editor do Supabase

-- IMPORTANTE: Substitua os valores abaixo pelos seus dados:

-- 1. Defina o email e senha do administrador
DO $$
DECLARE
  user_email TEXT := 'admin@cockpit2026.com';  -- ALTERE AQUI
  user_password TEXT := 'SenhaSegura123!';      -- ALTERE AQUI
  user_name TEXT := 'Administrador';
  user_role TEXT := 'coordenacao';              -- ou 'candidato', 'comunicacao', etc.
  new_user_id UUID;
BEGIN
  -- Criar usuário no auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    user_email,
    crypt(user_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO new_user_id;

  -- Criar perfil do usuário
  INSERT INTO public.profiles (
    id,
    email,
    name,
    role
  ) VALUES (
    new_user_id,
    user_email,
    user_name,
    user_role
  );

  -- Confirmar criação
  RAISE NOTICE 'Usuário criado com sucesso!';
  RAISE NOTICE 'Email: %', user_email;
  RAISE NOTICE 'ID: %', new_user_id;
  RAISE NOTICE 'Role: %', user_role;
END $$;

-- ============================================
-- VERIFICAR SE O USUÁRIO FOI CRIADO
-- ============================================
-- Execute este SELECT para ver o usuário criado:

SELECT 
  p.id,
  p.email,
  p.name,
  p.role,
  u.email_confirmed_at,
  u.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 5;

