'use client'

import { useState, type ComponentType, type ReactNode, type SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TSE_TOKENS } from '@/components/tse/tse-tokens'

/* Classes reutilizáveis (padrão da página de resultado 2026) */

export const tseControleClass =
  'h-8 rounded-md border border-[var(--tse-border)] bg-white px-2 text-[13px] outline-none focus:border-[var(--tse-yellow)]'
export const tseBotaoCinzaClass =
  'flex h-8 items-center gap-1.5 rounded-md bg-[#E8E8E8] px-3 text-[13px] font-semibold text-[var(--tse-text)] hover:bg-[#DDDDDD] disabled:opacity-60'
export const tseBotaoIconeClass = 'h-4 w-4 text-[var(--tse-yellow)]'
export const tseBotaoPrimarioClass =
  'flex h-8 items-center justify-center gap-1.5 rounded-md bg-[var(--tse-olive)] px-3 text-[13px] font-bold text-white hover:bg-[#58701B] disabled:opacity-60'
export const tseCampoClass =
  'h-9 w-full rounded-md border border-[var(--tse-border)] bg-white px-2.5 text-[13px] text-[var(--tse-text)] outline-none focus:border-[var(--tse-yellow)]'
export const tseRotuloCampoClass = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]'
export const tseBotaoContornoClass =
  'rounded-md border border-[var(--tse-olive)] bg-white px-5 py-2 text-[13px] font-bold uppercase tracking-wide text-[var(--tse-olive)] hover:bg-[var(--tse-olive)] hover:text-white'
export const tseBotaoNeutroClass =
  'inline-flex items-center gap-1.5 rounded-md border border-[#CFCFCF] bg-white px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide hover:border-[var(--tse-olive)]'
export const tseLinkAcaoClass =
  'text-[12px] font-bold uppercase tracking-wide text-[var(--tse-olive)] hover:underline'
export const tseCardClass = 'rounded-2xl bg-white p-4 shadow-sm'

export const tseTabela = {
  container: 'overflow-x-auto rounded-xl bg-white shadow-sm',
  table: 'w-full text-[13px]',
  thead: 'bg-[var(--tse-bar)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]',
  th: 'px-3 py-2.5',
  tr: 'border-t border-[#EEEEEE]',
  trClicavel: 'group cursor-pointer border-t border-[#EEEEEE] hover:bg-[var(--tse-yellow-soft)]',
  td: 'px-3 py-2',
} as const

/* Estrutura da página */

export function TsePage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div style={TSE_TOKENS} className="min-h-screen bg-[var(--tse-bg)] pb-12 text-[var(--tse-text)]">
      <div className={cn('mx-auto w-full max-w-[1800px] px-4 pt-5 sm:px-6 2xl:px-8', className)}>
        {children}
      </div>
    </div>
  )
}

export function TseFilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-8 rounded-2xl bg-white px-6 py-3 shadow-sm">
      {children}
    </div>
  )
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'>

/** Select principal (município, candidato): texto grande com ícone amarelo. */
export function TseSelectGrande({
  icone: Icone,
  rotulo,
  children,
  ...props
}: SelectProps & { icone: ComponentType<{ className?: string }>; rotulo: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <Icone className="h-6 w-6 fill-[var(--tse-yellow)] text-[var(--tse-yellow)]" />
      <span className="sr-only">{rotulo}</span>
      <span className="relative">
        <select
          {...props}
          className="cursor-pointer appearance-none bg-transparent pr-8 text-[17px] font-semibold text-[var(--tse-text)] outline-none"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--tse-yellow)]" />
      </span>
    </label>
  )
}

/** Select secundário em pílula amarela com rótulo acima (zona, cargo, cenário). */
export function TsePillSelect({
  rotulo,
  children,
  ...props
}: SelectProps & { rotulo: string; children: ReactNode }) {
  return (
    <label className="flex flex-col text-[13px] font-semibold">
      {rotulo}
      <span className="relative">
        <select
          {...props}
          className="cursor-pointer appearance-none rounded-md bg-[var(--tse-yellow-strong)] py-0.5 pl-2 pr-7 text-sm font-bold text-[var(--tse-text)] outline-none"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2" />
      </span>
    </label>
  )
}

/** Valor fixo em pílula amarela com rótulo acima (ex.: turno). */
export function TsePillValor({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col text-[13px] font-semibold">
      {rotulo}
      <span className="mt-0.5 w-fit rounded-md bg-[var(--tse-yellow-strong)] px-2.5 py-0.5 text-sm font-bold">
        {children}
      </span>
    </div>
  )
}

export type TseAba<T extends string> = { id: T; label: string }

export function TseTabs<T extends string>({
  abas,
  ativa,
  onChange,
  className,
}: {
  abas: readonly TseAba<T>[]
  ativa: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-6 border-b border-[var(--tse-border)] text-[12px] font-bold uppercase tracking-wide',
        className,
      )}
    >
      {abas.map((a) => {
        const ativo = a.id === ativa
        return (
          <button
            key={a.id}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(a.id)}
            className={cn(
              '-mb-px border-b-2 pb-2 transition',
              ativo
                ? 'border-[var(--tse-yellow)] text-[var(--tse-gold-text)]'
                : 'border-transparent text-[var(--tse-muted)] hover:text-[var(--tse-text)]',
            )}
          >
            {a.label}
          </button>
        )
      })}
    </div>
  )
}

/* Cards e dados */

export function TseCard({
  titulo,
  subtitulo,
  acao,
  children,
  className,
}: {
  titulo?: ReactNode
  subtitulo?: ReactNode
  acao?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <section className={cn(tseCardClass, className)}>
      {titulo || acao ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {titulo ? <h2 className="text-[15px] font-bold">{titulo}</h2> : null}
            {subtitulo ? <p className="mt-0.5 text-[12px] text-[var(--tse-muted)]">{subtitulo}</p> : null}
          </div>
          {acao}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function TseDados({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('mt-4 space-y-3 text-[14px]', className)}>{children}</dl>
}

export function TseDado({ rotulo, valor, sufixo }: { rotulo: ReactNode; valor: ReactNode; sufixo?: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{rotulo}</dt>
      <dd className="text-right font-bold tabular-nums">
        {valor}
        {sufixo ? <span className="font-normal text-[var(--tse-muted)]"> {sufixo}</span> : null}
      </dd>
    </div>
  )
}

/** Barra grossa com o percentual escrito dentro. */
export function TseBarraRotulo({ pct, rotulo }: { pct: number; rotulo: ReactNode }) {
  return (
    <div className="mt-2 h-4 overflow-hidden rounded bg-[var(--tse-zero)]">
      <div
        className="flex h-full items-center justify-center bg-[var(--tse-green)] text-[10px] font-bold text-[var(--tse-text)]"
        style={{ width: `${Math.min(100, Math.max(pct, 8))}%` }}
      >
        {rotulo}
      </div>
    </div>
  )
}

/** Barra de votos + número, usada nas células das tabelas. */
export function TseBarraValor({
  valor,
  max,
  formatado,
  larguraNumero = 'w-14',
  cor = 'verde',
}: {
  valor: number
  max: number
  formatado: ReactNode
  larguraNumero?: string
  cor?: 'verde' | 'amarelo'
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-[#EEEEEE]">
        <div
          className={cn('h-full', cor === 'verde' ? 'bg-[var(--tse-green)]' : 'bg-[var(--tse-yellow)]')}
          style={{ width: `${max > 0 ? (valor / max) * 100 : 0}%` }}
        />
      </div>
      <span
        className={cn('text-right font-bold tabular-nums', larguraNumero, valor === 0 && 'text-[var(--tse-muted)]')}
      >
        {formatado}
      </span>
    </div>
  )
}

export function TsePill({
  children,
  tom = 'verde',
  className,
}: {
  children: ReactNode
  tom?: 'verde' | 'amarelo' | 'neutro'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-bold tabular-nums',
        tom === 'verde' && 'bg-[var(--tse-green)] text-white',
        tom === 'amarelo' && 'bg-[var(--tse-yellow)] text-white',
        tom === 'neutro' && 'bg-[var(--tse-bar)] font-semibold text-[var(--tse-muted)]',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function TseRank({ posicao }: { posicao: number }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[12px] font-black tabular-nums',
        posicao <= 3 ? 'bg-[var(--tse-yellow)] text-white' : 'bg-[var(--tse-bar)] text-[var(--tse-gold-text)]',
      )}
    >
      {posicao}º
    </span>
  )
}

/** Selo de status com cor livre (verde, amarelo, azul ou cinza conforme o domínio). */
export function TseStatus({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--tse-bar)] px-2.5 py-0.5 text-[11px] font-bold"
      style={{ boxShadow: `inset 0 0 0 1px ${cor}` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
      {children}
    </span>
  )
}

export type TseItemLista<T extends string> = { id: T; label: ReactNode; valor: number; cor: string }

/** Lista lateral com quadrado colorido e contagem; clicar filtra (clicar de novo limpa). */
export function TseListaFiltro<T extends string>({
  titulo,
  itens,
  ativo,
  onChange,
  formatar = (n) => n.toLocaleString('pt-BR'),
}: {
  titulo: ReactNode
  itens: readonly TseItemLista<T>[]
  ativo: T | null
  onChange: (id: T | null) => void
  formatar?: (n: number) => string
}) {
  return (
    <section className={tseCardClass}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">{titulo}</h2>
        {ativo != null ? (
          <button type="button" onClick={() => onChange(null)} className={tseLinkAcaoClass}>
            Todos
          </button>
        ) : null}
      </div>
      <ul className="mt-3 space-y-1 text-[13px]">
        {itens.map((item) => {
          const sel = item.id === ativo
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChange(sel ? null : item.id)}
                aria-pressed={sel}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left hover:bg-[var(--tse-yellow-soft)]',
                  sel && 'bg-[var(--tse-yellow-soft)] font-bold',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-3 w-3 shrink-0" style={{ backgroundColor: item.cor }} aria-hidden />
                  <span className="truncate">{item.label}</span>
                </span>
                <strong className="tabular-nums">{formatar(item.valor)}</strong>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function TseThOrdenavel<T extends string>({
  col,
  sortCol,
  sortAsc,
  onSort,
  alinhar = 'left',
  className,
  children,
}: {
  col: T
  sortCol: T
  sortAsc: boolean
  onSort: (col: T) => void
  alinhar?: 'left' | 'right'
  className?: string
  children: ReactNode
}) {
  const ativo = col === sortCol
  return (
    <th
      className={cn(tseTabela.th, alinhar === 'right' && 'text-right', className)}
      aria-sort={ativo ? (sortAsc ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn(
          'inline-flex items-center gap-1 uppercase hover:text-[var(--tse-text)]',
          ativo && 'text-[var(--tse-text)]',
        )}
      >
        {children}
        {ativo ? (
          sortAsc ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />
        )}
      </button>
    </th>
  )
}

/** Chevron da última coluna das tabelas expansíveis. */
export function TseChevronCelula({ aberta }: { aberta: boolean }) {
  return (
    <td className="px-2 py-2 text-[var(--tse-muted)] group-hover:text-[var(--tse-olive)]">
      <ChevronRight className={cn('h-4 w-4 transition-transform', aberta && 'rotate-90')} />
    </td>
  )
}

/* Controles */

export function TseBusca({
  value,
  onChange,
  placeholder,
  className = 'w-56',
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-8 rounded-md border border-[var(--tse-border)] bg-white pl-3 pr-9 text-[13px] outline-none focus:border-[var(--tse-yellow)]',
          className,
        )}
      />
      <span className="pointer-events-none absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-md bg-[var(--tse-yellow-strong)]">
        <Search className="h-4 w-4 text-[var(--tse-text)]" />
      </span>
    </div>
  )
}

export function TseSegmentado<T extends string>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: readonly { id: T; label: ReactNode }[]
  valor: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-[var(--tse-border)] text-[13px] font-semibold">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === valor}
          onClick={() => onChange(o.id)}
          className={cn(
            'px-3 py-1.5',
            o.id === valor
              ? 'bg-[var(--tse-yellow-strong)] text-[var(--tse-text)]'
              : 'bg-white text-[var(--tse-muted)] hover:bg-[var(--tse-bar)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Botão cinza que abre um menu suspenso (ex.: opções de exportação). */
export function TseMenu({
  icone: Icone,
  rotulo,
  ocupado = false,
  rotuloOcupado,
  largura = 'w-72',
  children,
}: {
  icone: ComponentType<{ className?: string }>
  rotulo: ReactNode
  ocupado?: boolean
  rotuloOcupado?: ReactNode
  largura?: string
  children: (fechar: () => void) => ReactNode
}) {
  const [aberto, setAberto] = useState<boolean>(false)
  const fechar = () => setAberto(false)
  return (
    <div className="relative">
      <button
        type="button"
        disabled={ocupado}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className={tseBotaoCinzaClass}
      >
        {ocupado ? (
          <Loader2 className={cn(tseBotaoIconeClass, 'animate-spin')} />
        ) : (
          <Icone className={tseBotaoIconeClass} />
        )}
        {ocupado ? (rotuloOcupado ?? rotulo) : rotulo}
      </button>
      {aberto && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={fechar}
          />
          <div
            role="menu"
            className={cn(
              'absolute right-0 z-20 mt-1 divide-y divide-[#EEEEEE] overflow-hidden rounded-lg border border-[var(--tse-border)] bg-white text-left shadow-lg',
              largura,
            )}
          >
            {children(fechar)}
          </div>
        </>
      )}
    </div>
  )
}

export function TseMenuItem({
  titulo,
  descricao,
  onClick,
}: {
  titulo: ReactNode
  descricao?: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full px-3 py-2.5 text-left hover:bg-[var(--tse-yellow-soft)]"
    >
      <span className="block text-[13px] font-bold">{titulo}</span>
      {descricao ? <span className="block text-[11px] text-[var(--tse-muted)]">{descricao}</span> : null}
    </button>
  )
}

/* Estados */

export function TseCarregando({ texto, className }: { texto: string; className?: string }) {
  return (
    <div className={cn('flex min-h-[40vh] items-center justify-center gap-2 text-[var(--tse-muted)]', className)}>
      <Loader2 className="h-5 w-5 animate-spin text-[var(--tse-yellow)]" />
      {texto}
    </div>
  )
}

export function TseVazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-[var(--tse-border)] bg-white p-6 text-center text-[14px] text-[var(--tse-muted)]">
      {children}
    </div>
  )
}

export function TseErro({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700">{children}</div>
  )
}

export function TseCarregarMais({ restantes, onClick }: { restantes: number; onClick: () => void }) {
  if (restantes <= 0) return null
  return (
    <div className="mt-6 flex justify-center">
      <button type="button" onClick={onClick} className={tseBotaoContornoClass}>
        Carregar mais ({restantes.toLocaleString('pt-BR')} restantes)
      </button>
    </div>
  )
}

/* Modal */

/**
 * Moldura de modal: cabeçalho branco, corpo cinza rolável e rodapé de ações. Aplica os tokens TSE.
 * Vai para o body porque o `PageTransition` aplica `transform`, que prenderia o `fixed` à página.
 */
export function TseModal({
  id,
  titulo,
  subtitulo,
  onClose,
  rodape,
  largura = 'max-w-3xl',
  children,
}: {
  id: string
  titulo: ReactNode
  subtitulo?: ReactNode
  onClose: () => void
  rodape?: ReactNode
  largura?: string
  children: ReactNode
}) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div style={TSE_TOKENS} className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={cn(
          'flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white text-[var(--tse-text)] shadow-xl',
          largura,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EEEEEE] px-6 py-4">
          <div className="min-w-0">
            <h2 id={id} className="text-[17px] font-bold">
              {titulo}
            </h2>
            {subtitulo ? <p className="mt-0.5 text-[12px] text-[var(--tse-muted)]">{subtitulo}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-text)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[var(--tse-bg)] px-6 py-5">{children}</div>
        {rodape ? (
          <div className="flex items-center justify-between gap-3 border-t border-[#EEEEEE] px-6 py-3">{rodape}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
