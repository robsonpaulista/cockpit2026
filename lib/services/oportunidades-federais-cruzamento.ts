import { urgenciaExpiracao, type OportunidadeFederal } from '@/lib/oportunidades-federais'

export type MunicipioBaseCruzamento = {
  chave: string
  nome: string
  liderancas: number
  expectativaLegado: number
  temLideranca: boolean
  temEmenda: boolean
}

export type BaseCruzamento = {
  municipios: MunicipioBaseCruzamento[]
  total: number
  comLideranca: number
  comEmenda: number
  expectativaTotal: number
}

export type AlertaPrazoOportunidade = {
  idPrograma: number
  nome: string
  expiracaoProp: string | null
  dtFimRecebProp: string | null
  diasRestantes: number | null
  urgencia: number
}

export type NaturezaArticulacao = 'prefeitura' | 'osc' | 'estado' | 'outro'

export function classificarNaturezaArticulacao(
  natureza: string | null | undefined,
): NaturezaArticulacao {
  const n = (natureza || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (!n) return 'outro'
  if (n.includes('sociedade civil') || n.includes('osc')) return 'osc'
  if (n.includes('municipal')) return 'prefeitura'
  if (n.includes('estadual') || n.includes('distrito federal')) return 'estado'
  if (n.includes('administracao publica')) return 'prefeitura'
  return 'outro'
}

export function rotuloNaturezaArticulacao(n: NaturezaArticulacao): string {
  switch (n) {
    case 'prefeitura':
      return 'Prefeituras / adm. municipal'
    case 'osc':
      return 'Organizações da sociedade civil'
    case 'estado':
      return 'Governo estadual'
    default:
      return 'Outros proponentes'
  }
}

function diasAte(iso: string | null | undefined): number | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const fim = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const hoje = new Date()
  const hojeUtc = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((fim - hojeUtc) / 86400000)
}

/** Top municípios da base para articular um programa estadual. */
export function topMunicipiosParaPrograma(
  base: BaseCruzamento,
  opcoes: { soComLideranca?: boolean; limite?: number } = {},
): MunicipioBaseCruzamento[] {
  const limite = opcoes.limite ?? 12
  let lista = base.municipios
  if (opcoes.soComLideranca) lista = lista.filter((m) => m.temLideranca)
  return lista.slice(0, limite)
}

export function montarAlertasPrazo(itens: OportunidadeFederal[]): AlertaPrazoOportunidade[] {
  return itens
    .map((i) => ({
      idPrograma: i.idPrograma,
      nome: i.nome,
      expiracaoProp: i.expiracaoProp,
      dtFimRecebProp: i.dtFimRecebProp,
      diasRestantes: diasAte(i.dtFimRecebProp),
      urgencia: urgenciaExpiracao(i.expiracaoProp),
    }))
    .filter(
      (a) =>
        a.urgencia <= 1 ||
        (a.diasRestantes != null && a.diasRestantes >= 0 && a.diasRestantes <= 30),
    )
    .sort(
      (a, b) =>
        a.urgencia - b.urgencia ||
        (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999),
    )
}
