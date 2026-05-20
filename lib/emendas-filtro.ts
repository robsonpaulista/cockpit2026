import { normalizeMunicipioNome, mapearNomeMunicipio } from '@/lib/fns-municipio-normalize'

export interface EmendaRegistro {
  id: string
  bloco: string | null
  exercicio: number | null
  emenda: string
  municipio_beneficiario: string | null
  funcional: string | null
  gnd: string | null
  valor_indicado: number | null
  valor_empenhado: number | null
  valor_a_empenhar: number | null
  valor_pago: number | null
  valor_a_ser_pago: number | null
  empenho: string | null
  data_empenho: string | null
  portaria_convenio: string | null
  numero_proposta: string | null
  data_pagamento: string | null
  liderancas: string | null
  alteracao: string | null
  objeto: string | null
}

function chaveMunicipio(nome: string): string {
  return normalizeMunicipioNome(mapearNomeMunicipio(nome))
}

export function emendaMunicipioCorresponde(
  municipioBeneficiario: string | null | undefined,
  municipioSelecionado: string,
): boolean {
  if (!municipioBeneficiario?.trim() || !municipioSelecionado.trim()) return false
  const alvo = chaveMunicipio(municipioSelecionado)
  const cadastro = chaveMunicipio(municipioBeneficiario)
  if (alvo === cadastro) return true
  return (
    municipioBeneficiario.trim().toLowerCase() === municipioSelecionado.trim().toLowerCase()
  )
}

export function filtrarEmendasPorMunicipio(
  emendas: EmendaRegistro[],
  municipio: string,
): EmendaRegistro[] {
  if (!municipio.trim()) return []
  return emendas.filter((e) => emendaMunicipioCorresponde(e.municipio_beneficiario, municipio))
}

export function totaisEmendas(emendas: EmendaRegistro[]) {
  return emendas.reduce(
    (acc, r) => {
      const indicado = Number(r.valor_indicado)
      const empenhado = Number(r.valor_empenhado)
      const aEmpenhar = Number(r.valor_a_empenhar)
      const pago = Number(r.valor_pago)
      const aSerPago = Number(r.valor_a_ser_pago)
      if (Number.isFinite(indicado)) acc.valorIndicado += indicado
      if (Number.isFinite(empenhado)) acc.valorEmpenhado += empenhado
      if (Number.isFinite(aEmpenhar)) acc.valorAEmpenhar += aEmpenhar
      if (Number.isFinite(pago)) acc.valorPago += pago
      if (Number.isFinite(aSerPago)) acc.valorASerPago += aSerPago
      return acc
    },
    {
      valorIndicado: 0,
      valorEmpenhado: 0,
      valorAEmpenhar: 0,
      valorPago: 0,
      valorASerPago: 0,
    },
  )
}

export function emendaEstaPaga(r: EmendaRegistro): boolean {
  const vp = Number(r.valor_pago)
  return Number.isFinite(vp) && vp > 0
}
