'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconCheck, IconLoader2, IconPencil } from '@tabler/icons-react'
import {
  saveInstagramProfileVisitsManual,
  type InstagramProfileVisitManual,
} from '@/lib/instagram-profile-visits-manual'
import { cn } from '@/lib/utils'

type DayRow = {
  date: string
  label: string
  visits: string
}

type Props = {
  /** Datas YYYY-MM-DD (mais recente por último). */
  dates: string[]
  /** Valores já salvos. */
  initialByDate: Record<string, number>
  formatDateLabel: (dateKey: string) => string
  onSaved: (rows: InstagramProfileVisitManual[]) => void
  className?: string
}

/** Formulário compacto para lançar visitas diárias ao perfil (Meta Insights). */
export function WarRoomRedesVisitasManualForm({
  dates,
  initialByDate,
  formatDateLabel,
  onSaved,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState(false)
  const [rows, setRows] = useState<DayRow[]>([])

  const dateKey = useMemo(() => dates.join('|'), [dates])
  const initialKey = useMemo(
    () => dates.map((d) => `${d}:${initialByDate[d] ?? ''}`).join('|'),
    [dates, initialByDate],
  )

  useEffect(() => {
    setRows(
      [...dates].reverse().map((date) => ({
        date,
        label: formatDateLabel(date),
        visits:
          initialByDate[date] != null && Number.isFinite(initialByDate[date])
            ? String(initialByDate[date])
            : '',
      })),
    )
    setError(null)
    setOkMsg(false)
  }, [dateKey, initialKey, dates, formatDateLabel, initialByDate])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setOkMsg(false)
    const entries = rows
      .map((row) => {
        const trimmed = row.visits.trim()
        if (trimmed === '') return null
        const visits = Number.parseInt(trimmed.replace(/\D/g, ''), 10)
        if (!Number.isFinite(visits) || visits < 0) return null
        return { date: row.date, visits }
      })
      .filter((e): e is { date: string; visits: number } => e != null)

    if (entries.length === 0) {
      setError('Preencha ao menos um dia.')
      setSaving(false)
      return
    }

    const result = await saveInstagramProfileVisitsManual(entries)
    setSaving(false)
    if (!result.ok) {
      setError(result.error || 'Falha ao salvar')
      return
    }
    setOkMsg(true)
    onSaved(entries.map((e) => ({ date: e.date, visits: e.visits })))
  }

  return (
    <div className={cn('wr-redes-visitas-manual', className)}>
      <button
        type="button"
        className="wr-redes-visitas-manual__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <IconPencil className="h-3 w-3 shrink-0" stroke={1.75} aria-hidden />
        {open ? 'Fechar lançamento' : 'Informar visitas (manual)'}
      </button>

      {open ? (
        <div className="wr-redes-visitas-manual__panel">
          <p className="wr-redes-visitas-manual__hint">
            Copie do Meta Insights · Visitas ao perfil · um valor por dia.
          </p>
          <ul className="wr-redes-visitas-manual__list" aria-label="Visitas por dia">
            {rows.map((row) => (
              <li key={row.date} className="wr-redes-visitas-manual__row">
                <label htmlFor={`wr-visit-${row.date}`} className="wr-redes-visitas-manual__date">
                  {row.label}
                </label>
                <input
                  id={`wr-visit-${row.date}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder="—"
                  className="wr-redes-visitas-manual__input tabular-nums"
                  value={row.visits}
                  onChange={(e) => {
                    const value = e.target.value
                    setRows((prev) =>
                      prev.map((r) =>
                        r.date === row.date ? { ...r, visits: value } : r,
                      ),
                    )
                    setOkMsg(false)
                  }}
                />
              </li>
            ))}
          </ul>
          {error ? (
            <p className="wr-redes-visitas-manual__erro" role="alert">
              {error}
            </p>
          ) : null}
          <div className="wr-redes-visitas-manual__actions">
            <button
              type="button"
              className="wr-redes-visitas-manual__save"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.75} />
              ) : okMsg ? (
                <IconCheck className="h-3.5 w-3.5" stroke={1.75} />
              ) : null}
              {saving ? 'Salvando…' : okMsg ? 'Salvo' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
