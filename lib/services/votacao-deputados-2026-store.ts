import fs from 'fs/promises'
import path from 'path'
import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'

const DATA_PATH = path.join(process.cwd(), 'data', 'votacao-deputados-2026-municipio.json')

const CODIGO_CARGO: Record<string, string> = {
  'Deputado Federal': '6',
  'Deputado Estadual': '7',
}

type CandidatoDeputado2026 = {
  sq: string
  numero: string
  cargo: string
  urna: string
  nome: string
  partido: string
  situacao: string
}

type VotacaoDeputados2026Payload = {
  candidatos: CandidatoDeputado2026[]
  municipios: Array<{ codigo: string; nome: string }>
  /** `[índice do município, índice do candidato, votos nominais]` */
  votos: Array<[number, number, number]>
}

let cache: { mtimeMs: number; linhas: ResultadoEleicao[] } | null = null

/**
 * Votos nominais de Deputado Federal e Estadual 2026 (PI) por município, no formato das linhas da planilha
 * de resultados. Gerado por `scripts/build-resultado-secao-2026.mjs`; retorna vazio se o arquivo não existir.
 */
export async function carregarVotacaoDeputados2026(): Promise<ResultadoEleicao[]> {
  let mtimeMs: number
  try {
    ;({ mtimeMs } = await fs.stat(DATA_PATH))
  } catch {
    return []
  }
  if (cache && cache.mtimeMs === mtimeMs) return cache.linhas

  const payload = JSON.parse(await fs.readFile(DATA_PATH, 'utf8')) as VotacaoDeputados2026Payload
  const linhas: ResultadoEleicao[] = []
  for (const [m, c, votos] of payload.votos) {
    const municipio = payload.municipios[m]
    const cand = payload.candidatos[c]
    if (!municipio || !cand) continue
    linhas.push({
      uf: 'PI',
      municipio: municipio.nome,
      codigoCargo: CODIGO_CARGO[cand.cargo] ?? '',
      cargo: cand.cargo,
      numeroUrna: cand.numero,
      nomeCandidato: cand.nome,
      nomeUrnaCandidato: cand.urna,
      partido: cand.partido,
      coligacao: '',
      turno: '1',
      situacao: cand.situacao,
      dataUltimaTotalizacao: '',
      ue: municipio.codigo,
      sequencialCandidato: cand.sq,
      tipoDestinacaoVotos: '',
      sequencialEleicao: '',
      anoEleicao: '2026',
      regiao: '',
      percentualVotosValidos: '',
      quantidadeVotosNominais: String(votos),
      quantidadeVotosConcorrentes: '',
    })
  }
  cache = { mtimeMs, linhas }
  return linhas
}
