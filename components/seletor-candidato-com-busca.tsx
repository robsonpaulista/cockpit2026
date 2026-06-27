'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { CandidatoMatrizColuna } from '@/lib/votacao-secao-matriz'
import { cn } from '@/lib/utils'

function filtrarCandidatos(
  opcoes: readonly CandidatoMatrizColuna[],
  busca: string,
): CandidatoMatrizColuna[] {
  const q = busca.trim().toLowerCase()
  if (!q) return [...opcoes]
  return opcoes.filter(
    (c) =>
      c.nmVotavel.toLowerCase().includes(q) ||
      String(c.nrVotavel).includes(q),
  )
}

function rotuloOpcao(c: CandidatoMatrizColuna): string {
  return `${c.nrVotavel} · ${c.nmVotavel} — ${c.totalVotos.toLocaleString('pt-BR')} votos`
}

type Props = {
  id: string
  label: string
  value: string
  onChange: (id: string) => void
  opcoes: readonly CandidatoMatrizColuna[]
  emptyOption?: { id: string; label: string }
  placeholderBusca?: string
  className?: string
}

export function SeletorCandidatoComBusca({
  id,
  label,
  value,
  onChange,
  opcoes,
  emptyOption,
  placeholderBusca = 'Buscar por nome ou número…',
  className,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const buscaRef = useRef<HTMLInputElement>(null)
  const [aberto, setAberto] = useState<boolean>(false)
  const [busca, setBusca] = useState<string>('')

  useEffect(() => {
    setBusca('')
  }, [opcoes])

  useEffect(() => {
    if (!aberto) return

    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setAberto(false)
        setBusca('')
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false)
        setBusca('')
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [aberto])

  useEffect(() => {
    if (aberto) {
      window.requestAnimationFrame(() => buscaRef.current?.focus())
    }
  }, [aberto])

  const opcoesFiltradas = useMemo(() => filtrarCandidatos(opcoes, busca), [opcoes, busca])

  const selecionado = useMemo(
    () => opcoes.find((c) => c.id === value) ?? null,
    [opcoes, value],
  )

  const rotuloTrigger =
    value === emptyOption?.id
      ? emptyOption.label
      : selecionado
        ? rotuloOpcao(selecionado)
        : emptyOption?.label ?? 'Selecione…'

  const selecionar = (id: string) => {
    onChange(id)
    setAberto(false)
    setBusca('')
  }

  return (
    <div ref={rootRef} className={cn('relative max-w-xl', className)}>
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-medium text-text-secondary">
        {label}
      </label>

      <button
        id={id}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-card bg-surface px-2.5 text-left text-xs text-text-primary hover:bg-background"
      >
        <span className="min-w-0 truncate">{rotuloTrigger}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-text-muted transition-transform', aberto && 'rotate-180')}
          aria-hidden
        />
      </button>

      {aberto ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-card bg-surface shadow-card">
          <div className="relative border-b border-card bg-background/80 p-2">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <input
              ref={buscaRef}
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={placeholderBusca}
              className="h-8 w-full rounded-md border border-card bg-surface py-1.5 pl-8 pr-2 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent-gold/50 focus:ring-2 focus:ring-accent-gold/15"
              autoComplete="off"
            />
          </div>

          <div role="listbox" aria-label={label} className="max-h-52 overflow-y-auto">
            {emptyOption ? (
              <button
                type="button"
                role="option"
                aria-selected={value === emptyOption.id}
                onClick={() => selecionar(emptyOption.id)}
                className={cn(
                  'flex w-full items-center px-2.5 py-2 text-left text-xs',
                  value === emptyOption.id
                    ? 'bg-accent-gold/15 font-medium text-text-primary'
                    : 'text-text-secondary hover:bg-background',
                )}
              >
                {emptyOption.label}
              </button>
            ) : null}

            {opcoesFiltradas.length === 0 ? (
              <p className="px-2.5 py-3 text-xs text-text-secondary">Nenhum candidato encontrado.</p>
            ) : (
              opcoesFiltradas.map((c) => {
                const ativo = value === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={ativo}
                    onClick={() => selecionar(c.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 border-t border-card/60 px-2.5 py-2 text-left text-xs',
                      ativo
                        ? 'bg-accent-gold/15 font-medium text-text-primary'
                        : 'text-text-primary hover:bg-background',
                    )}
                  >
                    <span className="min-w-0 truncate">
                      {c.nrVotavel} · {c.nmVotavel}
                    </span>
                    <span className="shrink-0 tabular-nums text-text-secondary">
                      {c.totalVotos.toLocaleString('pt-BR')}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {busca.trim() ? (
            <p className="border-t border-card px-2.5 py-1.5 text-[10px] text-text-secondary">
              {opcoesFiltradas.length} de {opcoes.length} candidato(s)
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
