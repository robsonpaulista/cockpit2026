'use client'

import { forwardRef, useMemo } from 'react'
import { X } from 'lucide-react'
import { TseCard, TsePill, TseVazio, tseTabela } from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'
import {
  extrairHistoricoEleitoralCandidato,
  nomeCandidatoResumoExibicao,
  type ResultadoEleicao,
} from '@/lib/resumo-eleicoes-dados'

interface HistoricoEleitoralCandidatoProps {
  candidato: ResultadoEleicao
  municipio: string
  dadosMunicipio: ResultadoEleicao[]
  onClose?: () => void
}

/** Histórico de candidaturas (2020, 2022, 2024, 2026…) do candidato selecionado no município. */
export const HistoricoEleitoralCandidato = forwardRef<
  HTMLElement,
  HistoricoEleitoralCandidatoProps
>(function HistoricoEleitoralCandidato({ candidato, municipio, dadosMunicipio, onClose }, ref) {
  const historico = useMemo(
    () => extrairHistoricoEleitoralCandidato(candidato, dadosMunicipio),
    [candidato, dadosMunicipio],
  )

  const nomeExibicao = nomeCandidatoResumoExibicao(
    candidato.nomeUrnaCandidato || candidato.nomeCandidato,
    candidato.numeroUrna,
  )

  return (
    <section ref={ref}>
      <TseCard
        titulo={`Histórico eleitoral — ${nomeExibicao}`}
        subtitulo={`Candidaturas registradas na base em ${municipio}`}
        acao={
          onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar histórico eleitoral"
              className="rounded-lg p-1 text-[var(--tse-muted)] transition-colors hover:bg-[var(--tse-bar)] hover:text-[var(--tse-text)]"
            >
              <X className="h-4 w-4" />
            </button>
          ) : undefined
        }
      >
        <div className="mt-3">
          {historico.length === 0 ? (
            <TseVazio>Nenhuma candidatura encontrada no histórico deste município.</TseVazio>
          ) : (
            <div className={tseTabela.wrap}>
              <table className={tseTabela.table} data-tse-tabela="">
                <thead>
                  <tr className={tseTabela.theadRow}>
                    <th className={tseTabela.th}>Ano</th>
                    <th className={tseTabela.th}>Cargo</th>
                    <th className={tseTabela.th}>Partido</th>
                    <th className={tseTabela.thNum}>Votos</th>
                    <th className={tseTabela.th}>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((item) => (
                    <tr
                      key={`${item.anoEleicao}-${item.cargo}`}
                      className={tseTabela.tr}
                    >
                      <td className={cn(tseTabela.td, 'font-bold tabular-nums')}>
                        {item.anoEleicao}
                      </td>
                      <td className={tseTabela.td}>{item.cargo}</td>
                      <td className={cn(tseTabela.td, 'font-semibold')}>{item.partido}</td>
                      <td className={cn(tseTabela.tdNum, 'font-bold')}>
                        {item.votos.toLocaleString('pt-BR')}
                      </td>
                      <td className={tseTabela.td}>
                        <TsePill tom={item.situacaoTom} title={item.situacaoOriginal || undefined}>
                          {item.situacaoLabel}
                        </TsePill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TseCard>
    </section>
  )
})
