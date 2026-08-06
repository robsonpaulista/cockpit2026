import { createAdminClient } from '@/lib/supabase/admin'

export type RegistrarArteGeradaInput = {
  conteudoId: string
  /** URL pública do export/preview (PNG/JPG) ou link do design no Canva */
  imagemUrl: string
  /** Link de edição no Canva (opcional; guardado em texto_arte se ainda vazio) */
  canvaEditUrl?: string
  titulo?: string
  textoArte?: string
  legenda?: string
}

/**
 * Registra arte gerada no Canva (ou outra fonte externa) e marca status `gerado`.
 */
export async function registrarArteGeradaMcp(input: RegistrarArteGeradaInput) {
  const conteudoId = input.conteudoId?.trim()
  const imagemUrl = input.imagemUrl?.trim()
  if (!conteudoId) throw new Error('conteudoId é obrigatório')
  if (!imagemUrl) throw new Error('imagemUrl é obrigatório')
  if (!URL.canParse(imagemUrl)) throw new Error('imagemUrl inválida')

  const supabase = createAdminClient()
  const { data: existing, error: eErr } = await supabase
    .from('conteudos_planejados')
    .select('id, status, titulo, texto_arte, legenda, cidade, template, fase, agenda_id')
    .eq('id', conteudoId)
    .maybeSingle()

  if (eErr) throw new Error(eErr.message)
  if (!existing) throw new Error('Conteúdo não encontrado')

  const update: Record<string, unknown> = {
    imagem_url: imagemUrl,
    fundo_origem: 'canva',
    status: 'gerado',
  }

  if (input.titulo?.trim()) update.titulo = input.titulo.trim()
  if (input.textoArte?.trim()) update.texto_arte = input.textoArte.trim()
  if (input.legenda?.trim()) update.legenda = input.legenda.trim()

  const editUrl = input.canvaEditUrl?.trim()
  if (editUrl) {
    if (!URL.canParse(editUrl)) throw new Error('canvaEditUrl inválida')
    const currentTexto = (existing.texto_arte as string | null)?.trim()
    if (!input.textoArte?.trim() && !currentTexto) {
      update.texto_arte = `Canva: ${editUrl}`
    } else if (!input.textoArte?.trim() && currentTexto && !currentTexto.includes(editUrl)) {
      update.texto_arte = `${currentTexto}\nCanva: ${editUrl}`
    }
  }

  const { data, error } = await supabase
    .from('conteudos_planejados')
    .update(update)
    .eq('id', conteudoId)
    .select(
      'id, status, imagem_url, fundo_origem, titulo, texto_arte, legenda, cidade, template, fase, agenda_id',
    )
    .single()

  if (error) throw new Error(error.message)

  return {
    ok: true,
    fonte: 'canva',
    conteudo: data,
    mensagem: 'Arte registrada. Status = gerado.',
  }
}
