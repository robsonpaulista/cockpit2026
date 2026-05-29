/** Consulta ao vivo na API pública do Consulta FNS. */

import { normalizePropostaFns, type PropostaFnsCompleta } from '@/lib/fns-proposta-normalize'

export const FNS_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N)',
  Referer: 'https://consultafns.saude.gov.br/',
} as const

export async function fetchPropostasFnsFromApi(
  codigoIbge: string,
  nomeMunicipio: string,
  ano: number,
  maxPages = 5,
): Promise<PropostaFnsCompleta[]> {
  const propostas: PropostaFnsCompleta[] = []
  let page = 1

  while (page <= maxPages) {
    const url = 'https://consultafns.saude.gov.br/recursos/proposta/consultar'
    const params = new URLSearchParams({
      ano: String(ano),
      sgUf: 'PI',
      coMunicipioIbge: codigoIbge,
      count: '100',
      page: page.toString(),
      coEsfera: '',
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    let response: Response
    try {
      response = await fetch(`${url}?${params.toString()}`, {
        headers: FNS_HEADERS,
        signal: controller.signal,
      })
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      const name = error instanceof Error ? error.name : ''
      if (name === 'AbortError') {
        console.error(`Timeout FNS ${nomeMunicipio} (${ano})`)
      } else {
        console.error(`Erro FNS ${nomeMunicipio} (${ano}):`, error)
      }
      break
    }

    clearTimeout(timeoutId)

    if (!response.ok) break

    const data = (await response.json()) as {
      resultado?: { itensPagina?: Record<string, unknown>[] }
    }
    const propostasPage = data.resultado?.itensPagina ?? []

    if (propostasPage.length === 0) break

    propostas.push(
      ...propostasPage.map((p) => normalizePropostaFns(p, nomeMunicipio, ano)),
    )

    page++
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  return propostas
}
