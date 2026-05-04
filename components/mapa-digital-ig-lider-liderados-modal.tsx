'use client'

import { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LiderDesempenhoIgLinha, LideradoIgEngajamentoLinha } from '@/lib/mobilizacao-lideres-desempenho-ig-por-td-client'

function formatHandle(h: string): string {
  const t = h.trim()
  if (!t) return ''
  return t.startsWith('@') ? t : `@${t}`
}

const fmtDataHora = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatarUltimaPub(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return fmtDataHora.format(d)
}

type Props = {
  lider: LiderDesempenhoIgLinha | null
  onClose: () => void
  visualTheme?: 'light' | 'dark'
}

export function MapaDigitalIgLiderLideradosModal({ lider, onClose, visualTheme = 'dark' }: Props) {
  const open = Boolean(lider)
  const isLight = visualTheme === 'light'

  const linhas = useMemo((): LideradoIgEngajamentoLinha[] => {
    if (!lider) return []
    const handles = lider.lideradosInstagram ?? []
    const porHandle = new Map((lider.lideradosEngajamento ?? []).map((r) => [r.handle, r]))
    return handles
      .map((handle) => {
        const row = porHandle.get(handle)
        return (
          row ?? {
            handle,
            nome: null,
            comentarios: 0,
            publicacoesComComentario: 0,
            ultimaPublicacaoComentadaEm: null,
          }
        )
      })
      .sort((a, b) => b.comentarios - a.comentarios || a.handle.localeCompare(b.handle, 'pt-BR', { sensitivity: 'base' }))
  }, [lider])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!lider) return null

  const thClass = cn(
    'px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide',
    isLight ? 'text-text-secondary' : 'text-white/65',
  )
  const tdClass = cn('px-2 py-1.5 align-top text-[11px]', isLight ? 'text-text-primary' : 'text-white/95')
  const monoClass = cn('font-mono text-[11px]', isLight ? 'text-text-primary' : 'text-white')

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ig-lider-liderados-titulo"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-[1] flex max-h-[min(88dvh,36rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl',
          isLight ? 'border-border-card bg-bg-surface text-text-primary' : 'border-white/10 bg-[#111a28] text-white',
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-5',
            isLight ? 'border-border-card' : 'border-white/10',
          )}
        >
          <div className="min-w-0">
            <h2 id="ig-lider-liderados-titulo" className="text-base font-semibold tracking-tight">
              Liderados — engajamento no Instagram
            </h2>
            <p className={cn('mt-1 text-sm', isLight ? 'text-text-secondary' : 'text-white/75')}>
              <span className="font-semibold text-inherit">{lider.nome}</span>
              <span className="text-inherit">
                {' '}
                · {linhas.length} {linhas.length === 1 ? 'perfil' : 'perfis'}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'inline-flex shrink-0 rounded-lg p-2 transition-colors',
              isLight ? 'text-text-secondary hover:bg-accent-gold-soft/40' : 'text-white/80 hover:bg-white/10',
            )}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4">
          {linhas.length === 0 ? (
            <p className={cn('text-sm', isLight ? 'text-text-secondary' : 'text-white/70')}>
              Nenhum @ de liderado ativo vinculado a este líder no recorte atual.
            </p>
          ) : (
            <table className="w-full min-w-[32rem] border-collapse text-left">
              <thead>
                <tr className={cn('border-b', isLight ? 'border-border-card' : 'border-white/10')}>
                  <th className={thClass}>Nome</th>
                  <th className={thClass}>Perfil</th>
                  <th className={cn(thClass, 'text-right tabular-nums')}>Coment.</th>
                  <th className={cn(thClass, 'text-right tabular-nums')} title="Publicações distintas em que comentou">
                    Posts c/ com.
                  </th>
                  <th className={thClass} title="Data da publicação (post) do comentário mais recente deste perfil">
                    Última pub. comentada
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((row) => (
                  <tr
                    key={row.handle}
                    className={cn('border-b border-dashed last:border-0', isLight ? 'border-border-card/70' : 'border-white/[0.08]')}
                  >
                    <td className={tdClass}>
                      {(row.nome ?? '').trim() || '—'}
                    </td>
                    <td className={cn(tdClass, monoClass)}>{formatHandle(row.handle)}</td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>{row.comentarios}</td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>{row.publicacoesComComentario}</td>
                    <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
                      {formatarUltimaPub(row.ultimaPublicacaoComentadaEm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p
          className={cn(
            'shrink-0 border-t px-4 py-2 text-[11px] sm:px-5',
            isLight ? 'border-border-card text-text-muted' : 'border-white/10 text-white/55',
          )}
        >
          Esc ou clique fora para fechar. “Última pub.” usa a data do post vinculada ao comentário mais recente sincronizado.
        </p>
      </div>
    </div>
  )
}
