'use client'

import { Users, X } from 'lucide-react'
import {
  calcularIndicadoresDemograficos,
  formatDemografiaNumero,
  formatDemografiaPercent,
  getDemografiaMunicipio,
} from '@/lib/demografia-municipio'
import { cn } from '@/lib/utils'

type PerfilPopulacaoPanelProps = {
  municipio: string | null
  /** Aparência alinhada ao mapa (presença / IPT). */
  appearance?: 'light' | 'dark'
  className?: string
  onClear?: () => void
}

export function PerfilPopulacaoPanel({
  municipio,
  appearance = 'light',
  className,
  onClear,
}: PerfilPopulacaoPanelProps) {
  const isDark = appearance === 'dark'
  const demografia = getDemografiaMunicipio(municipio)
  const indicadores = calcularIndicadoresDemograficos(demografia)

  const cardClass = cn(
    'rounded-lg border p-2.5',
    isDark ? 'border-white/10 bg-white/[0.03]' : 'border-card bg-background/60'
  )

  return (
    <aside
      className={cn(
        'flex min-h-0 w-full flex-col overflow-hidden border-l',
        isDark ? 'border-white/10 bg-surface' : 'border-card bg-surface',
        className
      )}
    >
      <div
        className={cn(
          'shrink-0 border-b px-3 py-2.5',
          isDark ? 'border-white/10 bg-black/20' : 'border-card bg-background/40'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Users
                className={cn('h-4 w-4 shrink-0', isDark ? 'text-cyan-300' : 'text-blue-700')}
                aria-hidden
              />
              <p className="text-sm font-semibold text-text-primary">Perfil da população</p>
            </div>
            <p className="mt-1 text-xs leading-snug text-text-muted">
              Dados IBGE por município: Censo 2022, estimativa recente, sexo e faixas etárias.
            </p>
          </div>
          {municipio && onClear ? (
            <button
              type="button"
              onClick={onClear}
              className={cn(
                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
                isDark
                  ? 'text-white/60 hover:bg-white/10 hover:text-white'
                  : 'text-text-muted hover:bg-background hover:text-text-primary'
              )}
              title="Fechar perfil"
              aria-label="Fechar perfil"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        {!municipio ? (
          <p className="text-sm text-text-secondary">
            Clique em um município no mapa para ver o perfil demográfico.
          </p>
        ) : !demografia ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-primary">{municipio}</p>
            <p className="text-xs text-text-secondary">
              Sem dados demográficos encontrados para este município.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">{demografia.municipio}</p>
              <p className="text-xs text-text-muted">
                {demografia.microrregiao || '-'} · {demografia.mesorregiao || '-'}
              </p>
            </div>

            <div className={cn('grid grid-cols-2 gap-2', cardClass)}>
              <div>
                <p className="text-[11px] text-text-muted">População (Censo 2022)</p>
                <p className="text-sm font-semibold text-text-primary">
                  {formatDemografiaNumero(demografia.populacao_censo_2022)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted">
                  Estimativa ({demografia.ano_estimativa || '-'})
                </p>
                <p className="text-sm font-semibold text-text-primary">
                  {formatDemografiaNumero(demografia.populacao_estimada_ultimo_ano)}
                </p>
              </div>
            </div>

            <div className={cardClass}>
              <p className="mb-1 text-xs font-semibold text-text-primary">Sexo</p>
              <p className="text-xs text-text-secondary">
                Homens: {formatDemografiaNumero(demografia.sexo.masculino)} (
                {formatDemografiaPercent(indicadores?.pctMasc)})
              </p>
              <p className="text-xs text-text-secondary">
                Mulheres: {formatDemografiaNumero(demografia.sexo.feminino)} (
                {formatDemografiaPercent(indicadores?.pctFem)})
              </p>
            </div>

            <div className={cardClass}>
              <p className="mb-1 text-xs font-semibold text-text-primary">Faixa etária</p>
              <p className="text-xs text-text-secondary">
                0-14: {formatDemografiaNumero(demografia.faixas_etarias.de_0_a_14)} (
                {formatDemografiaPercent(indicadores?.pct014)})
              </p>
              <p className="text-xs text-text-secondary">
                15-59: {formatDemografiaNumero(demografia.faixas_etarias.de_15_a_59)} (
                {formatDemografiaPercent(indicadores?.pct1559)})
              </p>
              <p className="text-xs text-text-secondary">
                60+: {formatDemografiaNumero(demografia.faixas_etarias.de_60_ou_mais)} (
                {formatDemografiaPercent(indicadores?.pct60)})
              </p>
            </div>

            <div className={cardClass}>
              <p className="mb-1 text-xs font-semibold text-text-primary">Cor/raça (IBGE)</p>
              <p className="text-xs text-text-secondary">
                Branca: {formatDemografiaNumero(demografia.cor_raca?.branca)}
              </p>
              <p className="text-xs text-text-secondary">
                Parda: {formatDemografiaNumero(demografia.cor_raca?.parda)}
              </p>
              <p className="text-xs text-text-secondary">
                Preta: {formatDemografiaNumero(demografia.cor_raca?.preta)}
              </p>
              <p className="text-xs text-text-secondary">
                Amarela: {formatDemografiaNumero(demografia.cor_raca?.amarela)}
              </p>
              <p className="text-xs text-text-secondary">
                Indígena: {formatDemografiaNumero(demografia.cor_raca?.indigena)}
              </p>
            </div>

            <div className={cardClass}>
              <p className="mb-1 text-xs font-semibold text-text-primary">Escolaridade/alfabetização</p>
              <p className="text-xs text-text-secondary">
                Taxa de alfabetização (15+):{' '}
                {formatDemografiaPercent(demografia.alfabetizacao?.taxa_15_mais)}
              </p>
              <p className="text-xs text-text-secondary">
                Taxa de analfabetismo (15+):{' '}
                {formatDemografiaPercent(demografia.alfabetizacao?.taxa_analfabetismo_15_mais)}
              </p>
            </div>

            <div className={cardClass}>
              <p className="mb-1 text-xs font-semibold text-text-primary">Urbanização (urbano/rural)</p>
              <p className="text-xs text-text-secondary">
                Urbana: {formatDemografiaNumero(demografia.urbanizacao?.urbana)} (
                {formatDemografiaPercent(demografia.urbanizacao?.taxa_urbana)})
              </p>
              <p className="text-xs text-text-secondary">
                Rural: {formatDemografiaNumero(demografia.urbanizacao?.rural)} (
                {formatDemografiaPercent(demografia.urbanizacao?.taxa_rural)})
              </p>
              <p className="mt-1 text-[11px] text-text-muted">Fonte: SIDRA 9923 (Censo 2022).</p>
            </div>

            <div className={cardClass}>
              <p className="mb-1 text-xs font-semibold text-text-primary">Renda e vulnerabilidade</p>
              <p className="text-xs text-text-secondary">
                Renda per capita:{' '}
                {formatDemografiaNumero(demografia.renda_vulnerabilidade?.renda_per_capita)}
              </p>
              <p className="text-xs text-text-secondary">
                % vulneráveis à pobreza:{' '}
                {formatDemografiaPercent(
                  demografia.renda_vulnerabilidade?.percentual_vulneraveis_pobreza
                )}
              </p>
              <p className="mt-1 text-[11px] text-text-muted">
                Fonte: Ipeadata/Atlas DH (
                {demografia.renda_vulnerabilidade?.ano_referencia || '-'})
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
