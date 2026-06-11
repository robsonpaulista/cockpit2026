/** Tipos e agregações das tabelas por cargo (Resumo Eleições / Ficha de Atendimento). */

export interface ResultadoEleicao {
  uf: string
  municipio: string
  codigoCargo: string
  cargo: string
  numeroUrna: string
  nomeCandidato: string
  nomeUrnaCandidato: string
  partido: string
  coligacao: string
  turno: string
  situacao: string
  dataUltimaTotalizacao: string
  ue: string
  sequencialCandidato: string
  tipoDestinacaoVotos: string
  sequencialEleicao: string
  anoEleicao: string
  regiao: string
  percentualVotosValidos: string
  quantidadeVotosNominais: string
  quantidadeVotosConcorrentes: string
}

export interface PartidoResumoEleicao {
  partido: string
  votos: number
  eleitos: number
}

export const CANDIDATO_FEDERAL_DESTAQUE = 'JADYEL DA JUPI'

export function parseVotosEleicao(value: string): number {
  const parsed = Number.parseInt(value || '0', 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Nome de urna sem nº embutido — só exibição; matching continua em numeroUrna / nomeUrnaCandidato. */
export function nomeCandidatoResumoExibicao(
  nomeUrnaCandidato: string,
  numeroUrna?: string,
): string {
  let nome = String(nomeUrnaCandidato ?? '').trim()
  if (!nome) return nome

  const nr = String(numeroUrna ?? '').replace(/\D/g, '')
  if (nr) {
    nome = nome.replace(new RegExp(`^${escapeRegExp(nr)}\\s*`, 'i'), '').trim()
    nome = nome.replace(new RegExp(`\\s+${escapeRegExp(nr)}$`, 'i'), '').trim()
  }

  nome = nome.replace(/\s+\d{2,5}$/, '').trim()
  nome = nome.replace(/^\d{2,5}\s+/, '').trim()

  return nome
}

export function includesNormalizedCargo(source: string, term: string): boolean {
  return source.toLowerCase().includes(term.toLowerCase())
}

export function filtrarDeputadoEstadual2022(dados: ResultadoEleicao[]): ResultadoEleicao[] {
  return dados
    .filter((item) => includesNormalizedCargo(item.cargo, 'estadual') && item.anoEleicao === '2022')
    .sort((a, b) => parseVotosEleicao(b.quantidadeVotosNominais) - parseVotosEleicao(a.quantidadeVotosNominais))
}

export function filtrarDeputadoFederal2022(dados: ResultadoEleicao[]): ResultadoEleicao[] {
  return dados
    .filter((item) => includesNormalizedCargo(item.cargo, 'federal') && item.anoEleicao === '2022')
    .sort((a, b) => parseVotosEleicao(b.quantidadeVotosNominais) - parseVotosEleicao(a.quantidadeVotosNominais))
}

export function filtrarPrefeito2024(dados: ResultadoEleicao[]): ResultadoEleicao[] {
  return dados
    .filter((item) => includesNormalizedCargo(item.cargo, 'prefeito') && item.anoEleicao === '2024')
    .sort((a, b) => parseVotosEleicao(b.quantidadeVotosNominais) - parseVotosEleicao(a.quantidadeVotosNominais))
}

export function filtrarVereador2024(dados: ResultadoEleicao[]): ResultadoEleicao[] {
  return dados
    .filter((item) => includesNormalizedCargo(item.cargo, 'vereador') && item.anoEleicao === '2024')
    .sort((a, b) => parseVotosEleicao(b.quantidadeVotosNominais) - parseVotosEleicao(a.quantidadeVotosNominais))
}

export function agruparPartido2024(dados: ResultadoEleicao[]): PartidoResumoEleicao[] {
  const grouped = new Map<string, PartidoResumoEleicao>()

  for (const item of dados) {
    if (item.anoEleicao !== '2024') continue
    const key = item.partido || '-'
    const current = grouped.get(key) || { partido: key, votos: 0, eleitos: 0 }
    current.votos += parseVotosEleicao(item.quantidadeVotosNominais)
    if (includesNormalizedCargo(item.situacao, 'eleito')) current.eleitos += 1
    grouped.set(key, current)
  }

  return Array.from(grouped.values()).sort((a, b) => b.votos - a.votos)
}
