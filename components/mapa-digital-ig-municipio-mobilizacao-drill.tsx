'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import {
  fetchMobilizacaoLideresLideradosNoMunicipio,
  type MobilizacaoLideresLideradosNoMunicipioPayload,
} from '@/lib/mobilizacao-lideres-liderados-municipio-client'
import { Loader2 } from 'lucide-react'

const detailsAbertoPorPadrao = { defaultOpen: true } as { defaultOpen?: boolean }

type Props = {
  territorioPai: TerritorioDesenvolvimentoPI
  municipioFoco: string
  sidebarCollapsed: boolean
  onVoltar: () => void
}

export function MapaDigitalIgMunicipioMobilizacaoDrill({
  territorioPai,
  municipioFoco,
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

  return (
    <div className={cn('space-y-3 text-white', textSm)}>
      <div className="mb-2 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onVoltar}
          className={cn(
            'self-start rounded-lg border border-white/35 bg-white/10 px-2 py-1 font-medium text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50',
            textSm
          )}
        >
          ← Voltar aos municípios
        </button>
        <p className={cn('td-fut-subsection-title font-semibold uppercase tracking-wide text-white', textTitle)}>
          Mobilização · {payload?.municipioOficial ?? municipioFoco}
        </p>
        <p className={cn('text-white/85', textSm)}>
          Lideranças (líderes) e liderados cadastrados neste município — expandir/recolher cada bloco.
        </p>
      </div>

      {loadState === 'loading' ? (
        <p className={cn('flex items-center gap-2 text-white/90', textSm)}>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white" aria-hidden />
          Carregando…
        </p>
      ) : null}

      {(loadState === 'error' || loadState === 'forbidden') && erro ? (
        <p className={cn('text-rose-200', textSm)}>{erro}</p>
      ) : null}

      {loadState === 'ready' && payload ? (
        <div className="space-y-2 overflow-x-auto">
          {payload.lideres.length === 0 ? (
            <p className={cn('text-white/80', textSm)}>Nenhuma liderança cadastrada neste município.</p>
          ) : (
            payload.lideres.map((L) => {
              const n = L.liderados.length
              const resumoLider =
                n === 0
                  ? 'Resumo: nenhum liderado ativo vinculado a este líder neste município.'
                  : n === 1
                    ? 'Resumo: 1 liderado ativo vinculado a este líder neste município.'
                    : `Resumo: ${n} liderados ativos vinculados a este líder neste município.`
              return (
                <details
                  key={L.id}
                  className="group overflow-hidden rounded-lg border border-white/25 bg-white/5 open:bg-white/10"
                  {...detailsAbertoPorPadrao}
                >
                  <summary className="flex cursor-pointer list-none items-start gap-2 px-2.5 py-2 marker:hidden [&::-webkit-details-marker]:hidden">
                    <span
                      aria-hidden
                      className="mt-0.5 inline-block shrink-0 select-none text-[10px] text-white/80 transition-transform duration-200 group-open:rotate-90"
                    >
                      ▸
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('font-semibold text-white', textSm)}>{L.nome}</p>
                      <p className={cn('mt-0.5 text-white/80', textSm)}>{resumoLider}</p>
                      <p className={cn('mt-0.5 text-white/70', textSm)}>
                        Líder
                        {L.telefone ? ` · ${L.telefone}` : ''}
                      </p>
                    </div>
                  </summary>
                  <div className="space-y-2 border-t border-white/20 px-2.5 pb-2.5 pl-8 pt-2">
                    <details
                      className="group/lid rounded-md border border-white/25 bg-white/5 open:bg-white/10"
                      {...detailsAbertoPorPadrao}
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 marker:hidden [&::-webkit-details-marker]:hidden">
                        <span
                          aria-hidden
                          className="inline-block shrink-0 select-none text-[10px] text-white/80 transition-transform duration-200 group-open/lid:rotate-90"
                        >
                          ▸
                        </span>
                        <span className={cn('font-medium text-white', textSm)}>Liderados ({L.liderados.length})</span>
                      </summary>
                      <div className="border-t border-white/15 px-2 pb-2 pt-1">
                        {L.liderados.length === 0 ? (
                          <p className={cn('text-white/75', textSm)}>Nenhum liderado ativo vinculado.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {L.liderados.map((row) => (
                              <li
                                key={row.id}
                                className={cn(
                                  'list-none rounded border border-white/15 bg-white/5 px-2 py-1.5 text-white',
                                  textSm
                                )}
                              >
                                <p className="font-medium text-white">{row.nome}</p>
                                <p className="mt-0.5 text-white/85">
                                  WhatsApp: {row.whatsapp}
                                  {row.instagram ? (
                                    <>
                                      {' '}
                                      · @{String(row.instagram).replace(/^@+/, '')}
                                    </>
                                  ) : null}
                                  {row.cidade ? <> · {row.cidade}</> : null}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </details>
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
