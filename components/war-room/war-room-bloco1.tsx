'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { IconChartBar, IconLoader2 } from '@tabler/icons-react'
import { IptMissaoLista } from '@/components/ipt/ipt-missao-lista'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import { useWarRoomCidade } from '@/components/war-room/war-room-cidade-context'
import { WarRoomEvolucaoCard } from '@/components/war-room/war-room-evolucao-card'
import {
  WarRoomMiniPager,
  warRoomPageCount,
} from '@/components/war-room/war-room-mini-pager'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import { useIpt } from '@/hooks/use-ipt'
import { usePermissions } from '@/hooks/use-permissions'
import {
  filtrarMunicipiosVisaoUniverso,
  ordenarMunicipiosMissao,
} from '@/lib/ipt-missoes'
import { cn } from '@/lib/utils'
import '@/app/dashboard/territorio/ipt/ipt-operacional.css'

type MetaFiltro = 'todos' | 'com' | 'sem'

const PAGE_SIZE_EXPECTATIVA = 15

const META_FILTRO_OPCOES: Array<{ id: MetaFiltro; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'com', label: 'Com meta' },
  { id: 'sem', label: 'Sem meta' },
]

type Bloco1Props = {
  universoClassName?: string
  resumoClassName?: string
  colClassName?: string
}

/**
 * Bloco 1 da War Room: Expectativa de Votos + Evolução (movimentos).
 */
export function WarRoomBloco1({
  universoClassName,
  resumoClassName,
  colClassName,
}: Bloco1Props) {
  const { loading, error, municipios, recarregar } = useIpt()
  const { register } = useWarRoomRefresh()
  const change = useWarRoomCardChange('expectativa')
  const { isAdmin, canAccess } = usePermissions()
  const podeVerExpectativa =
    isAdmin || canAccess('territorio') || canAccess('ipt')
  const { municipio: selecionado, setMunicipio: setSelecionado } =
    useWarRoomCidade()
  const [metaFiltro, setMetaFiltro] = useState<MetaFiltro>('todos')
  const [page, setPage] = useState(0)

  useEffect(() => {
    return register('expectativa', async ({ silent }) => {
      await recarregar({ silent })
    })
  }, [register, recarregar])

  const universo = useMemo(() => {
    const filtrados = filtrarMunicipiosVisaoUniverso(
      municipios,
      'expectativa',
      'com_expectativa',
    )
    const ordenados = ordenarMunicipiosMissao(
      filtrados,
      'expectativa',
      'com_expectativa',
    )
    if (metaFiltro === 'com') {
      return ordenados.filter((m) => m.expectativaVotos > 0)
    }
    if (metaFiltro === 'sem') {
      return ordenados.filter((m) => m.expectativaVotos <= 0)
    }
    return ordenados
  }, [municipios, metaFiltro])

  const snapshotLines = useMemo(
    () =>
      universo.map(
        (m) =>
          `${m.municipio}\t${m.expectativaVotos}\t${m.pesoExpectativaPct.toFixed(2)}`,
      ),
    [universo],
  )

  const { changedKeys } = useWarRoomSnapshot({
    cardId: 'expectativa',
    lines: loading ? null : snapshotLines,
    noun: 'município',
    ready: !loading && municipios.length > 0,
  })

  const destaqueMunicipios = useMemo(
    () => new Set(changedKeys),
    [changedKeys],
  )

  useEffect(() => {
    setPage(0)
  }, [metaFiltro])

  useEffect(() => {
    const max = warRoomPageCount(universo.length, PAGE_SIZE_EXPECTATIVA) - 1
    if (page > max) setPage(Math.max(0, max))
  }, [page, universo.length])

  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE_EXPECTATIVA
    return universo.slice(start, start + PAGE_SIZE_EXPECTATIVA)
  }, [universo, page])

  /** Por padrão (e ao filtrar), mantém a 1ª cidade da tabela selecionada. */
  useEffect(() => {
    if (universo.length === 0) {
      setSelecionado(null)
      return
    }
    const aindaNaLista =
      selecionado != null &&
      universo.some((m) => m.municipio === selecionado)
    if (!aindaNaLista) {
      setSelecionado(universo[0].municipio)
    }
  }, [universo, selecionado, setSelecionado])

  return (
    <div className={colClassName}>
      <section className={universoClassName} aria-label="Expectativa de Votos">
        <div className="wr-ipt-universo">
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 px-3.5 pt-3.5 md:px-4 md:pt-4">
            <h2 className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#57534e]">
              <IconChartBar
                className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--color-primary))]"
                stroke={1.5}
                aria-hidden
              />
              <span className="truncate">Expectativa de Votos</span>
              <WarRoomChangeBadge change={change} />
            </h2>
            <div className="flex shrink-0 items-center gap-2.5">
              <div
                className="wr-meta-filtro"
                role="group"
                aria-label="Filtrar por expectativa"
              >
                {META_FILTRO_OPCOES.map((opcao) => (
                  <button
                    key={opcao.id}
                    type="button"
                    aria-pressed={metaFiltro === opcao.id}
                    className={cn(
                      'wr-meta-filtro__btn',
                      metaFiltro === opcao.id && 'wr-meta-filtro__btn--active',
                    )}
                    onClick={() => setMetaFiltro(opcao.id)}
                  >
                    {opcao.label}
                  </button>
                ))}
              </div>
              <Link
                href="/dashboard/territorio/ipt"
                className="shrink-0 text-[12px] font-medium text-[rgb(var(--color-primary))] transition-opacity hover:opacity-80"
              >
                Ver detalhes
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center py-10">
              <IconLoader2 className="h-5 w-5 animate-spin text-[#a8a29e]" stroke={1.5} />
            </div>
          ) : error ? (
            <p className="px-3 py-6 text-center text-[12px] text-[#dc2626]">{error}</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <IptMissaoLista
                municipios={pageRows}
                missaoAtiva="expectativa"
                visaoUniverso="com_expectativa"
                selecionado={selecionado}
                onSelect={setSelecionado}
                podeVerExpectativa={podeVerExpectativa}
                embedded
                hideHead
                ocultarPopulacao
                destaqueMunicipios={destaqueMunicipios}
              />
              <WarRoomMiniPager
                className="mx-3 mb-3 mt-1"
                page={page}
                total={universo.length}
                pageSize={PAGE_SIZE_EXPECTATIVA}
                onChange={setPage}
              />
            </div>
          )}
        </div>
      </section>

      <WarRoomEvolucaoCard className={resumoClassName} />
    </div>
  )
}
