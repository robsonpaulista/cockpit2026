import { extractCityNameFromQuery } from '@/lib/agent/city-extract'
import { pickPrioridadeVisitasRows, type PrioridadeCampoApiRow } from '@/lib/agent/format-prioridade-visitas'
import { mapNoticiasApiRows } from '@/lib/agent/format-noticias'
import { resolveCandidatoParaPesquisa } from '@/lib/agent/resolve-candidato-pesquisa'
import type { AgentContextPayload } from '@/lib/agent/types'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

async function fetchWithCookies(
  origin: string,
  path: string,
  cookie: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${origin}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      cookie,
    },
    cache: 'no-store',
  })
}

function jsonSlice(data: unknown, max = 5000): string {
  return JSON.stringify(data).slice(0, max)
}

type PollRow = {
  data?: string
  instituto?: string
  candidato_nome?: string
  intencao?: number
  tipo?: string
  cities?: { name?: string } | null
}

type CampoAgendaRow = {
  date?: string
  type?: string
  status?: string
  description?: string | null
  cities?: { name?: string } | null
}

type ResumoOperacionalJson = {
  periodo?: { dias?: number; inicio?: string; fim?: string }
  alertas?: string[]
  secoes?: Array<{ titulo?: string; itens?: string[] }>
}

function cityMatches(name: string, cidade: string): boolean {
  const a = normalize(name)
  const b = normalize(cidade)
  return a.includes(b) || b.includes(a)
}

function compactPolls(rows: PollRow[], cidade?: string | null, limit = 18): string {
  const cityNorm = cidade ? normalize(cidade) : null
  const filtered = rows.filter((row) => {
    if (!cityNorm) return true
    const name = normalize(row.cities?.name ?? '')
    return name.includes(cityNorm) || cityNorm.includes(name)
  })
  const slice = filtered.slice(0, limit)
  if (slice.length === 0) return 'Nenhuma pesquisa cadastrada para o filtro.'
  return slice
    .map((p) => {
      const city = p.cities?.name ?? '—'
      const tipo = p.tipo ?? '—'
      const pct = p.intencao != null ? `${p.intencao}%` : '—'
      return `- ${p.data ?? '—'} | ${p.instituto ?? '—'} | ${city} | ${p.candidato_nome ?? '—'} | ${tipo} | ${pct}`
    })
    .join('\n')
}

function compactCampoAgendas(agendas: CampoAgendaRow[], cidade?: string | null, limit = 18): string {
  const filtered = cidade
    ? agendas.filter((a) => cityMatches(a.cities?.name ?? '', cidade))
    : agendas
  const sorted = [...filtered].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const slice = sorted.slice(0, limit)
  if (slice.length === 0) return 'Nenhuma visita/agenda de campo no filtro.'
  return slice
    .map((a) => {
      const desc = a.description?.trim().slice(0, 72)
      return `- ${(a.date ?? '—').slice(0, 10)} | ${a.cities?.name ?? '—'} | ${a.type ?? '—'} | ${a.status ?? '—'}${desc ? ` | ${desc}` : ''}`
    })
    .join('\n')
}

function compactPrioridadeVisitas(rows: PrioridadeCampoApiRow[], cidade?: string | null, limit = 12): string {
  let picked = pickPrioridadeVisitasRows(rows, limit)
  if (cidade) {
    picked = picked.filter((r) => cityMatches(r.cidade, cidade))
    if (picked.length === 0) {
      picked = rows
        .filter((r) => cityMatches(r.cidade, cidade))
        .sort((a, b) => b.expectativaVotos - a.expectativaVotos)
        .slice(0, 3)
    }
  }
  if (picked.length === 0) return 'Sem dados de prioridade visitas × expectativa.'
  return picked
    .map(
      (r) =>
        `- ${r.cidade}: expectativa ${r.expectativaVotos} votos, ${r.visitas} visita(s)${r.motivo ? ` — ${r.motivo}` : ''}`
    )
    .join('\n')
}

function compactResumoOperacional(data: ResumoOperacionalJson): string {
  const lines: string[] = []
  if (data.periodo) {
    lines.push(
      `Período: ${data.periodo.dias ?? '?'} dias (${data.periodo.inicio ?? '—'} a ${data.periodo.fim ?? '—'})`
    )
  }
  if (data.alertas?.length) {
    lines.push(`Alertas: ${data.alertas.join(' · ')}`)
  }
  for (const sec of data.secoes ?? []) {
    if (!sec.titulo) continue
    lines.push(`[${sec.titulo}]`)
    for (const item of (sec.itens ?? []).slice(0, 6)) {
      lines.push(`  · ${item}`)
    }
  }
  return lines.join('\n').slice(0, 5500) || 'Resumo operacional vazio.'
}

function compactNoticias(rows: ReturnType<typeof mapNoticiasApiRows>): string {
  if (rows.length === 0) return 'Nenhuma notícia em destaque no painel.'
  return rows
    .slice(0, 10)
    .map((n) => {
      const risk = n.risk_level ? ` risco:${n.risk_level}` : ''
      const sent = n.sentiment ? ` tom:${n.sentiment}` : ''
      return `- ${n.title} (${n.source}${sent}${risk})`
    })
    .join('\n')
}

async function loadTerritorioExpectativa(
  origin: string,
  cookie: string,
  cidade: string,
  blocks: string[]
): Promise<void> {
  try {
    const res = await fetchWithCookies(origin, '/api/territorio/expectativa-por-cidade', cookie, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cidade }),
    })
    if (res.ok) {
      blocks.push(`### Território & expectativa (${cidade})\n${jsonSlice(await res.json(), 5500)}`)
    }
  } catch {
    blocks.push(`### Território (${cidade})\nErro ao carregar expectativa.`)
  }
}

async function loadDemandasCidade(
  origin: string,
  cookie: string,
  cidade: string,
  blocks: string[]
): Promise<void> {
  try {
    const res = await fetchWithCookies(
      origin,
      `/api/campo/demands?cidade=${encodeURIComponent(cidade)}`,
      cookie
    )
    if (res.ok) {
      const rows = await res.json()
      blocks.push(`### Demandas (${cidade})\n${jsonSlice(rows, 3500)}`)
    }
  } catch {
    blocks.push(`### Demandas (${cidade})\nErro ao carregar.`)
  }
}

/** Busca só o necessário para a pergunta — evita payloads enormes (custo + latência). */
export async function gatherClaudeAnalysisContext(
  message: string,
  origin: string,
  cookie: string,
  context?: AgentContextPayload
): Promise<string> {
  const q = normalize(message)
  const cidade =
    extractCityNameFromQuery(message) || context?.cidadeAtual?.trim() || null
  const candidatoResolved = resolveCandidatoParaPesquisa({}, context, message)
  const candidato = candidatoResolved.candidato ?? 'Jadyel Alencar'
  const blocks: string[] = []

  const wantsPesquisa =
    /\b(pesquisa|intencao|voto|tendencia|ranking|estimulada|espontanea)\b/.test(q)
  const wantsChapa =
    /\b(chapa|republicanos|vaga|d\'?hondt|dhondt|federal)\b/.test(q)
  const wantsHistorico =
    /\b(tendencia|evoluiu|historico|serie|temporal)\b/.test(q) || wantsPesquisa
  const wantsTerritorioDiagnostico =
    /\b(diagnostico|territorial|territorio|lideranc|expectativa|panorama|situac|base|capilar)\b/.test(q)
  const wantsCampo =
    /\b(visita|viagens?|campo|presenca|check-?in|prioridade)\b/.test(q) ||
    wantsTerritorioDiagnostico
  const wantsNoticias =
    /\b(noticia|noticias|crise|imprensa|midia|manchete|repercussao|alerta)\b/.test(q) ||
    (wantsTerritorioDiagnostico && /\b(crise|repercussao|imprensa)\b/.test(q))
  const wantsResumoOps =
    /\b(resumo operacional|briefing operacional|briefing|operacional)\b/.test(q) ||
    (wantsCampo && /\b(prioridade|frio)\b/.test(q))
  const wantsInstagram =
    /\b(instagram|insta|rede social|digital|engajamento|seguidor|conteudo|redes)\b/.test(q)

  const fetches: Promise<void>[] = []

  if (cidade && wantsTerritorioDiagnostico) {
    fetches.push(loadTerritorioExpectativa(origin, cookie, cidade, blocks))
    fetches.push(loadDemandasCidade(origin, cookie, cidade, blocks))
  }

  if (wantsCampo || (cidade && wantsTerritorioDiagnostico)) {
    fetches.push(
      (async () => {
        try {
          const res = await fetchWithCookies(origin, '/api/campo/agendas', cookie)
          if (res.ok) {
            const agendas = (await res.json()) as CampoAgendaRow[]
            if (Array.isArray(agendas)) {
              blocks.push(
                `### Visitas / Campo & Agenda${cidade ? ` (${cidade})` : ''}\n${compactCampoAgendas(agendas, cidade)}`
              )
            }
          }
        } catch {
          blocks.push('### Campo & Agenda\nErro ao carregar visitas.')
        }
      })()
    )

    fetches.push(
      (async () => {
        try {
          const res = await fetchWithCookies(origin, '/api/dashboard/territorios-frios', cookie, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ territorioConfig: {} }),
          })
          if (res.ok) {
            const data = (await res.json()) as { prioridadeCampoLista?: PrioridadeCampoApiRow[] }
            const lista = data.prioridadeCampoLista ?? []
            blocks.push(
              `### Prioridade visitas × expectativa${cidade ? ` (${cidade})` : ''}\n${compactPrioridadeVisitas(lista, cidade)}`
            )
          }
        } catch {
          blocks.push('### Prioridade visitas\nErro ao carregar.')
        }
      })()
    )
  }

  if (wantsResumoOps) {
    fetches.push(
      (async () => {
        try {
          const res = await fetchWithCookies(origin, '/api/resumo-operacional?days=14', cookie)
          if (res.ok) {
            blocks.push(
              `### Resumo operacional (14 dias)\n${compactResumoOperacional((await res.json()) as ResumoOperacionalJson)}`
            )
          }
        } catch {
          blocks.push('### Resumo operacional\nErro ao carregar.')
        }
      })()
    )
  }

  if (wantsNoticias) {
    fetches.push(
      (async () => {
        try {
          const res = await fetchWithCookies(
            origin,
            '/api/noticias?dashboard_highlight=true&limit=10',
            cookie
          )
          if (res.ok) {
            const rows = mapNoticiasApiRows((await res.json()) as unknown[])
            blocks.push(`### Notícias em destaque\n${compactNoticias(rows)}`)
          }
        } catch {
          blocks.push('### Notícias\nErro ao carregar.')
        }
      })()
    )
  }

  if (wantsInstagram) {
    fetches.push(
      (async () => {
        try {
          const res = await fetchWithCookies(origin, '/api/instagram/snapshot?days=30', cookie)
          if (res.ok) {
            blocks.push(`### Instagram (métricas 30d)\n${jsonSlice(await res.json(), 4000)}`)
          }
        } catch {
          blocks.push('### Instagram\nErro ao carregar snapshot.')
        }
      })()
    )

    fetches.push(
      (async () => {
        try {
          const res = await fetchWithCookies(origin, '/api/instagram/classifications', cookie)
          if (res.ok) {
            blocks.push(`### Instagram (classificações/temas)\n${jsonSlice(await res.json(), 2500)}`)
          }
        } catch {
          /* opcional */
        }
      })()
    )
  }

  if (wantsPesquisa || wantsHistorico || (cidade && wantsTerritorioDiagnostico)) {
    fetches.push(
      (async () => {
        try {
          const res = await fetchWithCookies(origin, '/api/pesquisa?limit=60', cookie)
          if (res.ok) {
            const json = (await res.json()) as { polls?: PollRow[] } | PollRow[]
            const polls = Array.isArray(json) ? json : json.polls ?? []
            blocks.push(
              `### Pesquisas recentes${cidade ? ` (${cidade})` : ''}\n${compactPolls(polls, cidade)}`
            )
          }
        } catch {
          blocks.push('### Pesquisas\nErro ao carregar.')
        }
      })()
    )
  }

  if (wantsHistorico) {
    fetches.push(
      (async () => {
        try {
          const params = new URLSearchParams({ candidato })
          if (cidade) params.set('cidade', cidade)
          const res = await fetchWithCookies(
            origin,
            `/api/pesquisa/historico-intencao?${params}`,
            cookie
          )
          if (res.ok) {
            blocks.push(`### Histórico intenção (${candidato})\n${jsonSlice(await res.json(), 6000)}`)
          }
        } catch {
          blocks.push('### Histórico intenção\nErro ao carregar.')
        }
      })()
    )
  }

  if (/\b(ranking|estimulada|chapa|federal)\b/.test(q)) {
    fetches.push(
      (async () => {
        try {
          const params = new URLSearchParams({ candidato })
          const res = await fetchWithCookies(
            origin,
            `/api/pesquisa/ranking-estimulada?${params}`,
            cookie
          )
          if (res.ok) {
            blocks.push(`### Ranking estimulada federal\n${jsonSlice(await res.json(), 4000)}`)
          }
        } catch {
          blocks.push('### Ranking estimulada\nErro ao carregar.')
        }
      })()
    )
  }

  if (wantsChapa) {
    fetches.push(
      (async () => {
        try {
          const res = await fetchWithCookies(origin, '/api/chapas/projecao-republicanos', cookie)
          if (res.ok) {
            blocks.push(`### Projeção chapas (Republicanos)\n${jsonSlice(await res.json(), 5000)}`)
          }
        } catch {
          blocks.push('### Projeção chapas\nErro ao carregar.')
        }
      })()
    )
  }

  if (context?.alertsCriticosCount != null && context.alertsCriticosCount > 0) {
    blocks.push(`### KPI painel\nAlertas críticos no HUD: ${context.alertsCriticosCount}`)
  }
  if (context?.territoriosFriosCount != null && context.territoriosFriosCount > 0) {
    blocks.push(`### KPI painel\nTerritórios frios (indicador): ${context.territoriosFriosCount}`)
  }

  await Promise.all(fetches)

  if (blocks.length === 0) {
    blocks.push(
      'Sem blocos específicos carregados. Use KPIs da UI e explique limitações se a pergunta exigir dados não listados.'
    )
  }

  return blocks.join('\n\n')
}
