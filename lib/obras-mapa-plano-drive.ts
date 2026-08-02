import type { SupabaseClient } from '@supabase/supabase-js'

export type ObraPlanoDriveLink = {
  obra_id: string
  drive_file_id: string | null
  drive_file_name: string | null
  drive_web_view_link: string | null
  nota_texto: string | null
  updated_at?: string
}

const SELECT_COLS =
  'obra_id, drive_file_id, drive_file_name, drive_web_view_link, nota_texto, updated_at'

function mapRow(row: Record<string, unknown>): ObraPlanoDriveLink {
  return {
    obra_id: row.obra_id as string,
    drive_file_id: (row.drive_file_id as string | null) ?? null,
    drive_file_name: (row.drive_file_name as string | null) ?? null,
    drive_web_view_link: (row.drive_web_view_link as string | null) ?? null,
    nota_texto: (row.nota_texto as string | null) ?? null,
    updated_at: row.updated_at as string | undefined,
  }
}

export function planoDriveTemArquivo(link: ObraPlanoDriveLink | null | undefined): boolean {
  return Boolean(link?.drive_file_id?.trim())
}

export function planoDriveTemNota(link: ObraPlanoDriveLink | null | undefined): boolean {
  return Boolean(link?.nota_texto?.trim())
}

export async function listarPlanosDriveObras(
  supabase: SupabaseClient,
): Promise<Map<string, ObraPlanoDriveLink>> {
  const { data, error } = await supabase
    .from('obras_mapa_plano_drive')
    .select(SELECT_COLS)

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      return new Map()
    }
    // Coluna nota_texto ainda não migrada — tenta sem ela.
    if (error.message.includes('nota_texto') || error.code === '42703') {
      const fallback = await supabase
        .from('obras_mapa_plano_drive')
        .select('obra_id, drive_file_id, drive_file_name, drive_web_view_link, updated_at')
      if (fallback.error) throw new Error(fallback.error.message)
      return new Map(
        (fallback.data ?? []).map((row) => [
          row.obra_id as string,
          mapRow({ ...row, nota_texto: null }),
        ]),
      )
    }
    throw new Error(error.message)
  }

  return new Map(
    (data ?? []).map((row) => [row.obra_id as string, mapRow(row as Record<string, unknown>)]),
  )
}

export async function salvarPlanoDriveObra(
  supabase: SupabaseClient,
  opts: {
    obraId: string
    driveFileId?: string | null
    driveFileName?: string | null
    driveWebViewLink?: string | null
    notaTexto?: string | null
    userId: string
  },
): Promise<ObraPlanoDriveLink> {
  const driveFileId = opts.driveFileId?.trim() || null
  const notaTexto = opts.notaTexto?.trim() || null

  if (!driveFileId && !notaTexto) {
    throw new Error('Informe um arquivo do Drive ou um texto sobre o plano.')
  }

  const payload = {
    obra_id: opts.obraId,
    drive_file_id: driveFileId,
    drive_file_name: driveFileId ? opts.driveFileName?.trim() || null : null,
    drive_web_view_link: driveFileId ? opts.driveWebViewLink?.trim() || null : null,
    nota_texto: driveFileId ? null : notaTexto,
    updated_at: new Date().toISOString(),
    updated_by: opts.userId,
  }

  const { data, error } = await supabase
    .from('obras_mapa_plano_drive')
    .upsert(payload, { onConflict: 'obra_id' })
    .select(SELECT_COLS)
    .single()

  if (error) throw new Error(error.message)

  return mapRow(data as Record<string, unknown>)
}

export async function removerPlanoDriveObra(
  supabase: SupabaseClient,
  obraId: string,
): Promise<void> {
  const { error } = await supabase
    .from('obras_mapa_plano_drive')
    .delete()
    .eq('obra_id', obraId)
  if (error) throw new Error(error.message)
}
