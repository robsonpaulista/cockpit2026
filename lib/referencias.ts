import { createClient } from '@/lib/supabase/client'

export type ReferenciaTema =
  | 'pavimentacao'
  | 'turismo'
  | 'saude'
  | 'educacao'
  | 'saneamento'
  | 'iluminacao'
  | 'geral'

export type ReferenciaFormato = 'feed' | 'story' | 'reels_capa'
export type ReferenciaEngajamento = 'alto' | 'medio' | 'baixo'
export type ReferenciaOrigem = 'instagram' | 'criado_no_cockpit'

export async function uploadReferencia(
  file: File,
  meta: {
    tema: ReferenciaTema
    formato: ReferenciaFormato
    engajamento: ReferenciaEngajamento
    origem: ReferenciaOrigem
    observacoes?: string
  }
) {
  const form = new FormData()
  form.append('file', file)
  form.append('tema', meta.tema)
  form.append('formato', meta.formato)
  form.append('engajamento', meta.engajamento)
  form.append('origem', meta.origem)
  if (meta.observacoes) form.append('observacoes', meta.observacoes)

  const res = await fetch('/api/conteudo/referencias', {
    method: 'POST',
    body: form,
  })
  const json = (await res.json()) as { error?: string; details?: unknown }

  if (!res.ok) {
    throw new Error(json.error || 'Erro ao fazer upload da referência.')
  }

  return json
}

export async function fetchMelhorReferencia(
  tema: ReferenciaTema,
  formato: ReferenciaFormato
): Promise<{ id: string; imagem_url: string } | null> {
  const supabase = createClient()
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

  const { data: exata } = await supabase
    .from('referencias_visuais')
    .select('id, imagem_url')
    .eq('tema', tema)
    .eq('formato', formato)
    .eq('engajamento', 'alto')
    .eq('ativa', true)
    .order('created_at', { ascending: false })
    .limit(5)

  if (exata && exata.length > 0) {
    return pick(exata)
  }

  const { data: temaMesmo } = await supabase
    .from('referencias_visuais')
    .select('id, imagem_url')
    .eq('tema', tema)
    .eq('formato', formato)
    .eq('ativa', true)
    .order('created_at', { ascending: false })
    .limit(5)

  if (temaMesmo && temaMesmo.length > 0) {
    return pick(temaMesmo)
  }

  const { data: geral } = await supabase
    .from('referencias_visuais')
    .select('id, imagem_url')
    .eq('tema', 'geral')
    .eq('formato', formato)
    .eq('ativa', true)
    .order('created_at', { ascending: false })
    .limit(3)

  if (geral && geral.length > 0) {
    return pick(geral)
  }

  return null
}
