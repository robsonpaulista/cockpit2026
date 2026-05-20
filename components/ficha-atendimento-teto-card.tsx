'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ResumoTeto } from '@/lib/fns-tetos-saldo'

function formatBrl(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function LinhaTeto({
  label,
  valor,
  valorClassName,
  destaque,
}: {
  label: string
  valor: string
  valorClassName?: string
  destaque?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-2 border-b border-card/70 py-1.5 last:border-b-0',
        destaque && 'bg-accent-gold-soft/25 -mx-0.5 rounded-md px-0.5',
      )}
    >
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      <span
        className={cn(
          'min-w-0 text-right text-xs font-semibold tabular-nums leading-snug text-text-primary sm:text-sm',
          valorClassName,
        )}
        title={valor}
      >
        {valor}
      </span>
    </div>
  )
}

/** Altura fixa do cabeçalho — alinha início das 4 linhas entre MAC, PAP e SUAS */
const HEADER_ALTURA = 'h-[3.75rem]'

function TabelaValoresTeto({
  resumo,
}: {
  resumo: ResumoTeto
}) {
  const saldoNegativo = resumo.saldo != null && resumo.saldo < 0
  const saldoPositivo = resumo.saldo != null && resumo.saldo > 0

  return (
    <>
      <LinhaTeto label="Limite" valor={formatBrl(resumo.limite)} />
      <LinhaTeto label="Propostas" valor={formatBrl(resumo.propostas)} />
      <LinhaTeto label="Valor a pagar" valor={formatBrl(resumo.valorPagar)} />
      <LinhaTeto
        label="Saldo"
        valor={resumo.saldo != null ? formatBrl(resumo.saldo) : '—'}
        destaque
        valorClassName={cn(
          saldoNegativo && 'text-status-danger',
          saldoPositivo && 'text-accent-gold',
        )}
      />
    </>
  )
}

export function FichaAtendimentoTetoColuna({
  titulo,
  subtitulo,
  municipio,
  resumo,
  detalhes,
  semLimiteMsg,
}: {
  titulo: string
  subtitulo?: string
  municipio: string | null
  resumo: ResumoTeto | null
  /** Texto de contexto acima da tabela (ex.: população SUAS) — não entra nas 4 linhas */
  detalhes?: React.ReactNode
  semLimiteMsg?: string
}) {
  return (
    <div className="min-w-0 flex h-full flex-col">
      <div
        className={cn(
          'relative mb-1.5 shrink-0 border-b border-card pb-1.5',
          HEADER_ALTURA,
          detalhes ? 'pr-0' : '',
        )}
      >
        <div
          className={cn(
            'flex h-full flex-col justify-end',
            detalhes ? 'max-w-[46%] pr-1' : 'w-full',
          )}
        >
          <h3 className="text-xs font-semibold text-text-primary leading-tight">{titulo}</h3>
          {subtitulo ? (
            <p className="mt-px text-[10px] text-text-secondary leading-tight">{subtitulo}</p>
          ) : null}
        </div>
        {detalhes ? (
          <div
            className={cn(
              'absolute right-0 top-0 flex h-full w-[54%] flex-col justify-center',
              'border-l border-card/60 pl-1.5 text-right text-[9px] leading-tight text-text-secondary',
            )}
          >
            {detalhes}
          </div>
        ) : null}
      </div>

      {!municipio ? (
        <p className="text-xs text-text-secondary py-2">Selecione um município.</p>
      ) : resumo?.limite == null ? (
        <p className="text-xs text-text-secondary py-2">
          {semLimiteMsg ?? 'Limite não encontrado para este município.'}
        </p>
      ) : (
        <div className="min-w-0">
          <TabelaValoresTeto resumo={resumo} />
        </div>
      )}
    </div>
  )
}

/** Bloco único com as três colunas MAC / PAP / SUAS */
export function FichaAtendimentoTetosBloco({
  municipio,
  resumoMac,
  resumoPap,
  resumoSuas,
  populacao,
  classificacaoSuas,
}: {
  municipio: string | null
  resumoMac: ResumoTeto | null
  resumoPap: ResumoTeto | null
  resumoSuas: ResumoTeto | null
  populacao: number | null
  classificacaoSuas: { porte: string; valorFormatado: string }
}) {
  const detalhesSuas =
    municipio && classificacaoSuas ? (
      <div className="space-y-0.5 leading-none">
        <p>
          <span className="font-medium uppercase tracking-wide">População </span>
          <span className="font-semibold text-text-primary">
            {populacao != null ? populacao.toLocaleString('pt-BR') : '—'}
          </span>
        </p>
        <p>
          <span className="font-medium uppercase tracking-wide">Porte </span>
          <span className="font-semibold text-text-primary">{classificacaoSuas.porte}</span>
        </p>
        <p>
          <span className="font-medium uppercase tracking-wide">Teto SUAS </span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              classificacaoSuas.valorFormatado !== '-' ? 'text-accent-gold' : 'text-text-primary',
            )}
          >
            {classificacaoSuas.valorFormatado}
          </span>
        </p>
      </div>
    ) : undefined

  return (
    <section className="min-w-0 rounded-2xl border border-card bg-surface px-4 py-3 shadow-sm">
      <div className="mb-2.5">
        <h2 className="text-sm font-semibold text-text-primary">Tetos MAC, PAP e SUAS</h2>
        <p className="mt-px text-[11px] text-text-secondary">
          Limites fixos e saldos com base nas propostas FNS
          {municipio ? ` — ${municipio}` : ''}
        </p>
      </div>

      {!municipio ? (
        <p className="text-sm text-text-secondary py-4 text-center">
          Selecione um município para carregar os tetos.
        </p>
      ) : (
        <div className="grid min-w-0 items-stretch gap-4 md:grid-cols-3 md:gap-5">
          <FichaAtendimentoTetoColuna
            titulo="MAC"
            subtitulo="Média e Alta Complexidade"
            municipio={municipio}
            resumo={resumoMac}
            semLimiteMsg="Limite MAC não encontrado (planilha 2025)."
          />
          <FichaAtendimentoTetoColuna
            titulo="PAP"
            subtitulo="Atenção Primária"
            municipio={municipio}
            resumo={resumoPap}
            semLimiteMsg="Limite PAP não encontrado (planilha 2025)."
          />
          <FichaAtendimentoTetoColuna
            titulo="SUAS"
            subtitulo="Assistência Social"
            municipio={municipio}
            resumo={resumoSuas}
            detalhes={detalhesSuas}
            semLimiteMsg="População do município não encontrada (IBGE local)."
          />
        </div>
      )}
    </section>
  )
}
