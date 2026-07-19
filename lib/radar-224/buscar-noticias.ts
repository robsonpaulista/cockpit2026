/**
 * Busca notícias do Radar 224 via Google News RSS
 * + filtro obrigatório de menção ao município (anti-ruído).
 */

import { fetchGoogleNewsRss } from '@/lib/google-news-rss'
import { listRadarFontesSeed } from '@/lib/radar-224/fontes-seed'
import {
  avaliarRelevanciaMunicipio,
  municipioAmbiguo,
} from '@/lib/radar-224/relevancia-municipio'
import type { RadarFonte } from '@/lib/radar-224/types'

export type RadarNoticiaItem = {
  articleId: string
  title: string
  url: string
  summary: string | null
  publishedAt: string | null
  sourceName: string | null
  municipio: string
  fonteId: string
  fonteNome: string
  fonteDominio: string
  fonteCamada: RadarFonte['camada']
  searchQuery: string
  mencaoNoTitulo: boolean
}

const PAUSE_MS = 900
/** Janela máxima de interesse para o Radar 224. */
export const RADAR_224_JANELA_DIAS = 30
const MS_DIA = 24 * 60 * 60 * 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Query: frase exata + Piauí + janela Google News (when:30d). */
function buildQuery(municipio: string, dominio: string): string {
  const cidade = municipio.trim()
  if (municipioAmbiguo(cidade)) {
    // Força âncora municipal — evita "seleção brasileira", "mulher brasileira" etc.
    return (
      `site:${dominio} ` +
      `("${cidade}" Piauí OR "${cidade}-PI" OR "${cidade} (PI)" OR ` +
      `"município de ${cidade}" OR "prefeitura de ${cidade}") ` +
      `when:${RADAR_224_JANELA_DIAS}d`
    )
  }
  return `site:${dominio} ("${cidade}") (Piauí OR "PI") when:${RADAR_224_JANELA_DIAS}d`
}

/** Publicação nos últimos N dias (descarta sem data ou data inválida). */
export function publicadoNaJanela(
  publishedAt: string | null | undefined,
  opts?: { dias?: number; agora?: number },
): boolean {
  if (!publishedAt) return false
  const t = Date.parse(publishedAt)
  if (!Number.isFinite(t)) return false
  const agora = opts?.agora ?? Date.now()
  const dias = opts?.dias ?? RADAR_224_JANELA_DIAS
  // tolera fuso/clock skew de até 1 dia no futuro
  if (t > agora + MS_DIA) return false
  return t >= agora - dias * MS_DIA
}

function fontesParaBusca(opts?: {
  apenasEstaduais?: boolean
  municipio?: string
}): RadarFonte[] {
  const ativas = listRadarFontesSeed({ status: ['ativa', 'candidata'] }).filter(
    (f) =>
      Boolean(f.dominio) &&
      (f.camada === 'estadual' || f.camada === 'regional' || f.camada === 'local'),
  )

  if (opts?.apenasEstaduais) {
    return ativas.filter((f) => f.camada === 'estadual' && f.status === 'ativa')
  }

  const municipio = opts?.municipio?.trim()
  if (!municipio) {
    return ativas.filter((f) => f.camada === 'estadual' && f.status === 'ativa')
  }

  const key = municipio
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  const estaduais = ativas.filter((f) => f.camada === 'estadual' && f.status === 'ativa')
  const regionaisLocais = ativas.filter((f) => {
    if (f.camada !== 'regional' && f.camada !== 'local') return false
    if (!f.dominio) return false
    return f.municipiosPrioritarios.some(
      (m) =>
        m
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim() === key,
    )
  })

  return [...estaduais, ...regionaisLocais]
}

export async function buscarNoticiasRadarMunicipio(
  municipio: string,
  opts?: { apenasEstaduais?: boolean },
): Promise<{
  municipio: string
  queries: number
  brutos: number
  descartadas: number
  descartadasContexto: number
  descartadasAntigas: number
  janelaDias: number
  itens: RadarNoticiaItem[]
}> {
  const fontes = fontesParaBusca({
    apenasEstaduais: opts?.apenasEstaduais,
    municipio,
  })
  const itens: RadarNoticiaItem[] = []
  let queries = 0
  let brutos = 0
  let descartadasContexto = 0
  let descartadasAntigas = 0

  for (let i = 0; i < fontes.length; i++) {
    const fonte = fontes[i]
    if (i > 0) await sleep(PAUSE_MS)
    const searchQuery = buildQuery(municipio, fonte.dominio)
    queries += 1
    try {
      const rows = await fetchGoogleNewsRss(searchQuery)
      for (const row of rows.slice(0, 20)) {
        brutos += 1
        const rel = avaliarRelevanciaMunicipio({
          municipio,
          title: row.title,
          summary: row.summary,
        })
        if (!rel.ok) {
          descartadasContexto += 1
          continue
        }
        if (!publicadoNaJanela(row.publishedAt)) {
          descartadasAntigas += 1
          continue
        }
        itens.push({
          articleId: row.articleId,
          title: row.title,
          url: row.url,
          summary: row.summary,
          publishedAt: row.publishedAt,
          sourceName: row.sourceName,
          municipio,
          fonteId: fonte.id,
          fonteNome: fonte.nome,
          fonteDominio: fonte.dominio,
          fonteCamada: fonte.camada,
          searchQuery,
          mencaoNoTitulo: rel.noTitulo,
        })
      }
    } catch (error) {
      console.warn(`[radar-224] falha RSS ${fonte.dominio} · ${municipio}`, error)
    }
  }

  const seen = new Set<string>()
  const deduped = itens.filter((item) => {
    const key = item.url || item.articleId
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Prioriza menção no título, depois data
  deduped.sort((a, b) => {
    if (a.mencaoNoTitulo !== b.mencaoNoTitulo) return a.mencaoNoTitulo ? -1 : 1
    const da = a.publishedAt ? Date.parse(a.publishedAt) : 0
    const db = b.publishedAt ? Date.parse(b.publishedAt) : 0
    return db - da || a.title.localeCompare(b.title, 'pt-BR')
  })

  return {
    municipio,
    queries,
    brutos,
    descartadas: descartadasContexto + descartadasAntigas,
    descartadasContexto,
    descartadasAntigas,
    janelaDias: RADAR_224_JANELA_DIAS,
    itens: deduped,
  }
}

export async function buscarNoticiasRadarLote(opts: {
  municipios: string[]
  apenasEstaduais?: boolean
}): Promise<{
  queries: number
  brutos: number
  descartadas: number
  descartadasContexto: number
  descartadasAntigas: number
  janelaDias: number
  itens: RadarNoticiaItem[]
  porMunicipio: Record<string, number>
}> {
  const itens: RadarNoticiaItem[] = []
  let queries = 0
  let brutos = 0
  let descartadasContexto = 0
  let descartadasAntigas = 0
  const porMunicipio: Record<string, number> = {}

  for (let i = 0; i < opts.municipios.length; i++) {
    const municipio = opts.municipios[i]
    if (i > 0) await sleep(PAUSE_MS)
    const result = await buscarNoticiasRadarMunicipio(municipio, {
      apenasEstaduais: opts.apenasEstaduais ?? true,
    })
    queries += result.queries
    brutos += result.brutos
    descartadasContexto += result.descartadasContexto
    descartadasAntigas += result.descartadasAntigas
    porMunicipio[municipio] = result.itens.length
    itens.push(...result.itens)
  }

  return {
    queries,
    brutos,
    descartadas: descartadasContexto + descartadasAntigas,
    descartadasContexto,
    descartadasAntigas,
    janelaDias: RADAR_224_JANELA_DIAS,
    itens,
    porMunicipio,
  }
}
