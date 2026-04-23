'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTerritorioDesenvolvimentoPI, type TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'

const fmtInt = new Intl.NumberFormat('pt-BR')

export type MapaPesquisaRankingCandidatosTarget =
  | { escopo: 'territorio'; tipo: 'espontanea' | 'estimulada'; territorio: TerritorioDesenvolvimentoPI }
  | {
      escopo: 'municipio'
      tipo: 'espontanea' | 'estimulada'
      territorio: TerritorioDesenvolvimentoPI
      municipioNome: string
    }
  | { escopo: 'estado'; tipo: 'espontanea' | 'estimulada' }
  | {
      escopo: 'lista_municipios_td'
      tipo: 'espontanea' | 'estimulada'
      territorio: TerritorioDesenvolvimentoPI
      municipiosNorm: readonly string[]
    }

/** Mapa (painel pesquisas) e modal de ranking: só Dep. Federal — comparável entre municípios. */
export const PESQUISA_MAPA_CARGO = 'dep_federal' as const

type PollRow = {
  tipo?: string | null
  data?: string | null
  instituto?: string | null
  cargo?: string | null
  intencao?: number | string | null
  candidato_nome?: string | null
  cities?: { name?: string | null } | Array<{ name?: string | null }> | null
}

function nomeCidadePoll(poll: PollRow): string {
  const c = poll.cities
  if (!c) return ''
  if (Array.isArray(c)) return String(c[0]?.name ?? '').trim()
  return String(c.name ?? '').trim()
}

function parseIntencao(raw: number | string | null | undefined): number | null {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const s = String(raw).trim().replace(/\s/g, '').replace(',', '.')
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function normalizarCandidatoChave(nome: string): string {
  return nome.trim().toUpperCase()
}

const SEP_ONDA = '\u0000'

/**
 * No município, o ranking deve ser **um único levantamento** (todas as linhas do mesmo
 * data + instituto + Dep. Federal), senão cada opção fica com N=1 de pesquisas diferentes
 * e as % parecem incompatíveis entre si.
 */
function montarRankingMunicipioUltimaOndaDepFederal(
  rows: PollRow[],
  target: Extract<MapaPesquisaRankingCandidatosTarget, { escopo: 'municipio' }>
): { nome: string; media: number; n: number }[] {
  const tipoAlvo = target.tipo
  const munNorm = normalizeMunicipioNome(target.municipioNome)
  const porOnda = new Map<string, Map<string, { nomeExibicao: string; intencao: number }>>()

  for (const row of rows) {
    const cargoRow = String(row.cargo ?? '').trim().toLowerCase()
    if (cargoRow !== PESQUISA_MAPA_CARGO) continue
    const tipo = String(row.tipo ?? '').trim().toLowerCase()
    if (tipo !== tipoAlvo) continue
    const cidade = nomeCidadePoll(row)
    if (!cidade) continue
    const td = getTerritorioDesenvolvimentoPI(cidade)
    if (td !== target.territorio) continue
    const cidadeNorm = normalizeMunicipioNome(cidade)
    if (cidadeNorm !== munNorm) continue

    const candidatoNome = String(row.candidato_nome ?? '').trim()
    if (!candidatoNome) continue
    const intVal = parseIntencao(row.intencao)
    if (intVal === null) continue

    const dataBase = String(row.data ?? '').split('T')[0].trim()
    const instituto = String(row.instituto ?? '').trim().toUpperCase()
    const ondaKey = `${dataBase}${SEP_ONDA}${instituto}`
    const candKey = normalizarCandidatoChave(candidatoNome)

    const inner =
      porOnda.get(ondaKey) ?? new Map<string, { nomeExibicao: string; intencao: number }>()
    inner.set(candKey, { nomeExibicao: candidatoNome, intencao: intVal })
    porOnda.set(ondaKey, inner)
  }

  if (porOnda.size === 0) return []

  const ordenarOndaDesc = (ka: string, kb: string): number => {
    const [da, ia] = ka.split(SEP_ONDA)
    const [db, ib] = kb.split(SEP_ONDA)
    if (da !== db) return db.localeCompare(da)
    return ib.localeCompare(ia)
  }
  const ondaMaisRecente = [...porOnda.keys()].sort(ordenarOndaDesc)[0]!
  const mapa = porOnda.get(ondaMaisRecente)!

  return [...mapa.values()]
    .map(({ nomeExibicao, intencao }) => ({
      nome: nomeExibicao,
      media: Math.round(intencao * 10) / 10,
      n: 1,
    }))
    .sort((a, b) => b.media - a.media || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
}

export function montarRankingCandidatosPesquisa(
  rows: PollRow[],
  target: MapaPesquisaRankingCandidatosTarget
): { nome: string; media: number; n: number }[] {
  if (target.escopo === 'municipio') {
    return montarRankingMunicipioUltimaOndaDepFederal(rows, target)
  }

  const tipoAlvo = target.tipo
  const acumulado = new Map<string, { nomeExibicao: string; soma: number; n: number }>()
  const vistos = new Set<string>()
  const setListaMun =
    target.escopo === 'lista_municipios_td' ? new Set(target.municipiosNorm) : null

  for (const row of rows) {
    const cargoRow = String(row.cargo ?? '').trim().toLowerCase()
    if (cargoRow !== PESQUISA_MAPA_CARGO) continue
    const tipo = String(row.tipo ?? '').trim().toLowerCase()
    if (tipo !== tipoAlvo) continue
    const cidade = nomeCidadePoll(row)
    if (!cidade) continue
    const td = getTerritorioDesenvolvimentoPI(cidade)
    if (!td) continue
    const cidadeNorm = normalizeMunicipioNome(cidade)

    if (target.escopo === 'territorio') {
      if (td !== target.territorio) continue
    } else if (target.escopo === 'lista_municipios_td') {
      if (td !== target.territorio) continue
      if (setListaMun !== null && !setListaMun.has(cidadeNorm)) continue
    }

    const candidatoNome = String(row.candidato_nome ?? '').trim()
    if (!candidatoNome) continue
    const intVal = parseIntencao(row.intencao)
    if (intVal === null) continue

    const dataBase = String(row.data ?? '').split('T')[0].trim()
    const instituto = String(row.instituto ?? '').trim().toUpperCase()
    const cargo = String(row.cargo ?? '').trim().toLowerCase()
    const candKey = normalizarCandidatoChave(candidatoNome)
    const chaveLevantamento = `${tipo}|${dataBase}|${instituto}|${cargo}|${cidadeNorm}|${candKey}`
    if (vistos.has(chaveLevantamento)) continue
    vistos.add(chaveLevantamento)

    const atual = acumulado.get(candKey) ?? { nomeExibicao: candidatoNome, soma: 0, n: 0 }
    atual.soma += intVal
    atual.n += 1
    if (atual.nomeExibicao.length < candidatoNome.length) atual.nomeExibicao = candidatoNome
    acumulado.set(candKey, atual)
  }

  return Array.from(acumulado.values())
    .map(({ nomeExibicao, soma, n }) => ({
      nome: nomeExibicao,
      media: Math.round((soma / Math.max(1, n)) * 10) / 10,
      n,
    }))
    .sort((a, b) => b.media - a.media || b.n - a.n || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
}

type Props = {
  open: boolean
  target: MapaPesquisaRankingCandidatosTarget | null
  onClose: () => void
  visualPreset: 'default' | 'futuristic'
}

export function MapaPesquisaRankingCandidatosModal({ open, target, onClose, visualPreset }: Props) {
  const isFut = visualPreset === 'futuristic'
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [erro, setErro] = useState<string>('')
  const [linhas, setLinhas] = useState<{ nome: string; media: number; n: number }[]>([])

  const tituloTipo = target?.tipo === 'espontanea' ? 'Espontânea' : 'Estimulada'

  const subtitulo = useMemo(() => {
    if (!target) return ''
    if (target.escopo === 'estado') return 'Todos os territórios de desenvolvimento (PI)'
    if (target.escopo === 'territorio') return `Território: ${target.territorio}`
    if (target.escopo === 'lista_municipios_td')
      return `TD ${target.territorio} · municípios listados (${target.municipiosNorm.length})`
    return `${target.municipioNome} · TD ${target.territorio}`
  }, [target])

  const textoMetodoRanking = useMemo(() => {
    if (!target) return ''
    if (target.escopo === 'municipio') {
      return 'Dep. federal neste município: percentuais da última pesquisa (data e instituto mais recentes juntos). Todas as opções são do mesmo levantamento; N = 1 por opção nessa onda. As células do mapa continuam com média histórica (várias ondas).'
    }
    return 'Somente deputado federal: média da intenção (%) por opção citada nos levantamentos do recorte. Em cada pesquisa (data + instituto + município) entra no máximo um valor por opção. A coluna N é quantos levantamentos entraram na média dessa opção. A soma das médias entre linhas não representa um único 100%, pois cada opção agrega levantamentos diferentes.'
  }, [target])

  const carregar = useCallback(async () => {
    if (!target) return
    setLoadState('loading')
    setErro('')
    setLinhas([])
    try {
      const res = await fetch(
        `/api/pesquisa?${new URLSearchParams({ limit: '5000', cargo: PESQUISA_MAPA_CARGO }).toString()}`
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body?.error ?? 'Falha ao carregar pesquisas')
      }
      const rows = (await res.json()) as PollRow[]
      setLinhas(montarRankingCandidatosPesquisa(rows, target))
      setLoadState('ready')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar')
      setLoadState('error')
    }
  }, [target])

  useEffect(() => {
    if (!open || !target) {
      setLoadState('idle')
      setLinhas([])
      setErro('')
      return
    }
    void carregar()
  }, [open, target, carregar])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !target) return null

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mapa-pesquisa-ranking-titulo"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-[1] flex max-h-[min(32rem,85vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-xl',
          isFut
            ? 'border-[rgba(255,255,255,0.1)] bg-[#121a24] text-[#E6EDF3]'
            : 'border-border-card bg-card text-text-primary'
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-start justify-between gap-3 rounded-t-2xl border-b px-4 py-3',
            isFut ? 'border-[rgba(255,255,255,0.08)] bg-[#121a24]' : 'border-border-card bg-card'
          )}
        >
          <div className="min-w-0">
            <h2
              id="mapa-pesquisa-ranking-titulo"
              className={cn('text-sm font-semibold sm:text-base', isFut ? 'text-white' : 'text-text-primary')}
            >
              Candidatos · {tituloTipo}
            </h2>
            <p className={cn('mt-0.5 text-xs', isFut ? 'text-white/85' : 'text-text-muted')}>{subtitulo}</p>
            <p className={cn('mt-1 text-[11px] leading-snug', isFut ? 'text-white/70' : 'text-text-muted')}>
              {textoMetodoRanking} Ordenação decrescente pela coluna Média. Duplo clique na coluna do mapa para abrir.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'shrink-0 rounded-lg p-1.5 transition-colors',
              isFut ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-text-muted hover:bg-muted'
            )}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-4 py-3',
            isFut ? 'bg-[#121a24] text-[#E6EDF3]' : 'bg-card text-text-primary'
          )}
        >
          {loadState === 'loading' ? (
            <div
              className={cn(
                'flex items-center justify-center gap-2 py-10 text-sm',
                isFut ? 'text-white/85' : 'text-text-secondary'
              )}
            >
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Carregando…
            </div>
          ) : loadState === 'error' ? (
            <p className="text-sm text-status-danger">{erro}</p>
          ) : linhas.length === 0 ? (
            <p className={cn('text-sm', isFut ? 'text-[#AAB4C0]' : 'text-text-muted')}>
              Nenhum registro com intenção válida para este recorte e tipo de pesquisa.
            </p>
          ) : (
            <table className="mapa-pesquisa-ranking-modal-table w-full border-collapse text-left text-sm">
              <thead
                className={cn(
                  isFut ? '!bg-[#121a24]' : '!bg-card [&_tr]:border-b [&_tr]:border-border-card'
                )}
              >
                <tr
                  className={cn(
                    'border-b',
                    isFut ? 'border-[rgba(255,255,255,0.08)] bg-[#121a24]' : 'border-border-card bg-card'
                  )}
                >
                  <th
                    className={cn(
                      'py-2 pr-2 text-xs font-semibold uppercase tracking-wide',
                      isFut ? 'text-white/90' : 'text-text-muted'
                    )}
                  >
                    #
                  </th>
                  <th
                    className={cn(
                      'py-2 pr-2 text-xs font-semibold uppercase tracking-wide',
                      isFut ? 'text-white/90' : 'text-text-muted'
                    )}
                  >
                    Candidato
                  </th>
                  <th
                    className={cn(
                      'py-2 pr-2 text-right text-xs font-semibold uppercase tracking-wide',
                      isFut ? 'text-white/90' : 'text-text-muted'
                    )}
                  >
                    Média
                  </th>
                  <th
                    className={cn(
                      'py-2 text-right text-xs font-semibold uppercase tracking-wide',
                      isFut ? 'text-white/90' : 'text-text-muted'
                    )}
                  >
                    N
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, idx) => (
                  <tr
                    key={`${l.nome}-${idx}`}
                    className={cn(
                      'group border-b transition-colors',
                      isFut
                        ? 'border-[rgba(255,255,255,0.05)] hover:bg-white'
                        : 'border-border-card/60 hover:bg-muted/70'
                    )}
                  >
                    <td
                      className={cn(
                        'py-2 pr-2 tabular-nums transition-colors',
                        isFut
                          ? 'text-[#7f8a96] group-hover:text-neutral-950'
                          : 'text-text-muted group-hover:text-text-primary'
                      )}
                    >
                      {idx + 1}
                    </td>
                    <td
                      className={cn(
                        'max-w-[12rem] truncate py-2 pr-2 font-medium transition-colors',
                        isFut ? 'text-[#E6EDF3] group-hover:text-neutral-950' : 'group-hover:text-text-primary'
                      )}
                      title={l.nome}
                    >
                      {l.nome}
                    </td>
                    <td
                      className={cn(
                        'py-2 pr-2 text-right tabular-nums font-semibold transition-colors',
                        isFut
                          ? 'text-[#E6EDF3] group-hover:text-neutral-950'
                          : 'text-text-primary group-hover:text-text-primary'
                      )}
                    >
                      {Number.isInteger(l.media)
                        ? String(l.media)
                        : l.media.toFixed(1).replace('.', ',')}
                      %
                    </td>
                    <td
                      className={cn(
                        'py-2 text-right tabular-nums transition-colors',
                        isFut
                          ? 'text-[#AAB4C0] group-hover:text-neutral-900'
                          : 'text-text-secondary group-hover:text-text-primary'
                      )}
                    >
                      {fmtInt.format(l.n)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
