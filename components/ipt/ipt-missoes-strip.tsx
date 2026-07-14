'use client'

import type { CSSProperties } from 'react'
import { Building2, MapPin, Megaphone, Smartphone, Target } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import {
  enrichMissaoCard,
  IPT_MISSOES,
  IPT_TOTAL_MUNICIPIOS_PI,
  type IptMissaoFiltro,
  type IptMissaoId,
  type IptMissaoVariacao,
} from '@/lib/ipt-missoes'
import type { IptMunicipio } from '@/lib/ipt'
import { cn } from '@/lib/utils'

const MISSAO_ICONE = {
  expectativa: Target,
  campo: MapPin,
  pesquisa: Megaphone,
  digital: Smartphone,
  obras: Building2,
} as const

const SPARK: Record<IptMissaoId, number[]> = {
  expectativa: [48, 55, 60, 68, 72, 80, 88],
  campo: [28, 48, 36, 62, 44, 78, 55],
  pesquisa: [40, 32, 58, 46, 70, 52, 64],
  digital: [22, 38, 30, 55, 42, 68, 50],
  obras: [35, 50, 42, 60, 48, 72, 58],
}

type Props = {
  municipios: IptMunicipio[]
  contagem: Record<IptMissaoId, number>
  variacoes: Record<IptMissaoId, IptMissaoVariacao>
  missaoAtiva: IptMissaoFiltro
  loading?: boolean
  onSelect: (missao: IptMissaoId) => void
}

export function IptMissoesStrip({
  municipios,
  contagem,
  variacoes,
  missaoAtiva,
  loading,
  onSelect,
}: Props) {
  const temFiltro = missaoAtiva !== 'todas'

  return (
    <section className="ipt-missoes" aria-label="Missões estratégicas">
      <div className={cn('ipt-missoes__grid', temFiltro && 'ipt-missoes__grid--filtrado')}>
        {IPT_MISSOES.map((missao) => {
          const Icon = MISSAO_ICONE[missao.id]
          const qtd = contagem[missao.id]
          const ativo = missaoAtiva === missao.id
          const spark = SPARK[missao.id]
          const sparkMax = Math.max(...spark)
          const vazia = qtd === 0
          const enrich = enrichMissaoCard(
            missao.id,
            municipios,
            qtd,
            variacoes[missao.id]
          )
          return (
            <button
              key={missao.id}
              type="button"
              disabled={loading}
              onClick={() => onSelect(missao.id)}
              className={cn(
                'ipt-missao-card',
                ativo && 'ipt-missao-card--active',
                temFiltro && !ativo && 'ipt-missao-card--muted',
                vazia && 'ipt-missao-card--empty'
              )}
              style={
                {
                  '--missao-cor': missao.cor,
                  '--missao-suave': missao.corSuave,
                  '--missao-texto': missao.corTexto,
                  '--missao-tint': missao.corTint,
                } as CSSProperties
              }
            >
              <div className="ipt-missao-card__spark" aria-hidden>
                {spark.map((v, i) => (
                  <span
                    key={`${missao.id}-${i}`}
                    style={{ height: `${Math.max(22, (v / sparkMax) * 100)}%` }}
                  />
                ))}
              </div>

              <div className="ipt-missao-card__top">
                <span className="ipt-missao-card__icon" aria-hidden>
                  <CockpitIcon icon={Icon} size="sm" />
                </span>
                <span className="ipt-missao-card__badge">{missao.label}</span>
              </div>

              <p className="ipt-missao-card__titulo">{missao.titulo}</p>

              <p className="ipt-missao-card__desc">
                {vazia ? (
                  enrich.descricaoAtiva
                ) : (
                  <>
                    <strong>{qtd}</strong> municípios {enrich.descricaoAtiva}
                  </>
                )}
              </p>

              {!vazia ? (
                <ul className="ipt-missao-card__bullets">
                  <li>{enrich.tensao}</li>
                  <li>
                    {missao.id === 'expectativa'
                      ? `Universo Piauí: ${IPT_TOTAL_MUNICIPIOS_PI} municípios`
                      : enrich.epicentros}
                  </li>
                  <li>{enrich.mudanca}</li>
                </ul>
              ) : null}

              <span className="ipt-missao-card__cta">
                Ver prioridades
                <span aria-hidden>→</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
