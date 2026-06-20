import type { GoogleTrendsSearchContext } from '@/lib/google-trends-types'
import { cn } from '@/lib/utils'

interface TrendsSearchContextBlockProps {
  context: GoogleTrendsSearchContext
  name?: string
  accentColor?: string
  className?: string
  compact?: boolean
}

function RelatedList({
  title,
  items,
}: {
  title: string
  items: GoogleTrendsSearchContext['queriesTop']
}) {
  if (items.length === 0) return null

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-900/80">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={`${item.kind}-${item.bucket}-${item.rank}-${item.label}`} className="text-xs text-indigo-950">
            <span className="font-medium">{item.label}</span>
            {item.formattedValue ? (
              <span className="text-indigo-900/70"> · {item.formattedValue}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TrendsSearchContextBlock({
  context,
  name,
  accentColor,
  className,
  compact = false,
}: TrendsSearchContextBlockProps) {
  if (!context.hasData) {
    return (
      <section
        className={cn(
          'rounded-lg border border-indigo-200/70 bg-indigo-50/60',
          compact ? 'px-3 py-2' : 'px-3 py-2.5',
          className
        )}
      >
        {name ? (
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {accentColor ? (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: accentColor }}
                aria-hidden
              />
            ) : null}
            <span className="text-xs font-medium text-indigo-950">{name}</span>
          </div>
        ) : null}
        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-900">
          Contexto de busca
        </p>
        <p className="mt-1 text-xs leading-snug text-indigo-950/90">
          Sem consultas ou tópicos relacionados neste período — volume de busca baixo ou insuficiente para o
          Google Trends.
        </p>
      </section>
    )
  }

  return (
    <section
      className={cn(
        'rounded-lg border border-indigo-200/70 bg-indigo-50/60',
        compact ? 'px-3 py-2' : 'px-3 py-2.5',
        className
      )}
    >
      {name ? (
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {accentColor ? (
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: accentColor }}
              aria-hidden
            />
          ) : null}
          <span className="text-xs font-medium text-indigo-950">{name}</span>
        </div>
      ) : null}
      <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-900">
        Contexto de busca
      </p>
      <p className="mt-0.5 text-[11px] text-indigo-900/75">
        Consultas e tópicos que o Google associa a este nome no período — não indica causa de picos.
      </p>
      <div className={cn('space-y-2.5', compact ? 'mt-1.5' : 'mt-2')}>
        <RelatedList title="Consultas frequentes" items={context.queriesTop} />
        <RelatedList title="Consultas em alta" items={context.queriesRising} />
        <RelatedList title="Tópicos frequentes" items={context.topicsTop} />
        <RelatedList title="Tópicos em alta" items={context.topicsRising} />
      </div>
    </section>
  )
}

interface TrendsSearchContextListProps {
  contexts: Array<{
    slug: string
    name: string
    color: string
    context: GoogleTrendsSearchContext
  }>
  className?: string
}

export function TrendsSearchContextList({ contexts, className }: TrendsSearchContextListProps) {
  const withData = contexts.filter((c) => c.context.hasData)
  if (withData.length === 0) return null

  return (
    <div className={cn('space-y-3', className)}>
      {withData.map((entry) => (
        <TrendsSearchContextBlock
          key={entry.slug}
          context={entry.context}
          name={entry.name}
          accentColor={entry.color}
          compact
        />
      ))}
    </div>
  )
}
