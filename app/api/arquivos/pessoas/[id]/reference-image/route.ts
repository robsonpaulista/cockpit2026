import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERSON_ENROLLMENTS_BUCKET } from '@/lib/pessoas-server'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = createAdminClient()
    const { data: person, error } = await supabase
      .from('persons')
      .select('reference_image_path')
      .eq('id', id)
      .single()

    if (error || !person?.reference_image_path) {
      return new NextResponse(null, { status: 404 })
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from(PERSON_ENROLLMENTS_BUCKET)
      .download(person.reference_image_path as string)

    if (downloadError || !file) {
      return new NextResponse(null, { status: 404 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': file.type || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('pessoas reference-image:', error)
    return new NextResponse(null, { status: 500 })
  }
}
