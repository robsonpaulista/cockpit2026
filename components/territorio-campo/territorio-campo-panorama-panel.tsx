'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { CampoResumoWidget } from '@/components/campo/campo-resumo-widget'
import { PanoramaTerritorioTopRow } from '@/components/territorio-campo/panorama-territorio-top-row'
import { cn, monthBucketKey } from '@/lib/utils'

type AgendaRow = {
  id: string
  date: string
  type: string
  status: string
  cities?: { id: string; name: string }
}

export function TerritorioCampoPanoramaPanel() {
  const [agendas, setAgendas] = useState<AgendaRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/campo/agendas')
        if (res.ok) {
          setAgendas((await res.json()) as AgendaRow[])
        }
      } catch {
        setAgendas([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const concluidas = useMemo(
    () => agendas.filter((a) => a.status === 'concluida'),
    [agendas]
  )

  const cityBars = useMemo(() => {
    const map = concluidas.reduce<Record<string, { name: string; count: number }>>((acc, agenda) => {
      const name = agenda.cities?.name
      if (!name) return acc
      const key = agenda.cities?.id ?? name
      acc[key] = { name, count: (acc[key]?.count ?? 0) + 1 }
      return acc
    }, {})
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [concluidas])

  const recentAgendas = useMemo(
    () =>
      [...concluidas]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3)
        .map((agenda) => ({
          id: agenda.id,
          date: agenda.date,
          type: agenda.type,
          cityName: agenda.cities?.name ?? 'Cidade não informada',
        })),
    [concluidas]
  )

  const monthBuckets = useMemo(() => {
    const buckets = Array.from({ length: 6 }).map((_, idx) => {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - (5 - idx))
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString('pt-BR', { month: 'short' }),
        value: 0,
        monthIndex: d.getMonth(),
        year: d.getFullYear(),
      }
    })
    concluidas.forEach((agenda) => {
      const bucket = buckets.find((m) => m.key === monthBucketKey(agenda.date))
      if (bucket) bucket.value += 1
    })
    return buckets
  }, [concluidas])

  const planejadas = agendas.filter((a) => a.status === 'planejada').length
  const canceladas = agendas.filter((a) => a.status === 'cancelada').length
  const taxaConclusao =
    agendas.length > 0 ? Math.round((concluidas.length / agendas.length) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando panorama…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PanoramaTerritorioTopRow />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Visitas registradas', value: String(agendas.length) },
          { label: 'Concluídas', value: String(concluidas.length) },
          { label: 'Planejadas', value: String(planejadas) },
          { label: 'Taxa de conclusão', value: `${taxaConclusao}%` },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-3 py-2.5"
          >
            <p className="text-[10px] uppercase tracking-wide text-text-muted">{item.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-text-primary">{item.value}</p>
          </div>
        ))}
      </div>

      {canceladas > 0 ? (
        <p className="text-xs text-text-muted">{canceladas} visita(s) cancelada(s) no período.</p>
      ) : null}

      <CampoResumoWidget
        totalAgendas={agendas.length}
        cityBars={cityBars}
        recentAgendas={recentAgendas}
        monthBuckets={monthBuckets}
      />

      <p className={cn('text-[11px] leading-relaxed text-text-muted')}>
        Use a aba <strong className="font-medium text-text-secondary">Base</strong> para lideranças e
        detalhes por município. Em <strong className="font-medium text-text-secondary">Visitas</strong>,
        cadastre Campo &amp; Agenda. O mapa 2026 × 2022 está acima em <strong className="font-medium text-text-secondary">Mapa</strong>.
      </p>
    </div>
  )
}
