-- Migração: permite nota textual quando não há arquivo no Drive.
ALTER TABLE public.obras_mapa_plano_drive
  ALTER COLUMN drive_file_id DROP NOT NULL;

ALTER TABLE public.obras_mapa_plano_drive
  ADD COLUMN IF NOT EXISTS nota_texto TEXT;

ALTER TABLE public.obras_mapa_plano_drive
  DROP CONSTRAINT IF EXISTS obras_mapa_plano_drive_conteudo_chk;

ALTER TABLE public.obras_mapa_plano_drive
  ADD CONSTRAINT obras_mapa_plano_drive_conteudo_chk CHECK (
    (drive_file_id IS NOT NULL AND length(trim(drive_file_id)) > 0)
    OR (nota_texto IS NOT NULL AND length(trim(nota_texto)) > 0)
  );

COMMENT ON COLUMN public.obras_mapa_plano_drive.nota_texto IS
  'Texto livre quando o plano de trabalho ainda não está disponível no Drive.';
