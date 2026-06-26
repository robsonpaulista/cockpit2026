import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encodeFaceFromRequestFile } from '@/lib/recface-engine'
import {
  countEnrollmentsByPerson,
  ensurePersonEnrollmentsBucket,
  mapPessoaRow,
  PERSON_ENROLLMENTS_BUCKET,
} from '@/lib/pessoas-server'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const form = await request.formData()
    const image = form.get('image')

    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ error: 'Envie uma foto com rosto visível' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: person, error: personError } = await supabase.from('persons').select('*').eq('id', id).single()
    if (personError || !person) {
      return NextResponse.json({ error: 'Pessoa não encontrada' }, { status: 404 })
    }

    let encoded
    try {
      encoded = await encodeFaceFromRequestFile(image)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível detectar rosto na imagem'
      return NextResponse.json({ error: msg }, { status: 422 })
    }

    const ext = image.name.split('.').pop()?.toLowerCase() || 'jpg'
    const storagePath = `${id}/reference-${Date.now()}.${ext}`
    const buffer = Buffer.from(await image.arrayBuffer())

    await ensurePersonEnrollmentsBucket(supabase)

    const { error: uploadError } = await supabase.storage
      .from(PERSON_ENROLLMENTS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: image.type || 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      console.warn('pessoas enroll storage:', uploadError.message)
      return NextResponse.json(
        {
          error: `Falha ao salvar foto no storage: ${uploadError.message}. Verifique permissões do Supabase Storage.`,
        },
        { status: 500 },
      )
    }

    const oldPath = person.reference_image_path as string | null
    if (oldPath && oldPath !== storagePath) {
      await supabase.storage.from(PERSON_ENROLLMENTS_BUCKET).remove([oldPath]).catch(() => undefined)
    }

    await supabase.from('face_descriptors').delete().eq('person_id', id).is('photo_id', null)

    const { error: descriptorError } = await supabase.from('face_descriptors').insert({
      person_id: id,
      photo_id: null,
      face_vector: encoded.vector,
      bounding_box: encoded.boundingBox,
      confidence: 1,
    })

    if (descriptorError) throw descriptorError

    const personUpdates: Record<string, unknown> = { reference_image_path: storagePath }

    let updatedPerson = person
    if (Object.keys(personUpdates).length > 0) {
      const { data, error: updateError } = await supabase
        .from('persons')
        .update(personUpdates)
        .eq('id', id)
        .select('*')
        .single()
      if (updateError) throw updateError
      updatedPerson = data
    }

    const counts = await countEnrollmentsByPerson(supabase, [id])
    const pessoa = await mapPessoaRow(supabase, updatedPerson as Parameters<typeof mapPessoaRow>[1], counts.get(id) ?? 0)
    return NextResponse.json(pessoa)
  } catch (error) {
    console.error('pessoas enroll:', error)
    const msg =
      error instanceof Error && error.message.includes('fetch failed')
        ? 'Serviço de reconhecimento facial offline. Execute: npm run recface:server'
        : 'Falha ao cadastrar rosto'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
