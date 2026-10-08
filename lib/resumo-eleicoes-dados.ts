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

/** Normaliza situação/cargo para comparação (sem acento). */
export function normalizeSituacaoEleicao(source: string): string {
  return String(source || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Situação de eleito de fato (TSE: ELEITO, ELEITO POR QP, ELEITO POR MÉDIA…).
 * Não confunde com "Não eleito" (substring "eleito").
 */
export function isSituacaoEleito(situacao: string): boolean {
  const n = normalizeSituacaoEleicao(situacao)
  if (!n) return false
  if (/\bnao\s+eleito\b/.test(n)) return false
  return /\beleito\b/.test(n)
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

/* Ascensão e queda: a mesma pessoa (pelo nome civil) entre eleições, mesmo trocando de cargo. */

export const ANOS_MOVIMENTO_CANDIDATOS = ['2022', '2024', '2026'] as const

export type ParticipacaoCandidato = { ano: string; cargo: string; votos: number }

export type MovimentoCandidato = {
  chave: string
  nomeUrna: string
  partido: string
  anterior: ParticipacaoCandidato
  atual: ParticipacaoCandidato
  /** Todas as participações no município, da mais antiga para a mais recente. */
  trajetoria: ParticipacaoCandidato[]
  diferenca: number
  /** null quando a participação anterior teve 0 votos. */
  variacaoPct: number | null
}

export type EstreanteCandidato = {
  chave: string
  nomeUrna: string
  partido: string
  cargo: string
  votos: number
  /** Fatia dos votos do cargo no município. */
  pctCargo: number
}

export type MovimentosCandidatos = {
  subidas: MovimentoCandidato[]
  quedas: MovimentoCandidato[]
  estreantes: EstreanteCandidato[]
}

const ANO_ESTREIA = '2026'

const chavePessoa = (item: ResultadoEleicao): string =>
  normalizeSituacaoEleicao(item.nomeCandidato || item.nomeUrnaCandidato)

/**
 * Compara as duas participações mais recentes de cada pessoa no município.
 * Destacável = diferença de ao menos 1% dos votos do maior cargo da cidade (mín. 50) e de 20% sobre a anterior.
 * Estreantes = votação de 2026 acima desse mesmo mínimo, sem disputa anterior na base (2020 a 2024).
 * `dados` traz só o município; `jaDisputaramNoEstado` cobre quem disputou em outra cidade.
 * Sem esse conjunto, a lista de estreantes fica vazia para não apontar falsos outsiders.
 */
export function movimentosCandidatos(
  dados: ResultadoEleicao[],
  { limite = 8, jaDisputaramNoEstado }: { limite?: number; jaDisputaramNoEstado?: ReadonlySet<string> | null } = {},
): MovimentosCandidatos {
  const anos = new Set<string>(ANOS_MOVIMENTO_CANDIDATOS)
  type Participacao = ParticipacaoCandidato & { nomeUrna: string; partido: string }
  const pessoas = new Map<string, Map<string, Participacao>>()
  const totalPorCargoAno = new Map<string, number>()
  const jaDisputou = new Set<string>()

  for (const item of dados) {
    const chave = chavePessoa(item)
    if (!chave) continue
    if (item.anoEleicao < ANO_ESTREIA) jaDisputou.add(chave)
    if (!anos.has(item.anoEleicao)) continue
    const votos = parseVotosEleicao(item.quantidadeVotosNominais)
    const cargoAno = `${item.anoEleicao}|${item.cargo}`
    totalPorCargoAno.set(cargoAno, (totalPorCargoAno.get(cargoAno) ?? 0) + votos)

    const porAno = pessoas.get(chave) ?? new Map<string, Participacao>()
    const existente = porAno.get(item.anoEleicao)
    porAno.set(item.anoEleicao, {
      ano: item.anoEleicao,
      cargo: existente?.cargo ?? item.cargo,
      votos: (existente?.votos ?? 0) + votos,
      nomeUrna: existente?.nomeUrna ?? nomeCandidatoResumoExibicao(item.nomeUrnaCandidato, item.numeroUrna),
      partido: existente?.partido ?? item.partido,
    })
    pessoas.set(chave, porAno)
  }

  const maiorTotal = Math.max(0, ...totalPorCargoAno.values())
  const minimo = Math.max(50, Math.round(maiorTotal * 0.01))
  const movimentos: MovimentoCandidato[] = []
  const estreantes: EstreanteCandidato[] = []

  for (const [chave, porAno] of pessoas) {
    const participacoes = [...porAno.values()].sort((a, b) => a.ano.localeCompare(b.ano))
    const estreia = porAno.get(ANO_ESTREIA)
    if (
      jaDisputaramNoEstado &&
      estreia &&
      participacoes.length === 1 &&
      !jaDisputou.has(chave) &&
      !jaDisputaramNoEstado.has(chave) &&
      estreia.votos >= minimo
    ) {
      const totalCargo = totalPorCargoAno.get(`${ANO_ESTREIA}|${estreia.cargo}`) ?? 0
      estreantes.push({
        chave,
        nomeUrna: estreia.nomeUrna,
        partido: estreia.partido,
        cargo: estreia.cargo,
        votos: estreia.votos,
        pctCargo: totalCargo > 0 ? (estreia.votos / totalCargo) * 100 : 0,
      })
    }
    if (participacoes.length < 2) continue
    const anterior = participacoes[participacoes.length - 2]
    const atual = participacoes[participacoes.length - 1]
    const diferenca = atual.votos - anterior.votos
    const variacaoPct = anterior.votos > 0 ? (diferenca / anterior.votos) * 100 : null
    if (Math.abs(diferenca) < minimo) continue
    if (variacaoPct !== null && Math.abs(variacaoPct) < 20) continue
    const semRotulo = ({ ano, cargo, votos }: Participacao): ParticipacaoCandidato => ({ ano, cargo, votos })
    movimentos.push({
      chave,
      nomeUrna: atual.nomeUrna,
      partido: atual.partido,
      anterior: semRotulo(anterior),
      atual: semRotulo(atual),
      trajetoria: participacoes.map(semRotulo),
      diferenca,
      variacaoPct,
    })
  }

  const porTamanho = (a: MovimentoCandidato, b: MovimentoCandidato) => Math.abs(b.diferenca) - Math.abs(a.diferenca)
  return {
    subidas: movimentos.filter((m) => m.diferenca > 0).sort(porTamanho).slice(0, limite),
    quedas: movimentos.filter((m) => m.diferenca < 0).sort(porTamanho).slice(0, limite),
    estreantes: estreantes.sort((a, b) => b.votos - a.votos).slice(0, limite),
  }
}

export function agruparPartido2024(dados: ResultadoEleicao[]): PartidoResumoEleicao[] {
  const grouped = new Map<string, PartidoResumoEleicao>()

  for (const item of dados) {
    if (item.anoEleicao !== '2024') continue
    const key = item.partido || '-'
    const current = grouped.get(key) || { partido: key, votos: 0, eleitos: 0 }
    current.votos += parseVotosEleicao(item.quantidadeVotosNominais)
    // Prefeito e vereador entram — só se eleitos de fato (não "Não eleito").
    if (isSituacaoEleito(item.situacao)) {
      current.eleitos += 1
    }
    grouped.set(key, current)
  }

  return Array.from(grouped.values()).sort((a, b) => b.votos - a.votos)
}
