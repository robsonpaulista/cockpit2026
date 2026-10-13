'use client'

import type { ReactNode } from 'react'
import { TseBarraRotulo, TseCard, TseVazio } from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'
import type { ModalidadeLimite } from '@/lib/emenda-modalidade'
import type { ResumoTeto } from '@/lib/fns-tetos-saldo'
import { formatarMoedaFicha } from '@/lib/ficha-lideranca-resumo'

function LinhaTeto({ rotulo, valor, className }: { rotulo: string; valor: string; className?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1 text-[13px]">
      <dt className="text-[var(--tse-muted)]">{rotulo}</dt>
      <dd className={cn('text-right font-bold tabular-nums', className)} title={valor}>
        {valor}
      </dd>
    </div>
  )
}

const corSaldo = (saldo: number | null): string | undefined =>
  saldo == null ? undefined : saldo < 0 ? 'text-red-600' : saldo > 0 ? 'text-[var(--tse-olive)]' : undefined

/** Limite, propostas e saldo, com a barra de quanto do teto já foi usado. */
function ResumoModalidade({ titulo, resumo }: { titulo?: string; resumo: ResumoTeto | null }) {
  const limite = resumo?.limite ?? null
  const saldo = resumo?.saldo ?? null
  const usado = limite && limite > 0 ? ((resumo?.propostas ?? 0) / limite) * 100 : null
  return (
    <div>
      {titulo ? (
        <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--tse-gold-text)]">{titulo}</div>
      ) : null}
      <dl className="mt-1 divide-y divide-[#EEEEEE]">
        <LinhaTeto rotulo="Limite" valor={formatarMoedaFicha(limite)} />
        <LinhaTeto rotulo="Propostas" valor={formatarMoedaFicha(resumo?.propostas)} />
        <LinhaTeto rotulo="Saldo" valor={formatarMoedaFicha(saldo)} className={corSaldo(saldo)} />
      </dl>
      {usado != null ? (
        <TseBarraRotulo pct={Math.min(usado, 100)} rotulo={`${usado.toFixed(0)}% usado`} />
      ) : null}
    </div>
  )
}

function BlocoPrograma({
  sigla,
  nome,
  detalhe,
  children,
}: {
  sigla: string
  nome: string
  detalhe?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--tse-bar)] p-4">
      <div className="flex items-baseline gap-2">
        <div className="text-[17px] font-black">{sigla}</div>
        <div className="text-[12px] text-[var(--tse-muted)]">{nome}</div>
      </div>
      {detalhe ? <div className="mt-1 text-[12px] text-[var(--tse-muted)]">{detalhe}</div> : null}
      <div className="mt-3 space-y-4">{children}</div>
    </div>
  )
}

export type ResumosMacPapModalidade = {
  mac: Record<ModalidadeLimite, ResumoTeto | null>
  pap: Record<ModalidadeLimite, ResumoTeto | null>
}

/** PAP e MAC (individual e coletiva) e SUAS lado a lado. */
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
  return (
    <TseCard
      titulo="Tetos MAC, PAP e SUAS"
      subtitulo={`Individual e coletiva por programa${exercicioAtivo ? ` · exercício ${exercicioAtivo}` : ''}`}
    >
      <div className="mt-4">
        {!municipio ? (
          <TseVazio>Selecione um município para carregar os tetos.</TseVazio>
        ) : (
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <BlocoPrograma sigla="PAP" nome="Atenção Primária">
              <ResumoModalidade titulo="Individual" resumo={resumos.pap.individual} />
              <ResumoModalidade titulo="Coletiva" resumo={resumos.pap.coletiva} />
            </BlocoPrograma>
            <BlocoPrograma sigla="MAC" nome="Média e Alta Complexidade">
              <ResumoModalidade titulo="Individual" resumo={resumos.mac.individual} />
              <ResumoModalidade titulo="Coletiva" resumo={resumos.mac.coletiva} />
            </BlocoPrograma>
            <BlocoPrograma
              sigla="SUAS"
              nome="Assistência Social"
              detalhe={
                <>
                  Pop. <strong className="text-[var(--tse-text)]">{populacao?.toLocaleString('pt-BR') ?? '—'}</strong>
                  {' · '}
                  {classificacaoSuas.porte} ·{' '}
                  <strong className="tabular-nums text-[var(--tse-text)]">{classificacaoSuas.valorFormatado}</strong>
                </>
              }
            >
              {resumoSuas?.limite == null ? (
                <div className="text-[13px] text-[var(--tse-muted)]">População não encontrada (IBGE).</div>
              ) : (
                <ResumoModalidade resumo={resumoSuas} />
              )}
            </BlocoPrograma>
          </div>
        )}
      </div>
    </TseCard>
  )
}
