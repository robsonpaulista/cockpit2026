'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, Check, ImageIcon, MessageSquare, SlidersHorizontal } from 'lucide-react'
import {
  OBRA_FASE_COLOR,
  OBRA_MAPA_TEMAS_OBRA,
  type ObraMapaTema,
  type ObraMapaTemaFiltro,
  type ObraMapaVisao,
} from '@/lib/obras-mapa'
import { OBRA_MAPA_LEGENDA } from '@/lib/obras-mapa-markers'
import {
  OBRA_MAQUINARIO_3D_VARIANTS,
  OBRA_PAVIMENTACAO_3D_VARIANTS,
  OBRA_TEMA_MARKER_LABEL,
  type ObraMaquinario3dVariant,
  type ObraPavimentacao3dVariant,
} from '@/lib/obras-mapa-tema-icons'
import { ObraTemaMarkerPreview } from '@/components/territorio-campo/obra-tema-scene-icon'
import { chromeButtonClass } from '@/lib/button-chrome'
import { cn } from '@/lib/utils'

interface MapaObrasDisplayControlsProps {
  temaAtivo: ObraMapaTemaFiltro
  visaoMapa: ObraMapaVisao
  usarIcone3d: boolean
  pavimentacao3dVariant: ObraPavimentacao3dVariant
  maquinario3dVariant: ObraMaquinario3dVariant
  mostrarTodosPopups: boolean
  disabled: boolean
  onTogglePopups: () => void
  onToggleIcone3d: () => void
  onToggleComunicacao: () => void
  onChangePavimentacao: (value: ObraPavimentacao3dVariant) => void
  onChangeMaquinario: (value: ObraMaquinario3dVariant) => void
}

function Toggle({
  active,
  label,
  icon,
  onClick,
  disabled,
}: {
  active: boolean
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors',
        'text-text-primary hover:bg-bg-app disabled:cursor-not-allowed disabled:opacity-40'
      )}
    >
      <span className="text-text-muted">{icon}</span>
      <span className="flex-1">{label}</span>
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors',
          active
            ? 'border-accent-gold bg-accent-gold text-white'
            : 'border-card bg-bg-surface text-transparent'
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
      </span>
    </button>
  )
}

export function MapaObrasDisplayControls({
  temaAtivo,
  visaoMapa,
  usarIcone3d,
  pavimentacao3dVariant,
  maquinario3dVariant,
  mostrarTodosPopups,
  disabled,
  onTogglePopups,
  onToggleIcone3d,
  onToggleComunicacao,
  onChangePavimentacao,
  onChangeMaquinario,
}: MapaObrasDisplayControlsProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const comunicacaoAtiva = visaoMapa === 'comunicacao'
  const temasLegenda: ObraMapaTema[] =
    temaAtivo === 'todos' ? OBRA_MAPA_TEMAS_OBRA : [temaAtivo]
  const mostrarSelectPav =
    usarIcone3d && !comunicacaoAtiva && (temaAtivo === 'todos' || temaAtivo === 'asfalto')
  const mostrarSelectMaq =
    usarIcone3d && !comunicacaoAtiva && (temaAtivo === 'todos' || temaAtivo === 'maquinario-agricola')

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(chromeButtonClass, open && 'border-accent-gold text-text-primary')}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
        Exibição
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-card bg-bg-surface p-3 shadow-card"
        >
          <div className="p-1">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              Marcadores
            </p>
            <div className="flex flex-col gap-1.5">
              {temasLegenda.map((temaLeg) => (
                <span key={temaLeg} className="inline-flex items-center gap-2 text-[11px] text-text-muted">
                  <ObraTemaMarkerPreview
                    tema={temaLeg}
                    fase="em_andamento"
                    size={22}
                    usarIcone3d={usarIcone3d && !comunicacaoAtiva}
                    pavimentacao3dVariant={pavimentacao3dVariant}
                    maquinario3dVariant={maquinario3dVariant}
                  />
                  {OBRA_TEMA_MARKER_LABEL[temaLeg]}
                </span>
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {OBRA_MAPA_LEGENDA.map((item) => (
                <span key={item.fase} className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white/90"
                    style={{ backgroundColor: OBRA_FASE_COLOR[item.fase] }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="my-2 border-t border-card" />

          <div className="flex flex-col gap-0.5">
            <Toggle
              active={mostrarTodosPopups}
              label="Popups no mapa"
              icon={<MessageSquare className="h-3.5 w-3.5" aria-hidden />}
              onClick={onTogglePopups}
              disabled={disabled}
            />
            <Toggle
              active={usarIcone3d}
              label="Ícones 3D"
              icon={<Box className="h-3.5 w-3.5" aria-hidden />}
              onClick={onToggleIcone3d}
              disabled={comunicacaoAtiva || disabled}
            />
            <Toggle
              active={comunicacaoAtiva}
              label="Comunicação (fotos)"
              icon={<ImageIcon className="h-3.5 w-3.5" aria-hidden />}
              onClick={onToggleComunicacao}
            />
          </div>

          {mostrarSelectPav || mostrarSelectMaq ? (
            <>
              <div className="my-2 border-t border-card" />
              <div className="flex flex-col gap-2 p-1">
                {mostrarSelectPav ? (
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                      Ícone 3D · Asfalto
                    </span>
                    <select
                      value={pavimentacao3dVariant}
                      onChange={(e) => onChangePavimentacao(e.target.value as ObraPavimentacao3dVariant)}
                      className="h-8 w-full truncate rounded-lg border border-card bg-bg-app px-2 text-xs text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                      disabled={disabled}
                    >
                      {OBRA_PAVIMENTACAO_3D_VARIANTS.map((v) => (
                        <option key={v.id} value={v.id} title={v.descricao}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {mostrarSelectMaq ? (
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                      Ícone 3D · Maquinário
                    </span>
                    <select
                      value={maquinario3dVariant}
                      onChange={(e) => onChangeMaquinario(e.target.value as ObraMaquinario3dVariant)}
                      className="h-8 w-full truncate rounded-lg border border-card bg-bg-app px-2 text-xs text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                      disabled={disabled}
                    >
                      {OBRA_MAQUINARIO_3D_VARIANTS.map((v) => (
                        <option key={v.id} value={v.id} title={v.descricao}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
