'use client'

import { formatarDataIso, type ArenaPeriodoFiltro } from '@/hooks/use-arena-perfis'
import { ARENA_PERIODOS, hojeBrasilia, somarDias } from '@/lib/arena/periodo'
import { cn } from '@/lib/utils'

type Props = {
  filtro: ArenaPeriodoFiltro
}

export function ArenaFiltroPeriodo({ filtro }: Props) {
  const { periodo, de, ate, intervalo, definir } = filtro

  return (
    <section className="arena-card" aria-label="Filtros">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="arena-field">
          <span id="arena-periodo-rotulo" className="arena-field__rotulo">
            Período
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="arena-periodo-rotulo">
            {ARENA_PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={periodo === p.id}
                className={cn('arena-nav__link', periodo === p.id && 'arena-nav__link--on')}
                onClick={() => {
                  if (p.id === 'personalizado') {
                    const hoje = hojeBrasilia()
                    definir('personalizado', de ?? somarDias(hoje, -29), ate ?? hoje)
                  } else {
                    definir(p.id)
                  }
                }}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
        </div>

        {periodo === 'personalizado' ? (
          <>
            <div className="arena-field">
              <label htmlFor="arena-periodo-de">De</label>
              <input
                id="arena-periodo-de"
                type="date"
                value={de ?? ''}
                max={ate ?? undefined}
                onChange={(e) => definir('personalizado', e.target.value || null, ate)}
              />
            </div>
            <div className="arena-field">
              <label htmlFor="arena-periodo-ate">Até</label>
              <input
                id="arena-periodo-ate"
                type="date"
                value={ate ?? ''}
                min={de ?? undefined}
                onChange={(e) => definir('personalizado', de, e.target.value || null)}
              />
            </div>
          </>
        ) : null}

        <p className="arena-sub m-0 pb-2">
          Pontuação de {formatarDataIso(intervalo.inicio)} a {formatarDataIso(intervalo.fim)} ·
          atualizada a cada sincronização do Instagram
        </p>
      </div>
    </section>
  )
}
