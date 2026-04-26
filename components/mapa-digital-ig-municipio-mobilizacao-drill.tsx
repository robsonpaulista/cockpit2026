'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import {
  fetchMobilizacaoLideresLideradosNoMunicipio,
  type MobilizacaoLideresLideradosNoMunicipioPayload,
} from '@/lib/mobilizacao-lideres-liderados-municipio-client'
import {
  classificacaoTerritorioTdPorPctEngajamentoIg,
  pctMidiasComComentarioPorPostagensProcessadas,
  tituloTooltipEngajamentoIgComentarios,
} from '@/lib/instagram-engajamento-ig-classificacao'
import { ClassificacaoTdBadge } from '@/components/classificacao-td-badge'
import { formatTempoMedioPublicacaoComentario } from '@/lib/format-tempo-medio-publicacao-comentario'
import { Loader2 } from 'lucide-react'

const fmtInt = new Intl.NumberFormat('pt-BR')

type Props = {
  territorioPai: TerritorioDesenvolvimentoPI
  municipioFoco: string
  /** Postagens processadas na conta IG (mesma base da coluna Eng. IG no mapa). */
  postagensProcessadas: number
  sidebarCollapsed: boolean
  onVoltar: () => void
}

function igHandleDisplay(raw: string | null): string | null {
  if (!raw) return null
  const s = String(raw).replace(/^@+/, '').trim()
  return s || null
}

/** Grade alinhada às colunas numéricas da tabela por município (sem `<table>`). */
const GRID_METRICAS =
  'grid grid-cols-[minmax(0,1fr)_1.5rem_2rem_2.25rem_2.25rem_2rem_minmax(4rem,1.2fr)_auto] items-center gap-x-1 gap-y-0.5'

export function MapaDigitalIgMunicipioMobilizacaoDrill({
  territorioPai,
  municipioFoco,
  postagensProcessadas,
  sidebarCollapsed,
  onVoltar,
}: Props) {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
  const [erro, setErro] = useState<string>('')
  const [payload, setPayload] = useState<MobilizacaoLideresLideradosNoMunicipioPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadState('loading')
    setErro('')
    setPayload(null)
    void (async () => {
      const res = await fetchMobilizacaoLideresLideradosNoMunicipio(territorioPai, municipioFoco)
      if (cancelled) return
      if (res.ok) {
        setPayload(res.data)
        setLoadState('ready')
        return
      }
      if (res.status === 403) {
        setLoadState('forbidden')
        setErro(res.message ?? 'Sem permissão para Mobilização.')
        return
      }
      setLoadState('error')
      setErro(res.message ?? 'Não foi possível carregar líderes e liderados.')
    })()
    return () => {
      cancelled = true
    }
  }, [territorioPai, municipioFoco])

  const textSm = sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
  const textTitle = sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs'
  const cellNum = 'text-right tabular-nums text-white/85'
  const headNum = 'text-right font-medium text-white/55'

  return (
    <div className={cn('text-white', textSm)}>
      <div className="mb-2 flex flex-col gap-1">
        <button
          type="button"
          onClick={onVoltar}
          className={cn(
            'self-start rounded-md border border-white/30 bg-white/10 px-2 py-0.5 font-medium text-white hover:bg-white/18 focus:outline-none focus:ring-2 focus:ring-white/45',
            textSm
          )}
        >
          ← Voltar aos municípios
        </button>
        <p className={cn('td-fut-subsection-title font-semibold uppercase tracking-wide text-white', textTitle)}>
          Mobilização · {payload?.municipioOficial ?? municipioFoco}
        </p>
        <p className="text-[10px] leading-snug text-white/70 sm:text-[11px]">
          Líderes neste município — expanda para ver liderados; inclui tempo médio da publicação ao comentário no Instagram.
        </p>
      </div>

      {loadState === 'loading' ? (
        <p className={cn('flex items-center gap-2 text-white/90', textSm)}>
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white" aria-hidden />
          Carregando…
        </p>
      ) : null}

      {(loadState === 'error' || loadState === 'forbidden') && erro ? (
        <p className={cn('text-rose-200', textSm)}>{erro}</p>
      ) : null}

      {loadState === 'ready' && payload ? (
        <div className="flex flex-col gap-0.5">
          {payload.lideres.length === 0 ? (
            <p className={cn('text-white/75', textSm)}>Nenhuma liderança cadastrada neste município.</p>
          ) : (
            payload.lideres.map((L) => {
              const n = L.liderados.length
              const lidLabel = n === 0 ? '0 lid.' : n === 1 ? '1 lid.' : `${n} lid.`
              const totalComentariosLider = L.liderados.reduce((s, r) => s + r.comentarios, 0)
              return (
                <details key={L.id} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 px-0 py-0.5 marker:hidden [&::-webkit-details-marker]:hidden sm:gap-2 sm:py-0.5">
                    <span
                      aria-hidden
                      className="inline-block w-3 shrink-0 select-none text-center text-[9px] text-white/55 transition-transform duration-150 group-open:rotate-90 sm:text-[10px]"
                    >
                      ▸
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-white" title={L.nome}>
                      {L.nome}
                    </span>
                    <span className="shrink-0 tabular-nums text-white/70">{lidLabel}</span>
                    {L.telefone ? (
                      <span className="hidden max-w-[7rem] shrink-0 truncate text-white/55 sm:inline" title={L.telefone}>
                        {L.telefone}
                      </span>
                    ) : null}
                  </summary>
                  <div className="py-0.5 pl-4 pt-0 sm:pl-5">
                    {L.liderados.length === 0 ? (
                      <p className="py-0.5 text-[10px] text-white/65 sm:text-[11px]">Nenhum liderado ativo.</p>
                    ) : (
                      <div className="min-w-0 overflow-x-auto">
                        <div className="min-w-[26rem] space-y-1">
                          <div
                            className={cn(GRID_METRICAS, 'border-b border-white/15 pb-0.5 text-[9px] uppercase tracking-wide sm:text-[10px]')}
                            aria-hidden
                          >
                            <span className="text-left font-medium text-white/55">Liderado</span>
                            <span className={headNum} title="Um município por linha na tabela superior">
                              Mun.
                            </span>
                            <span className={headNum} title="Líder (pai) deste liderado">
                              Líd.
                            </span>
                            <span className={headNum} title="Um liderado por linha">
                              Lid.
                            </span>
                            <span className={headNum} title="Comentários vinculados ao @ do liderado">
                              Com.
                            </span>
                            <span className={headNum} title="Perfis distintos (até 1)">
                              Perf.
                            </span>
                            <span
                              className={headNum}
                              title="Tempo médio entre a data da publicação da mídia e o comentário (só entra média quando as duas datas existem na sincronização)"
                            >
                              T. méd.
                            </span>
                            <span
                              className="text-center font-medium text-white/55"
                              title="Engajamento: mídias com ≥1 comentário do @ ÷ postagens processadas na conta (teto 100%). Baixo abaixo de 50%; Médio 50% a 80%; Alto acima de 80%."
                            >
                              Eng.
                            </span>
                          </div>
                          {L.liderados.map((row) => {
                            const ig = igHandleDisplay(row.instagram)
                            const pctEng = pctMidiasComComentarioPorPostagensProcessadas(
                              row.midiasComComentario ?? 0,
                              postagensProcessadas
                            )
                            const tipoEng = classificacaoTerritorioTdPorPctEngajamentoIg(pctEng)
                            const pctLista =
                              totalComentariosLider > 0 ? (row.comentarios / totalComentariosLider) * 100 : 0
                            const hintEng = tituloTooltipEngajamentoIgComentarios(
                              row.comentarios,
                              postagensProcessadas,
                              pctEng,
                              totalComentariosLider > 0
                                ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(pctLista)}% dos comentários deste líder.`
                                : undefined
                            )
                            return (
                              <div key={row.id} className={cn(GRID_METRICAS, 'text-[10px] sm:text-[11px]')}>
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-white" title={row.nome}>
                                    {row.nome}
                                  </div>
                                  <div className="truncate text-white/55" title={[row.whatsapp, ig ? `@${ig}` : '', row.cidade].filter(Boolean).join(' · ')}>
                                    <span className="tabular-nums">{row.whatsapp}</span>
                                    {ig ? <span> · @{ig}</span> : null}
                                    {row.cidade ? <span className="text-white/45"> · {row.cidade}</span> : null}
                                  </div>
                                </div>
                                <span className={cellNum}>1</span>
                                <span className={cellNum}>1</span>
                                <span className={cellNum}>1</span>
                                <span className={cn(cellNum, 'text-white')}>{fmtInt.format(row.comentarios)}</span>
                                <span className={cellNum}>{fmtInt.format(row.perfisUnicos)}</span>
                                <span className={cn(cellNum, 'whitespace-nowrap')} title={row.tempoMedioPostComentarioMs != null ? `${row.tempoMedioPostComentarioMs} ms` : undefined}>
                                  {formatTempoMedioPublicacaoComentario(row.tempoMedioPostComentarioMs)}
                                </span>
                                <div className="flex justify-center">
                                  <ClassificacaoTdBadge
                                    tipo={tipoEng}
                                    compact
                                    visualTone="futuristic"
                                    titleOverride={hintEng}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
