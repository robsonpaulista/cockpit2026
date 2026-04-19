'use client'

import { AlertCircle, Flame, Snowflake } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClassificacaoTerritorioTd } from '@/lib/piaui-territorio-classificacao'

const CONFIG: Record<
  ClassificacaoTerritorioTd,
  { label: string; Icon: typeof Flame; className: string; title: string }
> = {
  estrategico: {
    label: 'Estratégico',
    Icon: Flame,
    className:
      'border-accent-gold/35 bg-accent-gold-soft/25 text-text-primary ring-1 ring-accent-gold/15',
    title: 'Tercil superior neste critério — prioridade estratégica relativa aos demais TDs',
  },
  atencao: {
    label: 'Atenção',
    Icon: AlertCircle,
    className: 'border-status-warning/35 bg-status-warning/12 text-text-primary ring-1 ring-status-warning/10',
    title: 'Tercil intermediário — acompanhar e reforçar em relação aos demais TDs',
  },
  'baixo-impacto': {
    label: 'Baixo impacto',
    Icon: Snowflake,
    className: 'border-text-muted/35 bg-text-muted/8 text-text-secondary ring-1 ring-text-muted/10',
    title: 'Tercil inferior neste critério — impacto relativo menor frente aos demais TDs',
  },
}

/** Painel do mapa TD — hierarquia visual mais forte (“status de sistema”). */
const CONFIG_COMMAND: Record<
  ClassificacaoTerritorioTd,
  { label: string; Icon: typeof Flame; className: string; title: string; iconClass: string }
> = {
  estrategico: {
    label: 'Estratégico',
    Icon: Flame,
    className:
      'td-badge-td--cc td-badge-td--cc-estrategico border-amber-400/25 bg-gradient-to-br from-amber-500/18 via-amber-600/12 to-amber-900/20 text-amber-950 shadow-[0_0_0_1px_rgba(251,191,36,0.12),inset_0_1px_0_rgba(255,255,255,0.35)]',
    title: CONFIG.estrategico.title,
    iconClass: 'td-badge-td--cc-icon-pulse',
  },
  atencao: {
    label: 'Atenção',
    Icon: AlertCircle,
    className:
      'td-badge-td--cc td-badge-td--cc-atencao border-amber-600/30 bg-gradient-to-br from-amber-400/22 via-amber-500/14 to-amber-800/18 text-amber-950 shadow-[0_0_0_1px_rgba(217,119,6,0.15)] transition-transform duration-150 hover:scale-[1.02]',
    title: CONFIG.atencao.title,
    iconClass: '',
  },
  'baixo-impacto': {
    label: 'Baixo impacto',
    Icon: Snowflake,
    className:
      'td-badge-td--cc td-badge-td--cc-baixo border-slate-400/20 bg-slate-200/35 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] saturate-[0.72] opacity-[0.92]',
    title: CONFIG['baixo-impacto'].title,
    iconClass: '',
  },
}

export function ClassificacaoTdBadge({
  tipo,
  compact = false,
  visualTone = 'default',
}: {
  tipo: ClassificacaoTerritorioTd | undefined
  /** Só ícone (ex.: célula estreita). */
  compact?: boolean
  /** `command` = painel mapa TD (gradiente, glow, hierarquia mais forte). */
  visualTone?: 'default' | 'command'
}) {
  if (!tipo) return null
  const cfg = visualTone === 'command' ? CONFIG_COMMAND[tipo] : CONFIG[tipo]
  const { Icon } = cfg
  const iconClass = visualTone === 'command' ? CONFIG_COMMAND[tipo].iconClass : ''
  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center rounded-full border text-[8px] font-semibold leading-none tracking-tight sm:text-[9px]',
        compact ? 'gap-0 px-1 py-px' : 'gap-0.5 px-1.5 py-0.5',
        cfg.className
      )}
      title={`${cfg.title} (${cfg.label})`}
    >
      <Icon
        className={cn(
          'h-2.5 w-2.5 shrink-0 opacity-90 sm:h-3 sm:w-3',
          visualTone === 'default' && 'opacity-90',
          visualTone === 'command' && 'opacity-95',
          iconClass
        )}
        strokeWidth={2}
        aria-hidden
      />
      {!compact ? <span className="truncate">{cfg.label}</span> : null}
    </span>
  )
}
