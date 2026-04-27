'use client'

import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { KPI } from '@/types'
import { TrendingUp, TrendingDown, Trophy, Eye, EyeOff, UsersRound } from 'lucide-react'
import {
  useEffect,
  useId,
  useState,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
interface InfoLine {
  text: string
  type?: 'positive' | 'negative' | 'neutral'
  icon?: 'trending' | 'trophy'
}

function splitVariacaoEleicaoCockpitInline(raw: string | undefined): { pill: string; rest: string } | null {
  const t = raw?.trim()
  if (!t) return null
  const m = t.match(/^([+−\-]?\d+[,.]?\d*%)\s+(vs\s+.+)$/iu)
  if (m) return { pill: m[1].replace('−', '-'), rest: m[2].trim() }
  return { pill: t, rest: '' }
}

function CockpitExpectativaGrowthArea({
  values,
  heroDark,
  heightPx = 132,
}: {
  values: number[]
  heroDark: boolean
  /** Altura do gráfico em px (ex.: ao lado do número, usar ~100). */
  heightPx?: number
}) {
  const gradId = `cockpit-exp-fill-${useId().replace(/:/g, '')}`
  const stroke = heroDark ? '#38bdf8' : '#0e74bc'
  const data = values.map((v, i) => ({ i, v }))
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const span = Math.max(1, maxV - minV)
  const low = minV - span * 0.1
  const hi = maxV + span * 0.06
  const showDots = values.length <= 18

  return (
    <ResponsiveContainer width="100%" height={heightPx}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: 2, bottom: 4 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={heroDark ? 0.5 : 0.38} />
            <stop offset="55%" stopColor={stroke} stopOpacity={heroDark ? 0.18 : 0.14} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={[low, hi]} hide />
        <Area
          type="monotone"
          dataKey="v"
          stroke={stroke}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          isAnimationActive
          animationDuration={880}
          dot={
            showDots
              ? {
                  r: heroDark ? 3.5 : 3,
                  fill: stroke,
                  stroke: heroDark ? '#0f172a' : '#fff',
                  strokeWidth: heroDark ? 2 : 1.5,
                }
              : false
          }
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface KPIHeroCardProps {
  kpi: KPI
  subtitle?: string
  infoLines?: InfoLine[]
  hideValueByDefault?: boolean
  cenarioVotos?: 'aferido_jadyel' | 'promessa_lideranca' | 'legado_anterior'
  onChangeCenarioVotos?: (cenario: 'aferido_jadyel' | 'promessa_lideranca' | 'legado_anterior') => void
  /** Visual do tema Cockpit Vivo (hero azul profundo + estrela sutil). */
  variant?: 'default' | 'cockpit'
  /** Classes no wrapper clicável (ex.: flex-1 para igualar altura ao card ao lado). */
  shellClassName?: string
  /** Classes no cartão colorido interno. */
  contentClassName?: string
  /** Painel lateral no Cockpit (ex.: Radar de movimento), no lugar do bloco antigo “Momento atual”. */
  cockpitMomentoAtual?: ReactNode
  /** Cabeçalho fixo acima da lista (título Radar + expandir); a lista rola em `cockpitMomentoAtual`. */
  cockpitRadarFixedHeader?: ReactNode
  /** Ref na área rolável da lista (auto-scroll do Monitor, barra oculta via .monitor-scroll). */
  cockpitRadarScrollRef?: Ref<HTMLDivElement>
  onCockpitRadarScrollMouseEnter?: () => void
  onCockpitRadarScrollMouseLeave?: () => void
  /** Ex.: "+6,1% vs eleição anterior (83.175 votos)" imediatamente ao lado do selo Hoje (J/L/A). */
  inlineVariacaoEleicao?: string
  /** Tom visual da variação (queda vs eleição anterior). */
  inlineVariacaoEleicaoTone?: 'neutral' | 'negative'
  /**
   * Cockpit + radar na mesma linha dos demais KPIs: layout em flex (sem painel absolute),
   * com destaque visual (anel) para alinhar à referência Visão Geral.
   */
  cockpitInlineRow?: boolean
  /** Votos ao longo do tempo (ex.: eleição anterior → atual); gráfico de área só com `cockpitInlineRow`. */
  cockpitExpectativaTrendValues?: number[]
  /** Legenda sob o gráfico (referência Cockpit: “Evolução dos últimos 6 períodos”). */
  cockpitExpectativaChartCaption?: string
}

export function KPIHeroCard({
  kpi,
  subtitle,
  infoLines,
  hideValueByDefault = false,
  cenarioVotos,
  onChangeCenarioVotos,
  variant = 'default',
  shellClassName,
  contentClassName,
  cockpitMomentoAtual,
  cockpitRadarFixedHeader,
  cockpitRadarScrollRef,
  onCockpitRadarScrollMouseEnter,
  onCockpitRadarScrollMouseLeave,
  inlineVariacaoEleicao,
  inlineVariacaoEleicaoTone = 'neutral',
  cockpitInlineRow = false,
  cockpitExpectativaTrendValues,
  cockpitExpectativaChartCaption = 'Evolução dos últimos 6 períodos',
}: KPIHeroCardProps) {
  const { appearance } = useTheme()
  const heroDark = variant === 'cockpit' && appearance === 'dark'
  const cockpitBorderSubtle = heroDark ? 'border-gray-800/70' : 'border-white/15'
  const cockpitRadarPanel = heroDark
    ? 'border-gray-800/70 bg-[#0d1320]/90 lg:border-gray-800/70'
    : 'border-white/15'

  const [displayValue, setDisplayValue] = useState<string | number>('0')
  const [isAnimating, setIsAnimating] = useState(false)
  const [isValueVisible, setIsValueVisible] = useState(!hideValueByDefault)

  useEffect(() => {
    setIsValueVisible(!hideValueByDefault)
  }, [hideValueByDefault, kpi.id])

  useEffect(() => {
    setIsAnimating(true)
    const numericValue = typeof kpi.value === 'string' 
      ? parseFloat(kpi.value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
      : kpi.value || 0

    if (typeof numericValue === 'number' && numericValue > 0 && !kpi.value.toString().includes('/')) {
      const duration = 900 // mais lento = mais impactante
      const fps = 60
      const totalFrames = Math.round(duration / (1000 / fps))
      let frame = 0

      const timer = setInterval(() => {
        frame++
        // Easing: desacelera no final (easeOutExpo)
        const progress = 1 - Math.pow(1 - frame / totalFrames, 3)
        const current = Math.floor(numericValue * progress)
        setDisplayValue(current.toLocaleString('pt-BR'))

        if (frame >= totalFrames) {
          clearInterval(timer)
          setDisplayValue(kpi.value)
          setIsAnimating(false)
        }
      }, 1000 / fps)
      
      return () => clearInterval(timer)
    } else {
      setDisplayValue(kpi.value)
      setIsAnimating(false)
    }
  }, [kpi.value])

  const getInfoLineColor = (_type?: 'positive' | 'negative' | 'neutral') => {
    if (_type === 'positive') return 'text-emerald-100'
    if (_type === 'negative') return 'text-red-100'
    return 'text-[rgb(var(--strategic-yellow))]'
  }

  /** Detalhes no card expectativa alinhados ao Cockpit (verde/cinza como os KPIs da grade). */
  const getInfoLineColorCockpitInline = (_type?: 'positive' | 'negative' | 'neutral') => {
    if (!heroDark) {
      if (_type === 'positive') return 'text-emerald-600'
      if (_type === 'negative') return 'text-rose-600'
      return 'text-slate-600'
    }
    if (_type === 'positive') return 'text-emerald-400'
    if (_type === 'negative') return 'text-rose-400'
    return 'text-slate-400'
  }

  const getInfoLineIcon = (line: InfoLine) => {
    if (line.icon === 'trophy') return <Trophy className="w-4 h-4 flex-shrink-0" />
    if (line.icon === 'trending' && line.type === 'positive') return <TrendingUp className="w-4 h-4 flex-shrink-0" />
    if (line.icon === 'trending' && line.type === 'negative') return <TrendingDown className="w-4 h-4 flex-shrink-0" />
    return null
  }

  const handleToggleVisibility = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    event.preventDefault()
    setIsValueVisible((prev) => !prev)
  }

  const handleChangeCenario = (
    event: MouseEvent<HTMLButtonElement>,
    cenario: 'aferido_jadyel' | 'promessa_lideranca' | 'legado_anterior'
  ) => {
    event.stopPropagation()
    event.preventDefault()
    onChangeCenarioVotos?.(cenario)
  }

  const cockpitComRadar =
    variant === 'cockpit' &&
    Boolean(cockpitMomentoAtual != null || cockpitRadarFixedHeader != null)

  const expectativaChartLayout =
    cockpitInlineRow &&
    cockpitExpectativaTrendValues &&
    cockpitExpectativaTrendValues.length >= 2

  const variacaoSplit = splitVariacaoEleicaoCockpitInline(inlineVariacaoEleicao)

  const heroIconBlock =
    cockpitInlineRow && !expectativaChartLayout ? (
      <div className="flex shrink-0 pt-0.5" aria-hidden>
        <UsersRound
          className={cn(
            'h-6 w-6 shrink-0 stroke-[1.25]',
            heroDark ? 'text-[#38bdf8]' : 'text-[#0e74bc]'
          )}
        />
      </div>
    ) : cockpitInlineRow && expectativaChartLayout ? (
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1',
          heroDark
            ? 'bg-[#1e3a5f] ring-sky-500/30'
            : 'bg-[#0e74bc]/15 ring-[#0e74bc]/25'
        )}
        aria-hidden
      >
        <TrendingUp
          className={cn('h-5 w-5 stroke-[1.35]', heroDark ? 'text-sky-400' : 'text-[#0e74bc]')}
        />
      </div>
    ) : (
    <div
      className={cn(
        'animate-breathe flex-shrink-0 rounded-xl p-3',
        heroDark ? 'bg-[#2563eb] shadow-sm ring-1 ring-white/10' : 'bg-white/20'
      )}
    >
      <TrendingUp className="h-7 w-7 text-white sm:h-8 sm:w-8" />
    </div>
  )

  const heroValueNumberRow = (
    <>
      {!cockpitInlineRow ? (
        <span
          className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-[rgb(var(--strategic-yellow))]"
          style={{ boxShadow: '0 0 0 3px rgba(242, 201, 76, 0.22)' }}
          title="Indicador estratégico"
        />
      ) : null}
      <p
        className={cn(
          'min-w-0 font-bold tabular-nums text-white transition-all duration-300',
          cockpitInlineRow
            ? 'text-[1.65rem] leading-none tracking-tight sm:text-[1.75rem]'
            : 'text-3xl font-black sm:text-4xl',
          !isValueVisible && 'select-none tracking-wider',
          isAnimating && 'scale-105'
        )}
      >
        {isValueVisible ? displayValue : '••••••'}
      </p>
      {hideValueByDefault && !cockpitInlineRow && (
        <button
          type="button"
          onClick={handleToggleVisibility}
          className="rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
          title={isValueVisible ? 'Ocultar valor' : 'Mostrar valor'}
          aria-label={isValueVisible ? 'Ocultar valor' : 'Mostrar valor'}
        >
          {isValueVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </>
  )

  const variacaoInlineClass =
    variant === 'cockpit'
      ? inlineVariacaoEleicaoTone === 'negative'
        ? cockpitInlineRow
          ? heroDark
            ? 'text-rose-400'
            : 'text-rose-600'
          : 'text-red-200'
        : cockpitInlineRow
          ? heroDark
            ? 'text-amber-200/95'
            : 'text-amber-700'
          : 'text-[rgb(var(--strategic-yellow))]'
      : inlineVariacaoEleicaoTone === 'negative'
        ? 'text-red-100'
        : 'text-emerald-100'

  const heroCenarioHojeInline = cockpitInlineRow ? null : (
    <>
      {cenarioVotos && onChangeCenarioVotos && (
        <div className="inline-flex flex-shrink-0 overflow-hidden rounded-md border border-white/30 bg-white/15">
          <button
            type="button"
            onClick={(event) => handleChangeCenario(event, 'aferido_jadyel')}
            className={cn(
              'px-2 py-1 text-[10px] font-semibold transition-colors',
              cenarioVotos === 'aferido_jadyel'
                ? 'bg-white text-accent-gold'
                : 'text-white/85 hover:bg-white/20'
            )}
            title="Visão Jadyel"
            aria-label="Visão Jadyel"
          >
            J
          </button>
          <button
            type="button"
            onClick={(event) => handleChangeCenario(event, 'promessa_lideranca')}
            className={cn(
              'px-2 py-1 text-[10px] font-semibold transition-colors',
              cenarioVotos === 'promessa_lideranca'
                ? 'bg-white text-accent-gold'
                : 'text-white/85 hover:bg-white/20'
            )}
            title="Visão Lideranças"
            aria-label="Visão Lideranças"
          >
            L
          </button>
          <button
            type="button"
            onClick={(event) => handleChangeCenario(event, 'legado_anterior')}
            className={cn(
              'px-2 py-1 text-[10px] font-semibold transition-colors',
              cenarioVotos === 'legado_anterior'
                ? 'bg-white text-accent-gold'
                : 'text-white/85 hover:bg-white/20'
            )}
            title="Visão Anterior"
            aria-label="Visão Anterior"
          >
            A
          </button>
        </div>
      )}
      <span className="rounded border border-white/30 bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
        Hoje
      </span>
      {inlineVariacaoEleicao ? (
        <span
          className={cn(
            'max-w-[min(100%,32rem)] text-[10px] font-medium leading-snug sm:text-[11px]',
            variacaoInlineClass
          )}
        >
          {inlineVariacaoEleicao}
        </span>
      ) : null}
    </>
  )

  const heroInfoLinesBlock = (opts?: { className?: string }) =>
    infoLines && infoLines.length > 0 ? (
      <div className={cn('flex flex-col gap-1.5', opts?.className)}>
        {infoLines.map((line, idx) => {
          const lineIcon = getInfoLineIcon(line)
          const textClass =
            variant === 'cockpit' && cockpitInlineRow
              ? getInfoLineColorCockpitInline(line.type)
              : getInfoLineColor(line.type)
          if (cockpitInlineRow) {
            return (
              <p key={idx} className={cn('text-center text-xs font-medium leading-snug sm:text-left', textClass)}>
                {lineIcon ? (
                  <span className="inline-flex items-center justify-center gap-2 sm:justify-start">
                    {lineIcon}
                    {line.text}
                  </span>
                ) : (
                  line.text
                )}
              </p>
            )
          }
          return (
            <span
              key={idx}
              className={cn(
                'flex items-start gap-2 text-xs font-medium leading-relaxed sm:items-center',
                textClass
              )}
            >
              <span className="mt-0.5 flex-shrink-0 sm:mt-0">{lineIcon}</span>
              <span className="min-w-0 break-words">{line.text}</span>
            </span>
          )
        })}
      </div>
    ) : null

  /** Tema padrão (ouro): título + detalhes à esquerda; valor + botões à direita. */
  const heroLabelColumn = (
    <div className="flex min-w-0 flex-1 gap-3 sm:gap-4 lg:items-center">
      {heroIconBlock}
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold leading-snug text-white transition-colors group-hover:text-white/90">
          {kpi.label}
        </p>
        {subtitle && !infoLines && <p className="mt-1 text-sm text-white/70">{subtitle}</p>}
        {heroInfoLinesBlock({ className: 'mt-2' })}
      </div>
    </div>
  )

  const heroValueColumn = (
    <div className="flex shrink-0 flex-col gap-2 border-t border-white/15 pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 lg:justify-end">
        {heroValueNumberRow}
        {heroCenarioHojeInline}
      </div>
      <span className="text-[11px] text-white/60 lg:text-right">Fonte própria</span>
    </div>
  )

  const variacaoPillRow =
    inlineVariacaoEleicao && variacaoSplit && variacaoSplit.rest ? (
      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
        {variacaoSplit.pill ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
              inlineVariacaoEleicaoTone === 'negative'
                ? heroDark
                  ? 'border-rose-400/45 bg-rose-950/35 text-rose-200'
                  : 'border-rose-300 bg-rose-50 text-rose-800'
                : heroDark
                  ? 'border-emerald-500/45 bg-emerald-950/35 text-emerald-300'
                  : 'border-emerald-400/60 bg-emerald-50 text-emerald-800'
            )}
          >
            {inlineVariacaoEleicaoTone === 'negative' ? (
              <TrendingDown className="h-3 w-3 shrink-0" aria-hidden />
            ) : (
              <TrendingUp className="h-3 w-3 shrink-0" aria-hidden />
            )}
            {variacaoSplit.pill}
          </span>
        ) : null}
        <span
          className={cn(
            'min-w-0 max-w-full text-[10px] font-medium leading-snug',
            heroDark ? 'text-gray-400' : 'text-slate-600'
          )}
        >
          {variacaoSplit.rest}
        </span>
      </div>
    ) : inlineVariacaoEleicao ? (
      <p
        className={cn(
          'text-center text-[11px] font-medium leading-snug sm:text-left',
          variacaoInlineClass
        )}
      >
        {inlineVariacaoEleicao}
      </p>
    ) : null

  const cockpitCenarioJlaHoje =
    cockpitInlineRow && cenarioVotos && onChangeCenarioVotos ? (
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
        <div
          className={cn(
            'inline-flex flex-shrink-0 overflow-hidden rounded-md border',
            heroDark ? 'border-gray-600/90 bg-[#0c101c]' : 'border-slate-300 bg-slate-100'
          )}
        >
          <button
            type="button"
            onClick={(event) => handleChangeCenario(event, 'aferido_jadyel')}
            className={cn(
              'px-2 py-1 text-[10px] font-semibold transition-colors',
              cenarioVotos === 'aferido_jadyel'
                ? heroDark
                  ? 'bg-slate-600 text-white'
                  : 'bg-white text-slate-900 shadow-sm'
                : heroDark
                  ? 'text-gray-400 hover:bg-white/5'
                  : 'text-slate-600 hover:bg-white'
            )}
            title="Visão Jadyel"
            aria-label="Visão Jadyel"
          >
            J
          </button>
          <button
            type="button"
            onClick={(event) => handleChangeCenario(event, 'promessa_lideranca')}
            className={cn(
              'px-2 py-1 text-[10px] font-semibold transition-colors',
              cenarioVotos === 'promessa_lideranca'
                ? heroDark
                  ? 'bg-slate-600 text-white'
                  : 'bg-white text-slate-900 shadow-sm'
                : heroDark
                  ? 'text-gray-400 hover:bg-white/5'
                  : 'text-slate-600 hover:bg-white'
            )}
            title="Visão Lideranças"
            aria-label="Visão Lideranças"
          >
            L
          </button>
          <button
            type="button"
            onClick={(event) => handleChangeCenario(event, 'legado_anterior')}
            className={cn(
              'px-2 py-1 text-[10px] font-semibold transition-colors',
              cenarioVotos === 'legado_anterior'
                ? heroDark
                  ? 'bg-slate-600 text-white'
                  : 'bg-white text-slate-900 shadow-sm'
                : heroDark
                  ? 'text-gray-400 hover:bg-white/5'
                  : 'text-slate-600 hover:bg-white'
            )}
            title="Visão Anterior"
            aria-label="Visão Anterior"
          >
            A
          </button>
        </div>
        <span
          className={cn(
            'rounded border px-2 py-0.5 text-[10px] font-medium',
            heroDark
              ? 'border-gray-600/90 bg-[#0c101c] text-gray-400'
              : 'border-slate-300 bg-slate-50 text-slate-600'
          )}
        >
          Hoje
        </span>
      </div>
    ) : null

  /** Cockpit: título + linha de votos (número + J/L/A/Hoje); coluna da direita só com detalhes. */
  const cockpitLeftColumn = expectativaChartLayout ? (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col',
        cockpitComRadar ? 'lg:min-w-0' : 'flex-1'
      )}
    >
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {heroIconBlock}
        <p
          className={cn(
            'min-w-0 flex-1 text-[13px] font-semibold uppercase leading-snug tracking-wide transition-colors group-hover:text-white/90',
            heroDark ? 'text-white' : 'text-slate-800'
          )}
        >
          {kpi.label}
        </p>
      </div>
      <div className="mt-2 flex min-h-0 w-full flex-1 flex-row items-stretch gap-3 sm:gap-4">
        <div className="flex w-[min(46%,13rem)] min-w-[9rem] shrink-0 flex-col justify-center gap-1.5">
          <div className="flex justify-center sm:justify-start">{heroValueNumberRow}</div>
          {infoLines && infoLines.length > 0 ? (
            <div className="text-center sm:text-left">{heroInfoLinesBlock()}</div>
          ) : null}
          {variacaoPillRow}
          {cockpitCenarioJlaHoje}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center">
          <div className="h-[104px] w-full min-w-0">
            <CockpitExpectativaGrowthArea
              values={cockpitExpectativaTrendValues}
              heroDark={heroDark}
              heightPx={104}
            />
          </div>
          <p
            className={cn(
              'mt-1 text-center text-[10px] font-medium leading-tight sm:text-[11px]',
              heroDark ? 'text-gray-500' : 'text-slate-500'
            )}
          >
            {cockpitExpectativaChartCaption}
          </p>
        </div>
      </div>
    </div>
  ) : (
    <div
      className={cn(
        'flex min-w-0 gap-2 sm:gap-3 lg:items-start',
        cockpitComRadar ? 'lg:min-w-0 lg:flex-1' : 'flex-1'
      )}
    >
      {heroIconBlock}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'leading-snug transition-colors group-hover:text-white/90',
            cockpitInlineRow
              ? cn(
                  'text-[13px] font-medium uppercase tracking-wide',
                  heroDark ? 'text-gray-400' : 'text-slate-600'
                )
              : 'text-base font-semibold text-white'
          )}
        >
          {kpi.label}
        </p>
        <div
          className={cn(
            'mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-2',
            cockpitInlineRow && 'justify-center sm:justify-start'
          )}
        >
          {heroValueNumberRow}
          {!cockpitInlineRow ? heroCenarioHojeInline : null}
        </div>
        {(cockpitComRadar || cockpitInlineRow) && infoLines && infoLines.length > 0 ? (
          <div className={cn('mt-1.5', cockpitInlineRow && 'text-center sm:text-left')}>
            {heroInfoLinesBlock()}
          </div>
        ) : null}
        {cockpitInlineRow && inlineVariacaoEleicao ? (
          <div className="mt-1.5">{variacaoPillRow}</div>
        ) : null}
        {cockpitInlineRow ? <div className="mt-1.5">{cockpitCenarioJlaHoje}</div> : null}
      </div>
    </div>
  )

  const cockpitRightColumn = (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 border-t pt-3 lg:border-l lg:border-t-0 lg:pt-0',
        cockpitBorderSubtle,
        cockpitComRadar ? 'lg:pl-3' : 'lg:pl-5',
        cockpitComRadar && 'lg:max-w-[min(100%,22rem)] lg:flex-none xl:max-w-[24rem]'
      )}
    >
      {subtitle && !infoLines && <p className="text-sm text-white/70">{subtitle}</p>}
      {heroInfoLinesBlock()}
    </div>
  )

  const content = (
    <div
      className={cn(
        'relative rounded-[14px]',
        cockpitInlineRow ? 'p-2 sm:p-2.5' : 'p-4 sm:p-5',
        'shadow-[0_2px_8px_rgba(0,0,0,0.1)]',
        !(variant === 'cockpit' && cockpitInlineRow) &&
          'hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] hover:-translate-y-[3px]',
        'transition-all duration-300 ease-out',
        'group overflow-hidden',
        variant === 'cockpit'
          ? cockpitInlineRow
            ? heroDark
              ? 'rounded-xl border border-gray-800/90 bg-[#111827] shadow-[0_4px_20px_rgba(0,0,0,0.45)] ring-1 ring-sky-500/35'
              : 'rounded-xl border border-slate-200/90 bg-white shadow-md shadow-slate-900/5 ring-1 ring-[#0e74bc]/25'
            : heroDark
              ? 'rounded-xl border border-gray-800/90 bg-[#111827] shadow-[0_4px_20px_rgba(0,0,0,0.45)]'
              : 'rounded-2xl border border-white/20 bg-gradient-to-br from-[#062e52] via-[#0b4a7a] to-[#1368a8] shadow-[0_12px_40px_rgba(6,46,82,0.35)]'
          : 'border border-accent-gold bg-accent-gold',
        variant === 'cockpit' && 'flex h-full min-h-0 flex-col',
        contentClassName
      )}
    >
      {/* Cockpit + Radar: modo grade (inline) = flex na mesma linha; senão radar absolute no lg */}
      {cockpitComRadar ? (
        cockpitInlineRow ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
            <div className="min-w-0 flex-1 lg:min-w-0 lg:pr-2">{cockpitLeftColumn}</div>
            <div
              role="presentation"
              className={cn(
                'flex min-h-0 w-full min-w-0 flex-col border-t pt-2',
                cockpitRadarPanel,
                'lg:mt-0 lg:w-[min(100%,15rem)] lg:max-w-[40%] lg:flex-shrink-0 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0'
              )}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
              }}
            >
              {cockpitRadarFixedHeader ? (
                <div
                  className={cn(
                    'relative z-[2] shrink-0 border-b pb-1',
                    heroDark ? 'border-gray-800/70' : 'border-white/10'
                  )}
                >
                  {cockpitRadarFixedHeader}
                </div>
              ) : null}
              <div
                ref={cockpitRadarScrollRef}
                onMouseEnter={onCockpitRadarScrollMouseEnter}
                onMouseLeave={onCockpitRadarScrollMouseLeave}
                className={cn(
                  'relative z-0 min-h-0 flex-1',
                  'monitor-scroll overflow-y-auto overflow-x-hidden scroll-smooth',
                  'max-h-[min(200px,42vh)] lg:max-h-[min(100%,14rem)]',
                  'flex flex-col gap-1.5'
                )}
              >
                {cockpitMomentoAtual}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative lg:min-h-0">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:gap-4 lg:pr-[calc(min(26rem,34%)+0.75rem)]">
              {cockpitLeftColumn}
            </div>
            <div
              role="presentation"
              className={cn(
                'mt-3 flex w-full min-w-0 flex-col border-t pt-2',
                cockpitRadarPanel,
                'lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:max-h-none lg:min-h-0 lg:w-[min(100%,min(26rem,34%))] lg:flex-col lg:overflow-hidden lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0 lg:pb-0'
              )}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
              }}
            >
              {cockpitRadarFixedHeader ? (
                <div
                  className={cn(
                    'relative z-[2] shrink-0 border-b pb-1',
                    heroDark ? 'border-gray-800/70' : 'border-white/10'
                  )}
                >
                  {cockpitRadarFixedHeader}
                </div>
              ) : null}
              <div
                ref={cockpitRadarScrollRef}
                onMouseEnter={onCockpitRadarScrollMouseEnter}
                onMouseLeave={onCockpitRadarScrollMouseLeave}
                className={cn(
                  'relative z-0 min-h-0 flex-1',
                  'monitor-scroll overflow-y-auto overflow-x-hidden scroll-smooth',
                  'max-h-[min(240px,50vh)] lg:max-h-none',
                  'flex flex-col gap-1.5'
                )}
              >
                {cockpitMomentoAtual}
              </div>
            </div>
          </div>
        )
      ) : variant === 'cockpit' && cockpitInlineRow ? (
        <div className="flex min-h-0 flex-1 flex-col">{cockpitLeftColumn}</div>
      ) : variant === 'cockpit' ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
          {cockpitLeftColumn}
          {cockpitRightColumn}
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
            {heroLabelColumn}
            {heroValueColumn}
          </div>
        </div>
      )}
    </div>
  )

  return shellClassName ? <div className={shellClassName}>{content}</div> : content
}
