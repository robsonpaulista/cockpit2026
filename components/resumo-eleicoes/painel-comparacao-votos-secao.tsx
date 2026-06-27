'use client'

import { cn } from '@/lib/utils'
import {
  resumoAmberBarAltaClass,
  resumoAmberBarMediaClass,
  resumoAmberSimilaridadeAltaClass,
  resumoAmberSimilaridadeMediaClass,
  resumoAccentTextClass,
} from '@/lib/resumo-eleicoes-table-styles'
import {
  MARGEM_VOTOS_PARECIDOS,
  type AnaliseComparacaoVotos,
} from '@/lib/votacao-secao-correlacao'
import type { CandidatoMatrizColuna } from '@/lib/votacao-secao-matriz'

function abreviarCargo(dsCargo: string): string {
  const map: Record<string, string> = {
    'Deputado Federal': 'Fed.',
    'Deputado Estadual': 'Est.',
    Governador: 'Gov.',
    Senador: 'Sen.',
    Prefeito: 'Pref.',
    Vereador: 'Ver.',
  }
  return map[dsCargo] ?? dsCargo
}

function rotuloCabecalhoCandidato(c: CandidatoMatrizColuna, multiAno: boolean): string {
  if (multiAno && c.anoEleicao != null) {
    return `${abreviarCargo(c.dsCargo)} ${c.anoEleicao}`
  }
  return abreviarCargo(c.dsCargo)
}

export function PainelComparacaoVotosSecao({
  analises,
  compacto = false,
}: {
  analises: AnaliseComparacaoVotos[]
  compacto?: boolean
}) {
  const margemPct = Math.round(MARGEM_VOTOS_PARECIDOS * 100)

  if (analises.length === 0) return null

  return (
    <div
      className={cn(
        'rounded-2xl border border-card bg-surface',
        compacto ? 'mb-3 p-3' : 'mb-4 p-4',
      )}
    >
      <h2 className={cn('font-semibold text-text-primary', compacto ? 'mb-1 text-xs' : 'mb-1 text-sm')}>
        Semelhança de votos por seção
      </h2>
      <p className={cn('mb-3 text-text-secondary', compacto ? 'text-[10px]' : 'text-xs')}>
        Percentual de urnas em que os dois candidatos tiveram quantidade de votos semelhante (até{' '}
        {margemPct}% de diferença). Abaixo, a soma de votos de cada um nessas urnas.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {analises.map((a) => (
          <div
            key={`${a.candidatoA.id}::${a.candidatoB.id}`}
            className={cn(
              'rounded-xl border p-4',
              a.nivel === 'alta' && resumoAmberSimilaridadeAltaClass,
              a.nivel === 'media' && resumoAmberSimilaridadeMediaClass,
              a.nivel === 'baixa' && 'border-card bg-background/40',
              a.nivel === 'minima' && 'border-card bg-background/20',
            )}
          >
            <p className="text-[11px] font-medium text-text-secondary">
              <span className={cn('font-semibold uppercase', resumoAccentTextClass())}>
                {rotuloCabecalhoCandidato(a.candidatoA, Boolean(a.candidatoA.anoEleicao))}
              </span>{' '}
              <span className="text-text-primary">{a.candidatoA.nmVotavel}</span>
              {' × '}
              <span className={cn('font-semibold uppercase', resumoAccentTextClass())}>
                {rotuloCabecalhoCandidato(a.candidatoB, Boolean(a.candidatoB.anoEleicao))}
              </span>{' '}
              <span className="text-text-primary">{a.candidatoB.nmVotavel}</span>
            </p>
            <p className="mt-3 text-3xl font-bold tabular-nums text-text-primary">
              {a.pctSecoesParecidas.toFixed(0)}%
            </p>
            <p className="text-xs text-text-secondary">de urnas com votos semelhantes</p>
            {a.secoesParecidas > 0 ? (
              <div className="mt-2 space-y-1 text-[11px] leading-snug text-text-secondary">
                <p>
                  <span className="font-medium text-text-primary">
                    {a.votosASemelhantes.toLocaleString('pt-BR')} votos
                  </span>{' '}
                  ({a.pctVotosASobreTotal.toFixed(0)}% do total){' '}
                  <span className="text-text-primary">{a.candidatoA.nmVotavel}</span>
                </p>
                <p>
                  <span className="font-medium text-text-primary">
                    {a.votosBSemelhantes.toLocaleString('pt-BR')} votos
                  </span>{' '}
                  ({a.pctVotosBSobreTotal.toFixed(0)}% do total){' '}
                  <span className="text-text-primary">{a.candidatoB.nmVotavel}</span>
                </p>
              </div>
            ) : null}
            <p className="mt-1 text-xs font-semibold text-text-primary">{a.rotuloNivel}</p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-background"
              role="presentation"
            >
              <div
                className={cn(
                  'h-full rounded-full',
                  a.nivel === 'alta' && resumoAmberBarAltaClass,
                  a.nivel === 'media' && resumoAmberBarMediaClass,
                  a.nivel === 'baixa' && 'bg-text-secondary/40',
                  a.nivel === 'minima' && 'bg-text-secondary/25',
                )}
                style={{ width: `${Math.min(100, a.pctSecoesParecidas)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-text-secondary">{a.resumo}</p>
            <p className="mt-1 text-[10px] text-text-secondary">
              {a.secoesParecidas} seções semelhantes · {a.secoesComAmbos} com votos nos dois ·{' '}
              {a.secoesTotal} seções no município
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
