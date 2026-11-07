/**
 * Notícias do Atendimento via scrape das listagens regionais do catálogo Radar 224.
 */

import { listRadarFontesSeed } from '@/lib/radar-224/fontes-seed'
import {
  PORTAL_NOTICIAS_JANELA_DIAS,
  publicadoNaJanelaPortal,
  resolvePublishedAtMs,
} from '@/lib/radar-224/portal-noticia-data'
import {
  fetchListagemPortal,
  type PortalNoticiaItem,
} from '@/lib/radar-224/scrape-listagem-portal'
import type { RadarFonte } from '@/lib/radar-224/types'

function normalizeMunicipioKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function fontesComListagemParaMunicipio(municipio: string): RadarFonte[] {
  const key = normalizeMunicipioKey(municipio)
  return listRadarFontesSeed({ status: ['ativa', 'candidata'] }).filter((f) => {
    if (!f.urlListagem) return false
    return f.municipiosPrioritarios.some((m) => normalizeMunicipioKey(m) === key)
  })
}

/** Listagem já é tag/página do município (ex.: /guadalupe/) — exige menção para filtrar sidebar. */
function listagemEhTagMunicipal(urlListagem: string, municipio: string): boolean {
  try {
    const path = urlListagem
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    const key = normalizeMunicipioKey(municipio)
    const slug = key.replace(/\s+/g, '-')
    const compact = key.replace(/\s+/g, '')
    return path.includes(`/${slug}`) || path.includes(`/${compact}`) || path.includes(`/${slug}/`)
  } catch {
    return false
  }
}

function textoMencionaMunicipioPortal(texto: string, municipio: string): boolean {
  return normalizeMunicipioKey(texto).includes(normalizeMunicipioKey(municipio))
}

export async function buscarNoticiasPortalMunicipio(municipio: string): Promise<{
  municipio: string
  fontesConsultadas: number
  brutos: number
  descartadasAntigas: number
  janelaDias: number
  itens: PortalNoticiaItem[]
}> {
  const fontes = fontesComListagemParaMunicipio(municipio)
  const itens: PortalNoticiaItem[] = []
  const seen = new Set<string>()
  let brutos = 0
  let descartadasAntigas = 0
  const agora = Date.now()

  for (const fonte of fontes) {
    if (!fonte.urlListagem) continue
    try {
      const rows = await fetchListagemPortal({
        listagemUrl: fonte.urlListagem,
        fonteId: fonte.id,
        fonteNome: fonte.nome,
        fonteDominio: fonte.dominio,
      })
      const exigeMencao = listagemEhTagMunicipal(fonte.urlListagem, municipio)
      for (const row of rows) {
        if (seen.has(row.url)) continue
        seen.add(row.url)
        brutos += 1
        if (
          exigeMencao &&
          !textoMencionaMunicipioPortal(`${row.title} ${row.url} ${row.summary ?? ''}`, municipio)
        ) {
          continue
        }
        const publishedAtMs = resolvePublishedAtMs({
          publishedAt: row.publishedAt,
          publishedLabel: row.publishedLabel,
          url: row.url,
          agora,
        })
        if (!publicadoNaJanelaPortal(publishedAtMs, { dias: PORTAL_NOTICIAS_JANELA_DIAS, agora })) {
          descartadasAntigas += 1
          continue
        }
        itens.push({
          ...row,
          publishedAt:
            row.publishedAt ||
            (publishedAtMs != null ? new Date(publishedAtMs).toISOString() : null),
        })
      }
    } catch (error) {
      console.warn(`[atendimento-noticias] falha ${fonte.dominio}`, error)
    }
  }

  itens.sort((a, b) => {
    const da = resolvePublishedAtMs({
      publishedAt: a.publishedAt,
      publishedLabel: a.publishedLabel,
      url: a.url,
      agora,
    })
    const db = resolvePublishedAtMs({
      publishedAt: b.publishedAt,
      publishedLabel: b.publishedLabel,
      url: b.url,
      agora,
    })
    return (db ?? 0) - (da ?? 0)
  })

  return {
    municipio,
    fontesConsultadas: fontes.length,
    brutos,
    descartadasAntigas,
    janelaDias: PORTAL_NOTICIAS_JANELA_DIAS,
    itens,
  }
}
