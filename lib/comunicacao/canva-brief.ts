import { createAdminClient } from '@/lib/supabase/admin'
import { generateCardText } from '@/lib/conteudo/groq'
import {
  catalogoBibliotecaComunicacao,
  resolverTemplateComunicacao,
} from '@/lib/comunicacao/catalogo'
import { formatoFromLegacy } from '@/lib/comunicacao/types'

function formatoParaReferencia(formato: string | null): string {
  if (formato === 'story') return 'story'
  if (formato === 'reels_capa') return 'reels_capa'
  return 'feed'
}

function temaDeDescricao(descricao: string | null, obraTipo: string | null): string {
  const blob = `${descricao ?? ''} ${obraTipo ?? ''}`.toLowerCase()
  if (/asfalt|paviment|via|rua/.test(blob)) return 'pavimentacao'
  if (/sa[uú]de|ubs|hospital/.test(blob)) return 'saude'
  if (/escol|educ/.test(blob)) return 'educacao'
  if (/saneam|esgoto|agua|água/.test(blob)) return 'saneamento'
  if (/ilumin/.test(blob)) return 'iluminacao'
  if (/turism/.test(blob)) return 'turismo'
  return 'geral'
}

async function buscarImagemReferencia(
  tema: string,
  formato: string
): Promise<{ id: string; imagem_url: string } | null> {
  const supabase = createAdminClient()
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

/**
 * Brief completo para o Claude preencher um template Canva mestre
 * (só textos + cidade + imagem principal).
 */
export async function obterBriefProducao(conteudoId: string) {
  const supabase = createAdminClient()
  const { data: row, error } = await supabase
    .from('conteudos_planejados')
    .select(
      `
      id,
      agenda_id,
      cidade,
      territorio,
      fase,
      formato,
      template,
      titulo,
      texto_arte,
      legenda,
      status,
      data_sugerida,
      agendas (
        date,
        description,
        hora_evento,
        cities ( name ),
        obras ( obra, municipio, tipo, status, valor_total, parceiro, imagem_url )
      )
    `
    )
    .eq('id', conteudoId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!row) throw new Error('Conteúdo não encontrado')

  const agendasJoin = row.agendas as
    | {
        date?: string
        description?: string
        hora_evento?: string
        cities?: { name?: string } | { name?: string }[]
        obras?:
          | {
              obra?: string
              municipio?: string
              tipo?: string
              status?: string
              valor_total?: number
              parceiro?: string
              imagem_url?: string
            }
          | {
              obra?: string
              municipio?: string
              tipo?: string
              status?: string
              valor_total?: number
              parceiro?: string
              imagem_url?: string
            }[]
      }
    | null
  const agenda = Array.isArray(agendasJoin) ? agendasJoin[0] : agendasJoin
  const cities = agenda?.cities
  const cityObj = Array.isArray(cities) ? cities[0] : cities
  const obras = agenda?.obras
  const obraObj = Array.isArray(obras) ? obras[0] : obras

  const cidade =
    (row.cidade as string | null)?.trim() ||
    cityObj?.name?.trim() ||
    obraObj?.municipio?.trim() ||
    'Município'

  const tema = temaDeDescricao(
    (agenda?.description as string | null) ?? null,
    obraObj?.tipo ?? null
  )
  const formatoRef = formatoParaReferencia((row.formato as string | null) ?? null)

  let imagemPrincipal: {
    url: string
    origem: 'obra' | 'referencia'
    referenciaId?: string
  } | null = null

  if (obraObj?.imagem_url) {
    imagemPrincipal = { url: obraObj.imagem_url, origem: 'obra' }
  } else {
    const ref = await buscarImagemReferencia(tema, formatoRef)
    if (ref) {
      imagemPrincipal = {
        url: ref.imagem_url,
        origem: 'referencia',
        referenciaId: ref.id,
      }
    }
  }

  let textos = {
    titulo: (row.titulo as string | null)?.trim() || '',
    texto_arte: (row.texto_arte as string | null)?.trim() || '',
    legenda: (row.legenda as string | null)?.trim() || '',
  }

  const precisaTexto = !textos.titulo || !textos.texto_arte
  if (precisaTexto) {
    try {
      const gerados = await generateCardText({
        cidade,
        territorio: (row.territorio as string | null) ?? undefined,
        tipo: obraObj?.tipo || 'obra',
        status: obraObj?.status || 'em andamento',
        template: String(row.template || 'cidade_beneficiada'),
        fase: String(row.fase || 'antes'),
        parceiro: obraObj?.parceiro,
        valor: obraObj?.valor_total,
      })
      textos = {
        titulo: textos.titulo || gerados.titulo,
        texto_arte: textos.texto_arte || gerados.texto_arte,
        legenda: textos.legenda || gerados.legenda,
      }
    } catch {
      if (!textos.titulo) textos.titulo = `${cidade} em movimento`
      if (!textos.texto_arte) {
        textos.texto_arte =
          (agenda?.description as string | null)?.trim() ||
          `Visita técnica em ${cidade}`
      }
    }
  }

  const resolved = await resolverTemplateComunicacao({
    legacyTemplate: row.template as string | null,
    legacyFormato: row.formato as string | null,
  })
  const tpl = resolved?.template ?? null
  const cat = resolved?.categoria ?? null
  const regra = resolved?.regra ?? ''

  const templateConfigurado = Boolean(tpl?.canvaDesignUrl || tpl?.canvaBrandTemplateId)

  const preencher: Record<string, unknown> = {
    cidade,
    titulo: textos.titulo,
    subtitulo: null,
    descricao: textos.texto_arte,
    numero: obraObj?.valor_total != null ? String(obraObj.valor_total) : null,
    metragem: null,
    rua: null,
    data: agenda?.date ?? row.data_sugerida ?? null,
    parceiro: obraObj?.parceiro ?? null,
    logo: null,
    foto_principal: imagemPrincipal,
    foto_secundaria: null,
    cta: null,
    qr_code: null,
    hashtag: null,
    assinatura: null,
    legenda: textos.legenda,
  }

  return {
    regra,
    conteudoId: String(row.id),
    statusAtual: String(row.status),
    cidade,
    fase: row.fase,
    formatoLegado: row.formato,
    templateLegado: row.template,
    agenda: {
      id: row.agenda_id,
      date: agenda?.date ?? row.data_sugerida,
      description: agenda?.description ?? null,
      hora_evento: agenda?.hora_evento ?? null,
      obra: obraObj?.obra ?? null,
    },
    comunicacao: {
      codigoTpl: tpl?.codigo ?? null,
      categoria: cat?.codigo ?? null,
      versao: tpl?.versao ?? 'V1',
      formato: tpl?.formato ?? formatoFromLegacy(row.formato as string | null),
      pastaCanva: cat?.pastaCanva ?? null,
      objetivo: cat?.objetivo ?? null,
      quandoUsar: cat?.quandoUsar ?? null,
      nomeCanva: tpl?.nomeCanva ?? null,
      canvaDesignUrl: tpl?.canvaDesignUrl ?? null,
      canvaBrandTemplateId: tpl?.canvaBrandTemplateId ?? null,
      templateConfigurado,
      slots: tpl?.slots ?? [],
      aviso: templateConfigurado
        ? null
        : 'URL/ID Canva ainda não cadastrados neste TPL. No Canva, use o nomeCanva na pasta do objetivo; depois grave canva_design_url em comunicacao_templates.',
    },
    preencher,
    aposGerar: {
      tool: 'registrar_arte_gerada',
      conteudoId: String(row.id),
      codigoTpl: tpl?.codigo ?? null,
      campos: ['imagemUrl', 'canvaEditUrl', 'titulo', 'textoArte', 'legenda'],
    },
  }
}

export async function listarCatalogoTemplatesCanva() {
  return catalogoBibliotecaComunicacao()
}
