import {
  buildComunicaCertidaoUrl,
  buildComunicaConsultaUrl,
  defaultComunicaDateRange,
  getComunicaInfoFromProcesso,
  type ComunicacaoProcessual,
  type ComunicacoesProcessoResponse,
} from '@/lib/juridico-comunica'
import { mergeUltimaComunicacaoDjen } from '@/lib/juridico-links-consulta'
import type { ProcessoDimensao } from '@/lib/juridico-processos-dimensao'

const COMUNICA_API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'

type ComunicaApiItem = {
  id?: number
  hash?: string
  data_disponibilizacao?: string
  siglaTribunal?: string
  tipoComunicacao?: string
  nomeOrgao?: string
  numero_processo?: string
  numeroprocessocommascara?: string
  meiocompleto?: string
  tipoDocumento?: string
  nomeClasse?: string
  texto?: string
  link?: string
  destinatarios?: Array<{ nome?: string; polo?: string }>
  destinatarioadvogados?: Array<{ advogado?: { nome?: string; numero_oab?: string; uf_oab?: string } }>
}

type ComunicaApiResponse = {
  status?: string
  count?: number
  items?: ComunicaApiItem[]
  message?: string
}

function resumirTexto(texto: string, max = 420): string {
  const t = texto.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function normalizeItem(raw: ComunicaApiItem): ComunicacaoProcessual | null {
  const hash = raw.hash?.trim()
  if (!hash) return null
  const destinatarios = (raw.destinatarios ?? [])
    .map((d) => d.nome?.trim())
    .filter((n): n is string => Boolean(n))
  const advogados = (raw.destinatarioadvogados ?? [])
    .map((a) => {
      const adv = a.advogado
      if (!adv?.nome) return null
      const oab = adv.numero_oab && adv.uf_oab ? ` — OAB ${adv.uf_oab}-${adv.numero_oab}` : ''
      return `${adv.nome}${oab}`
    })
    .filter((n): n is string => Boolean(n))

  return {
    id: raw.id ?? 0,
    hash,
    dataDisponibilizacao:
      raw.data_disponibilizacao ??
      (raw as { datadisponibilizacao?: string }).datadisponibilizacao ??
      '',
    siglaTribunal: raw.siglaTribunal ?? '',
    tipoComunicacao: raw.tipoComunicacao ?? 'Comunicação',
    nomeOrgao: raw.nomeOrgao ?? '',
    numeroProcesso: raw.numero_processo ?? '',
    numeroProcessoFormatado: raw.numeroprocessocommascara ?? null,
    meioCompleto: raw.meiocompleto ?? null,
    tipoDocumento: raw.tipoDocumento ?? null,
    nomeClasse: raw.nomeClasse ?? null,
    textoResumo: resumirTexto(raw.texto ?? ''),
    linkPjeDocumento: raw.link?.trim() || null,
    certidaoUrl: buildComunicaCertidaoUrl(hash),
    destinatarios,
    advogados,
  }
}

export async function fetchComunicacoesProcesso(
  processo: Pick<ProcessoDimensao, 'processo' | 'orgaoJulgador'>
): Promise<ComunicacoesProcessoResponse> {
  const { sigla, numeroApi } = getComunicaInfoFromProcesso(processo.processo, processo.orgaoJulgador)

  if (!numeroApi) {
    return {
      ok: false,
      count: 0,
      consultaComunicaUrl: null,
      comunicacoes: [],
      aviso: 'Número de processo inválido para consulta no Comunica (CNJ).',
    }
  }

  if (!sigla) {
    return {
      ok: false,
      count: 0,
      consultaComunicaUrl: null,
      comunicacoes: [],
      aviso: 'Tribunal não identificado para a API de Comunicações Processuais (DJEN).',
    }
  }

  const range = defaultComunicaDateRange()
  const params = new URLSearchParams({
    numeroProcesso: numeroApi,
    siglaTribunal: sigla,
    pagina: '1',
    itensPorPagina: '30',
    dataDisponibilizacaoInicio: range.inicio,
    dataDisponibilizacaoFim: range.fim,
  })

  const consultaComunicaUrl = buildComunicaConsultaUrl({
    numeroProcesso: numeroApi,
    siglaTribunal: sigla,
    dataInicio: range.inicio,
    dataFim: range.fim,
  })

  try {
    const res = await fetch(`${COMUNICA_API}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!res.ok) {
      return {
        ok: false,
        count: 0,
        consultaComunicaUrl,
        comunicacoes: [],
        aviso: `Comunica API retornou ${res.status}. Tente a consulta manual no portal.`,
      }
    }

    const json = (await res.json()) as ComunicaApiResponse
    const comunicacoes = (json.items ?? [])
      .map(normalizeItem)
      .filter((c): c is ComunicacaoProcessual => c !== null)
      .sort((a, b) => b.dataDisponibilizacao.localeCompare(a.dataDisponibilizacao))

    return {
      ok: true,
      count: json.count ?? comunicacoes.length,
      consultaComunicaUrl,
      comunicacoes,
      aviso:
        comunicacoes.length === 0
          ? 'Nenhuma comunicação publicada no DJEN para este processo no período consultado.'
          : null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro de rede'
    return {
      ok: false,
      count: 0,
      consultaComunicaUrl,
      comunicacoes: [],
      aviso: `Falha ao consultar Comunica: ${msg}`,
    }
  }
}

const DJEN_ENRICH_CONCURRENCY = 8

function formatDataDjenApi(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  return iso
}

/** Preenche link DJEN com certidão PDF da comunicação mais recente (quando a API retorna). */
export async function enrichProcessosComUltimaDjen<T extends ProcessoDimensao>(
  processos: T[]
): Promise<T[]> {
  const result = [...processos]
  for (let i = 0; i < result.length; i += DJEN_ENRICH_CONCURRENCY) {
    const batch = result.slice(i, i + DJEN_ENRICH_CONCURRENCY)
    await Promise.all(
      batch.map(async (p, bi) => {
        const links = p.linksConsulta
        if (!links?.djenConsultaUrl) return
        try {
          const res = await fetchComunicacoesProcesso(p)
          const u = res.comunicacoes[0]
          if (!u?.hash) return
          result[i + bi] = {
            ...p,
            linksConsulta: mergeUltimaComunicacaoDjen(
              links,
              u.hash,
              u.tipoComunicacao,
              formatDataDjenApi(u.dataDisponibilizacao)
            ),
          } as T
        } catch {
          /* mantém link de busca no portal */
        }
      })
    )
  }
  return result
}
