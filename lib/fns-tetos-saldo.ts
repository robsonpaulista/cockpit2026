/** Cálculo de saldos MAC/PAP a partir de propostas FNS (mesma regra do jadyelapp). */

import {
  inferirModalidadePropostaFns,
  isPropostaTipoMac,
  isPropostaTipoPap,
  type ModalidadeLimite,
} from '@/lib/emenda-modalidade'

export interface PropostaFns {
  nuProposta: string
  municipio: string
  vlProposta: number
  vlPagar: number
  vlPago?: number
  coTipoProposta: string
  dsTipoRecurso: string
  dtCadastramento?: string
  dsSituacaoProposta?: string
  nuProcesso?: string
  constituidoProcesso?: boolean
  parlamentares?: string[]
  pagamentos?: Array<Record<string, unknown>>
  linhaPropostas?: Array<Record<string, unknown>>
  nmPrograma?: string
  acao?: string
  urlConsultaFns?: string
  exercicio?: number
}

export interface ResumoTeto {
  limite: number | null
  propostas: number
  valorPagar: number
  saldo: number | null
}

export function filtrarPropostasFns(propostas: PropostaFns[]): PropostaFns[] {
  return propostas.filter((p) => p.dsTipoRecurso !== 'PROGRAMA')
}

export function calcularResumoMac(
  propostas: PropostaFns[],
  limite: number | null,
  modalidade: ModalidadeLimite = 'individual',
): ResumoTeto {
  const lista = propostas.filter(
    (p) =>
      isPropostaTipoMac(p.coTipoProposta) &&
      inferirModalidadePropostaFns(p) === modalidade,
  )
  const propostasValor = lista.reduce((acc, p) => acc + (p.vlProposta || 0), 0)
  const valorPagar = lista.reduce((acc, p) => acc + (p.vlPagar || 0), 0)
  const saldo = limite != null ? limite - propostasValor : null
  return { limite, propostas: propostasValor, valorPagar, saldo }
}

export function calcularResumoPap(
  propostas: PropostaFns[],
  limite: number | null,
  modalidade: ModalidadeLimite = 'individual',
): ResumoTeto {
  const lista = propostas.filter(
    (p) =>
      isPropostaTipoPap(p.coTipoProposta) &&
      inferirModalidadePropostaFns(p) === modalidade,
  )
  const propostasValor = lista.reduce((acc, p) => acc + (p.vlProposta || 0), 0)
  const valorPagar = lista.reduce((acc, p) => acc + (p.vlPagar || 0), 0)
  const saldo = limite != null ? limite - propostasValor : null
  return { limite, propostas: propostasValor, valorPagar, saldo }
}

export function calcularResumoSuas(
  limiteNumerico: number | null,
  totalPropostas: number,
  totalPagar: number,
): ResumoTeto {
  const saldo = limiteNumerico != null ? limiteNumerico - totalPropostas : null
  return {
    limite: limiteNumerico,
    propostas: totalPropostas,
    valorPagar: totalPagar,
    saldo,
  }
}
