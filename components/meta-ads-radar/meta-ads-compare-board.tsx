'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { buildMetaAdsCompareRows, buildMetaAdsPeriodTotals } from '@/lib/meta-ads-aggregate'
import type { MetaAdsComparePageRow } from '@/lib/meta-ads-aggregate'
import { formatSpendBrl } from '@/lib/meta-ads-format'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import { labelActorType } from '@/lib/youtube-radar-labels'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface MetaAdsCompareBoardProps {
  actors: PoliticalActorWithTerms[]
  ads: MetaAdsMentionWithActor[]
  lookbackDays: number
  loading?: boolean
}

function TopPagesInline({ pages }: { pages: MetaAdsComparePageRow[] }) {
  if (pages.length === 0) {
    return <span className="text-xs text-text-muted">—</span>
  }

  const label = pages.map((p) => `${p.page_name} (${p.count})`).join(' · ')

  return (
    <p className="truncate text-xs text-text-secondary" title={label}>
      {pages.map((p, i) => (
        <Fragment key={p.page_name}>
          {i > 0 ? <span className="text-text-muted"> · </span> : null}
          {p.page_name}
          <span className="text-text-muted"> ({p.count})</span>
        </Fragment>
      ))}
    </p>
  )
}

function AdList({ ads }: { ads: MetaAdsMentionWithActor[] }) {
  if (ads.length === 0) {
    return (
      <p className="px-4 py-2.5 pl-10 text-xs text-text-muted">
        Nenhum anúncio nesta janela. Rode a busca na Biblioteca de Anúncios da Meta.
      </p>
    )
  }

  return (
    <ul className="border-t border-[rgb(var(--color-border-tertiary)/0.45)] bg-bg-app">
      {ads.map((ad) => (
        <li
          key={ad.id}
          className="flex items-start gap-3 border-b border-[rgb(var(--color-border-tertiary)/0.3)] px-4 py-2 pl-10 last:border-b-0"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary" title={ad.page_name ?? undefined}>
              {ad.page_name ?? 'Página desconhecida'}
              {ad.is_active === true ? (
                <span className="ml-2 rounded bg-[#E6F1FB] px-1.5 py-0.5 text-[10px] font-medium text-[rgb(var(--color-primary))]">
                  Ativo
                </span>
              ) : ad.is_active === false ? (
                <span className="ml-2 rounded bg-bg-app px-1.5 py-0.5 text-[10px] text-text-muted">Inativo</span>
              ) : null}
            </p>
            {ad.ad_body ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary" title={ad.ad_body}>
                {ad.ad_body}
              </p>
            ) : null}
            <p className="mt-0.5 truncate text-[11px] text-text-muted">
              {formatDate(ad.started_running_at)}
              {ad.ended_running_at ? ` → ${formatDate(ad.ended_running_at)}` : ''}
              {' · '}
              Gasto: {formatSpendBrl(ad.spend_min_brl, ad.spend_max_brl, ad.spend_text)}
              {ad.impressions_text ? ` · Imp.: ${ad.impressions_text}` : ''}
            </p>
            {ad.payer_name ? (
              <p className="mt-0.5 truncate text-[10px] text-text-muted">Pago por {ad.payer_name}</p>
            ) : null}
          </div>
          <a
            href={ad.library_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 pt-0.5 text-[rgb(var(--color-primary))]"
            aria-label={`Abrir anúncio ${ad.library_ad_id}`}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  )
}

export function MetaAdsCompareBoard({
  actors,
  ads,
  lookbackDays,
  loading = false,
}: MetaAdsCompareBoardProps) {
  const rows = buildMetaAdsCompareRows(actors, ads)
  const periodTotals = buildMetaAdsPeriodTotals(ads)
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-10 text-center text-sm text-text-muted">
        Carregando quadro comparativo…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-6 py-12 text-center text-sm text-text-muted">
        Cadastre candidatos ativos e rode a busca na Biblioteca de Anúncios da Meta.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface">
      <div className="border-b border-[rgb(var(--color-border-tertiary)/0.85)] px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">Comparativo · últimos {lookbackDays} dias</h2>
        <p className="text-xs text-text-muted">
          Anúncios políticos · gasto, impressões e páginas patrocinadoras
        </p>
        {periodTotals.spendLabel !== '—' || periodTotals.impressionsLabel ? (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
            <span>
              <span className="font-medium text-text-primary">Investimento no período:</span>{' '}
              {periodTotals.spendLabel}
            </span>
            {periodTotals.impressionsLabel ? (
              <span>
                <span className="font-medium text-text-primary">Impressões:</span>{' '}
                {periodTotals.impressionsLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[rgb(var(--color-border-tertiary)/0.85)] text-[10px] font-medium uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 font-medium">Candidato</th>
              <th className="w-20 px-3 py-2 text-right font-medium">Anúncios</th>
              <th className="w-16 px-3 py-2 text-right font-medium">Ativos</th>
              <th className="w-32 px-3 py-2 text-right font-medium">Gasto est.</th>
              <th className="px-4 py-2 font-medium">Principais páginas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const expanded = expandedSlug === row.actor.slug

              return (
                <Fragment key={row.actor.id}>
                  <tr
                    className={cn(
                      'border-b border-[rgb(var(--color-border-tertiary)/0.5)] transition-colors',
                      expanded ? 'bg-[#E6F1FB]/40' : 'hover:bg-bg-app'
                    )}
                  >
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setExpandedSlug(expanded ? null : row.actor.slug)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left"
                        aria-expanded={expanded}
                      >
                        <span className="shrink-0 text-text-muted">
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" aria-hidden />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-text-primary">
                            {row.actor.name}
                          </span>
                          <span className="block text-[11px] text-text-muted">
                            {labelActorType(row.actor.actor_type)}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-medium tabular-nums text-text-primary">
                      {formatInt(row.adCount)}
                    </td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-text-secondary">
                      {formatInt(row.activeCount)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-text-secondary">
                      {row.spendLabel}
                    </td>
                    <td className="max-w-0 px-4 py-2">
                      <TopPagesInline pages={row.topPages} />
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-b border-[rgb(var(--color-border-tertiary)/0.5)]">
                      <td colSpan={5} className="p-0">
                        <AdList ads={row.ads} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
