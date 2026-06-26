import { createAdminClient } from '@/lib/supabase/admin'

export const PERSON_ENROLLMENTS_BUCKET = 'person-enrollments'

export interface PessoaRow {
  id: string
  name: string
  role_tag?: string | null
  reference_image_path?: string | null
  notes?: string | null
  photo_count: number
  created_at: string
  updated_at: string
}

export async function countEnrollmentsByPerson(
  supabase: ReturnType<typeof createAdminClient>,
  personIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (personIds.length === 0) return counts

  const { data } = await supabase
    .from('face_descriptors')
    .select('person_id')
    .in('person_id', personIds)
    .is('photo_id', null)

  for (const row of data ?? []) {
    const pid = row.person_id as string
    counts.set(pid, (counts.get(pid) ?? 0) + 1)
  }
  return counts
}

export async function ensurePersonEnrollmentsBucket(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const { data: bucket } = await supabase.storage.getBucket(PERSON_ENROLLMENTS_BUCKET)
  if (bucket) return

  const { error } = await supabase.storage.createBucket(PERSON_ENROLLMENTS_BUCKET, {
    public: false,
    fileSizeLimit: '10485760',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  })

  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw new Error(`Não foi possível criar bucket ${PERSON_ENROLLMENTS_BUCKET}: ${error.message}`)
  }
}

export async function referenceImageUrl(
  supabase: ReturnType<typeof createAdminClient>,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null
  const { data } = await supabase.storage.from(PERSON_ENROLLMENTS_BUCKET).createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

export async function mapPessoaRow(
  supabase: ReturnType<typeof createAdminClient>,
  row: PessoaRow,
  enrollmentCount: number,
) {
  return {
    id: row.id,
    name: row.name,
    role_tag: row.role_tag ?? null,
    notes: row.notes ?? null,
    reference_image_path: row.reference_image_path ?? null,
    photo_count: row.photo_count ?? 0,
    enrollment_count: enrollmentCount,
    reference_image_url: await referenceImageUrl(supabase, row.reference_image_path),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
