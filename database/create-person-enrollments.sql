-- Cadastro de pessoas para reconhecimento facial (Cockpit 2026)
-- Executar no Supabase se persons/face_descriptors já existirem do PhotoFinder.

ALTER TABLE public.persons
  ADD COLUMN IF NOT EXISTS role_tag text,
  ADD COLUMN IF NOT EXISTS reference_image_path text,
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.persons.role_tag IS 'Cargo, função ou tag (ex.: Deputado, Assessor)';
COMMENT ON COLUMN public.persons.reference_image_path IS 'Caminho no Storage da foto de referência do rosto';
COMMENT ON COLUMN public.persons.notes IS 'Observações internas';

-- Embeddings de cadastro (photo_id NULL) vs rostos detectados em fotos do Drive (photo_id preenchido)
CREATE INDEX IF NOT EXISTS idx_face_descriptors_enrollment
  ON public.face_descriptors (person_id)
  WHERE photo_id IS NULL;

-- Bucket Supabase Storage: criado automaticamente no primeiro cadastro de rosto.
-- Ou crie manualmente no painel: person-enrollments (privado).