'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ModalidadeLimite } from '@/lib/emenda-modalidade'
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
      <span className="shrink-0 text-xs font-medium text-text-secondary">{label}</span>
      <span
        className={cn(
          'min-w-0 text-right text-sm font-semibold tabular-nums text-text-primary',
          valorClassName,
        )}
        title={valor}
      >
        {valor}
      </span>
    </div>
  )
}

function LinhasModalidade({
  prefixo,
  resumo,
}: {
  prefixo: 'individual' | 'coletiva'
  resumo: ResumoTeto | null
}) {
  const modLabel = prefixo === 'individual' ? 'individual' : 'coletiva'
  const saldo = resumo?.saldo ?? null
  const saldoNegativo = saldo != null && saldo < 0
  const saldoPositivo = saldo != null && saldo > 0

  return (
    <div className={prefixo === 'coletiva' ? 'mt-2 border-t border-card/60 pt-2' : ''}>
      <LinhaTeto
        label={`Limite ${modLabel}`}
        valor={formatBrl(resumo?.limite)}
      />
      <LinhaTeto
        label={`Propostas ${modLabel === 'individual' ? 'individuais' : 'coletivas'}`}
        valor={formatBrl(resumo?.propostas)}
      />
      <LinhaTeto
        label={`Saldo ${modLabel}`}
        valor={saldo != null ? formatBrl(saldo) : '—'}
        destaque
        valorClassName={cn(
          saldoNegativo && 'text-status-danger',
          saldoPositivo && 'text-accent-gold',
        )}
      />
    </div>
  )
}

function BlocoProgramaTeto({
  titulo,
  subtitulo,
  resumos,
}: {
  titulo: string
  subtitulo: string
  resumos: Record<ModalidadeLimite, ResumoTeto | null>
}) {
  return (
    <div className="min-w-0 rounded-lg border border-card/80 bg-background/30 px-3.5 py-3 h-full">
      <h3 className="text-sm font-semibold text-text-primary">{titulo}</h3>
      <p className="mb-2.5 text-xs text-text-secondary leading-snug">{subtitulo}</p>
      <LinhasModalidade prefixo="individual" resumo={resumos.individual} />
      <LinhasModalidade prefixo="coletiva" resumo={resumos.coletiva} />
    </div>
  )
}

function BlocoSuas({
  municipio,
  resumo,
  detalhes,
}: {
  municipio: string
  resumo: ResumoTeto | null
  detalhes?: ReactNode
}) {
  const saldo = resumo?.saldo ?? null
  const saldoNegativo = saldo != null && saldo < 0
  const saldoPositivo = saldo != null && saldo > 0

  return (
    <div className="min-w-0 rounded-lg border border-card/80 bg-background/30 px-3.5 py-3 h-full">
      <h3 className="text-sm font-semibold text-text-primary">SUAS</h3>
      <p className="mb-2.5 text-xs text-text-secondary leading-snug">Assistência Social</p>
      {detalhes ? <div className="mb-2.5 text-xs leading-snug text-text-secondary">{detalhes}</div> : null}
      {resumo?.limite == null ? (
        <p className="text-sm text-text-secondary">População não encontrada (IBGE).</p>
      ) : (
        <>
          <LinhaTeto label="Limite" valor={formatBrl(resumo.limite)} />
          <LinhaTeto label="Propostas" valor={formatBrl(resumo.propostas)} />
          <LinhaTeto
            label="Saldo"
            valor={saldo != null ? formatBrl(saldo) : '—'}
            destaque
            valorClassName={cn(
              saldoNegativo && 'text-status-danger',
              saldoPositivo && 'text-accent-gold',
            )}
          />
        </>
      )}
    </div>
  )
}

export type ResumosMacPapModalidade = {
  mac: Record<ModalidadeLimite, ResumoTeto | null>
  pap: Record<ModalidadeLimite, ResumoTeto | null>
}

/** Bloco compacto: PAP e MAC com individual + coletiva; SUAS ao lado. */
export function FichaAtendimentoTetosBloco({
  municipio,
  resumos,
  resumoSuas,
  populacao,
  classificacaoSuas,
  exercicioAtivo,
}: {
  municipio: string | null
  resumos: ResumosMacPapModalidade
  resumoSuas: ResumoTeto | null
  populacao: number | null
  classificacaoSuas: { porte: string; valorFormatado: string }
  exercicioAtivo?: number | null
}) {
  const detalhesSuas =
    municipio && classificacaoSuas ? (
      <div className="space-y-0.5 text-sm">
        <p>
          Pop.{' '}
          <span className="font-semibold text-text-primary">
            {populacao != null ? populacao.toLocaleString('pt-BR') : '—'}
          </span>
          {' · '}
          {classificacaoSuas.porte}
          {' · '}
          <span className="font-semibold tabular-nums text-accent-gold">
            {classificacaoSuas.valorFormatado}
          </span>
        </p>
      </div>
    ) : undefined

  return (
    <section className="min-w-0 rounded-2xl border border-card bg-surface px-4 py-3 shadow-sm">
      <div className="mb-2.5">
        <h2 className="text-sm font-semibold text-text-primary">Tetos MAC, PAP e SUAS</h2>
        <p className="mt-px text-xs text-text-secondary">
          Individual e coletiva por programa
          {municipio ? ` — ${municipio}` : ''}
          {exercicioAtivo ? ` · exercício ${exercicioAtivo}` : ''}
        </p>
      </div>

      {!municipio ? (
        <p className="py-4 text-center text-sm text-text-secondary">
          Selecione um município para carregar os tetos.
        </p>
      ) : (
        <div className="grid min-w-0 items-stretch gap-3 md:grid-cols-3">
          <BlocoProgramaTeto
            titulo="PAP"
            subtitulo="Atenção Primária"
            resumos={resumos.pap}
          />
          <BlocoProgramaTeto
            titulo="MAC"
            subtitulo="Média e Alta Complexidade"
            resumos={resumos.mac}
          />
          <BlocoSuas municipio={municipio} resumo={resumoSuas} detalhes={detalhesSuas} />
        </div>
      )}
    </section>
  )
}
