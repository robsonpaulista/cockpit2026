import { createClient } from '@/lib/supabase/server'

export async function fetchMelhorReferenciaServer(
  tema: string,
  formato: string
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

  if (exata && exata.length > 0) return pick(exata)

  const { data: temaMesmo } = await supabase
    .from('referencias_visuais')
    .select('id, imagem_url')
    .eq('tema', tema)
    .eq('formato', formato)
    .eq('ativa', true)
    .order('created_at', { ascending: false })
    .limit(5)

  if (temaMesmo && temaMesmo.length > 0) return pick(temaMesmo)

  const { data: geral } = await supabase
    .from('referencias_visuais')
    .select('id, imagem_url')
    .eq('tema', 'geral')
    .eq('formato', formato)
    .eq('ativa', true)
    .order('created_at', { ascending: false })
    .limit(3)

  if (geral && geral.length > 0) return pick(geral)
  return null
}
