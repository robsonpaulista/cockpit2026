import { cn } from '@/lib/utils'

/**
 * Escala tipográfica Cockpit / Apify
 * ───────────────────────────────────
 * Título de página / marca     → 20px (text-xl)
 * Corpo / navegação / tabelas  → 13px
 * Rótulos de seção (overline)  → 11px uppercase
 */

/** Título principal: header de página e “Cockpit 2026” na sidebar. */
export const typographyPageTitleClass =
  'text-xl font-semibold leading-tight tracking-tight text-text-primary'

/** Subtítulo / descrição logo abaixo do título de página. */
export const typographyPageLeadClass = 'text-[13px] leading-relaxed text-text-muted'

/** Título de seção dentro da página (painéis, cards). */
export const typographySectionTitleClass =
  'text-[13px] font-semibold leading-snug tracking-tight text-text-primary'

/** Texto de apoio sob título de seção. */
export const typographySectionLeadClass = 'text-[13px] leading-relaxed text-text-muted'

/** Corpo padrão — mesmo tamanho da sidebar. */
export const typographyBodyClass = 'text-[13px] leading-snug text-text-primary'

export const typographyBodyMediumClass = 'text-[13px] font-medium leading-snug text-text-primary'

export const typographyBodyMutedClass = 'text-[13px] leading-snug text-text-muted'

/** PAINEL, cabeçalhos de tabela, labels de KPI. */
export const typographySectionLabelClass =
  'text-[11px] font-medium uppercase tracking-[0.05em] text-text-muted'

/** Abas horizontais (Panorama / Base / Visitas). */
export const typographyTabClass = 'text-[13px] font-medium leading-none'

/** Valores numéricos em destaque (KPIs). */
export const typographyMetricValueClass =
  'text-[13px] font-semibold tabular-nums leading-snug text-text-primary'

/** Link de ação discreto. */
export const typographyLinkClass =
  'text-[13px] font-medium text-[rgb(var(--color-primary))] hover:underline'

/** Raiz de conteúdo — herda 13px para texto solto. */
export const typographyContentRootClass = 'text-[13px] text-text-primary'

export const typographyTableThClass = cn('text-left', typographySectionLabelClass)

export const typographyTableTdClass = cn('align-middle', typographyBodyClass)

export const typographyTableFootClass = typographyBodyMutedClass
