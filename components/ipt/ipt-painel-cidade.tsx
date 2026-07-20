'use client'

import { Filter, MapPin, X } from 'lucide-react'
import type { IptMissaoFiltro, IptMunicipio } from '@/lib/ipt'
import { prioridadeImpactoMissao, temExpectativa } from '@/lib/ipt-missoes'
import type { ObraMapaRow } from '@/lib/obras-mapa'
import { IptMissaoDetalhe } from '@/components/ipt/ipt-missao-detalhe'
import { IptRadarNoticias } from '@/components/ipt/ipt-radar-noticias'
import { cn } from '@/lib/utils'

type Props = {
  municipio: IptMunicipio | null
  missaoAtiva: IptMissaoFiltro
  obras: ObraMapaRow[]
  filtradoNaPagina: boolean
  onFiltrarPagina: () => void
  onLimpar: () => void
}

/**
 * Painel master–detail da cidade: diagnóstico da missão + contexto local (Radar)
 * num único bloco à direita das Prioridades.
 */
export function IptPainelCidade({
  municipio,
  missaoAtiva,
  obras,
  filtradoNaPagina,
  onFiltrarPagina,
  onLimpar,
}: Props) {
  if (!municipio) {
    return (
      <section className="ipt-bloco ipt-painel-cidade ipt-painel-cidade--empty" aria-label="Painel do município">
        <div className="ipt-painel-cidade__empty">
          <MapPin className="ipt-painel-cidade__empty-ico" aria-hidden />
          <h2 className="ipt-painel-cidade__empty-title">Município</h2>
          <p className="ipt-painel-cidade__empty-text">
            Clique em um município nas prioridades para ver o diagnóstico da missão e o
            contexto local (Radar 224).
          </p>
        </div>
      </section>
    )
  }

  const impacto = prioridadeImpactoMissao(municipio, missaoAtiva)
  const semMeta = missaoAtiva === 'expectativa' && !temExpectativa(municipio)

  return (
    <section className="ipt-bloco ipt-painel-cidade" aria-label={`Painel de ${municipio.municipio}`}>
      <header className="ipt-painel-cidade__head">
        <div className="ipt-painel-cidade__head-main">
          <p className="ipt-painel-cidade__eyebrow">Município selecionado</p>
          <h2 className="ipt-painel-cidade__title">{municipio.municipio}</h2>
        </div>
        <div className="ipt-painel-cidade__actions">
          {semMeta ? (
            <span className="ipt-bloco-detalhe__badge ipt-bloco-detalhe__badge--neutro">Sem meta</span>
          ) : impacto !== 'baixa' ? (
            <span
              className={cn(
                'ipt-bloco-detalhe__badge',
                impacto === 'alta'
                  ? 'ipt-bloco-detalhe__badge--alta'
                  : 'ipt-bloco-detalhe__badge--media'
              )}
            >
              Prioridade {impacto === 'alta' ? 'alta' : 'média'}
            </span>
          ) : null}
          <button
            type="button"
            className={cn(
              'ipt-painel-cidade__btn',
              filtradoNaPagina && 'ipt-painel-cidade__btn--active'
            )}
            onClick={onFiltrarPagina}
            title={
              filtradoNaPagina
                ? 'Remover filtro da página neste município'
                : 'Filtrar a página neste município'
            }
          >
            <Filter className="h-3.5 w-3.5" aria-hidden />
            {filtradoNaPagina ? 'Filtrado' : 'Filtrar página'}
          </button>
          <button
            type="button"
            className="ipt-painel-cidade__btn ipt-painel-cidade__btn--ghost"
            onClick={onLimpar}
            aria-label="Limpar seleção"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Fechar
          </button>
        </div>
      </header>

      <div className="ipt-painel-cidade__scroll">
        <div className="ipt-painel-cidade__bloco">
          <h3 className="ipt-painel-cidade__section-label">Diagnóstico da missão</h3>
          <IptMissaoDetalhe
            municipio={municipio}
            missaoAtiva={missaoAtiva}
            obras={obras}
            embedded
            panel
          />
        </div>
        <div className="ipt-painel-cidade__bloco ipt-painel-cidade__bloco--radar">
          <IptRadarNoticias
            municipio={municipio.municipio}
            entregasMandato={municipio.detalhes.obrasQuantidade ?? 0}
            compact
          />
        </div>
      </div>
    </section>
  )
}
