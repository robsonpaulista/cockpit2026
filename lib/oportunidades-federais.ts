/** Tipos e classificação das oportunidades federais (Transferegov · fora de emenda). */

export type ExpiracaoProg =
  | 'EXPIRACAO_PROG_MUITO_PROX'
  | 'EXPIRACAO_PROG_PROX'
  | 'EXPIRACAO_PROG_DISTANTE'
  | 'PROG_EXPIRADO'
  | string
  | null

export type OportunidadeFederal = {
  idPrograma: number
  codPrograma: string | null
  nome: string
  descricao: string | null
  observacao: string | null
  criteriosSelecao: string | null
  orgaoSuperior: string | null
  codOrgaoSuperior: string | null
  orgaoExecutor: string | null
  acaoOrcamentaria: string | null
  situacao: string | null
  modalidade: string | null
  qualificacaoProposta: string | null
  naturezaJuridica: string | null
  uf: string | null
  area: string
  dataDisponibilizacao: string | null
  dtIniRecebProp: string | null
  dtFimRecebProp: string | null
  expiracaoProp: ExpiracaoProg
  chamamentoProjeto: string | null
  fonte: string
  syncedAt?: string | null
  /** false = foco regional fora do Piauí (filtrado na lista principal). */
  relevantePi?: boolean
  motivoForaPi?: string | null
}

export type AreaOportunidade =
  | 'saude'
  | 'educacao'
  | 'infraestrutura'
  | 'agricultura'
  | 'cultura'
  | 'turismo'
  | 'assistencia'
  | 'esporte'
  | 'meio-ambiente'
  | 'outros'

export const AREA_LABELS: Record<AreaOportunidade, string> = {
  saude: 'Saúde',
  educacao: 'Educação',
  infraestrutura: 'Infraestrutura',
  agricultura: 'Agricultura',
  cultura: 'Cultura',
  turismo: 'Turismo',
  assistencia: 'Assistência / Direitos',
  esporte: 'Esporte',
  'meio-ambiente': 'Meio ambiente',
  outros: 'Outros',
}

const AREA_REGRAS: { area: AreaOportunidade; re: RegExp }[] = [
  { area: 'saude', re: /\bsaude|sus\b|hospital|ubs\b|samu|farmac/i },
  { area: 'educacao', re: /\beduc|escola|mec\b|creche|univers|professor|aluno|par\b|fnde/i },
  { area: 'infraestrutura', re: /\binfra|estrada|paviment|saneamento|habit|moradia|obra|rodovia|hidric|agua\b|drenag/i },
  { area: 'agricultura', re: /\bagric|agro|pecu[aá]r|rural|reforma agr[aá]r|produtor/i },
  { area: 'cultura', re: /\bcultur|museu|patrimon|audiovisual|document[aá]rio|arte\b/i },
  { area: 'turismo', re: /\bturismo|tur[ií]st/i },
  { area: 'assistencia', re: /\bassist|direitos? human|cidadania|igualdade|mulher|idoso|crian[cç]/i },
  { area: 'esporte', re: /\besporte|ol[ií]mp|atlet/i },
  { area: 'meio-ambiente', re: /\bambiente|sustent[aá]vel|floresta|clima|biodivers/i },
]

export function classificarArea(texto: string): AreaOportunidade {
  for (const regra of AREA_REGRAS) {
    if (regra.re.test(texto)) return regra.area
  }
  return 'outros'
}

export function rotuloExpiracao(exp: ExpiracaoProg): string {
  switch (exp) {
    case 'EXPIRACAO_PROG_MUITO_PROX':
      return 'Prazo muito próximo'
    case 'EXPIRACAO_PROG_PROX':
      return 'Prazo próximo'
    case 'EXPIRACAO_PROG_DISTANTE':
      return 'Prazo mais longo'
    case 'PROG_EXPIRADO':
      return 'Expirado'
    default:
      return exp ? String(exp) : '—'
  }
}

export function urgenciaExpiracao(exp: ExpiracaoProg): number {
  switch (exp) {
    case 'EXPIRACAO_PROG_MUITO_PROX':
      return 0
    case 'EXPIRACAO_PROG_PROX':
      return 1
    case 'EXPIRACAO_PROG_DISTANTE':
      return 2
    case 'PROG_EXPIRADO':
      return 9
    default:
      return 5
  }
}

/**
 * Detalhe público do programa no módulo Discricionárias (Acesso Livre / guest).
 * O `id` é o id_programa do Transferegov — não o código alfanumérico.
 */
export function linkTransferegovDetalhePrograma(idPrograma: number | null | undefined): string | null {
  if (idPrograma == null || !Number.isFinite(idPrograma) || idPrograma <= 0) return null
  const q = new URLSearchParams({
    id: String(Math.trunc(idPrograma)),
    Usr: 'guest',
    Pwd: 'guest',
  })
  return `https://discricionarias.transferegov.sistema.gov.br/voluntarias/ConsultarPrograma/ResultadoDaConsultaDeProgramaDeConvenioDetalhar.do?${q.toString()}`
}

/** Lista/consulta de programas no Acesso Livre (fallback se o detalhe pedir login). */
export function linkTransferegovConsultaProgramas(): string {
  return 'https://discricionarias.transferegov.sistema.gov.br/voluntarias/ForwardAction.do?modulo=programa&path=/ConsultarPrograma/ConsultarPrograma.do&Usr=guest&Pwd=guest'
}

function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Sinais de que o programa é do Piauí / Nordeste / nacional genérico. */
const RE_FOCO_PI_NORDESTE =
  /\bpiaui\b|\bpiauiense\b|\bnordeste\b|\bsemiarido\b|\bmatopiba\b|\bcerrado\b|\bparnaiba\b|\bteresina\b|\bchapada do araripe\b|\bserrao\b|\bsertao\b/

/**
 * Indícios de foco geográfico fora do Piauí.
 * O Transferegov costuma listar o mesmo programa em várias UFs mesmo quando o
 * objeto é regional (ex.: Amazônia marcado como PI).
 */
const RE_FOCO_FORA: { re: RegExp; rotulo: string }[] = [
  { re: /\bamazoni|\bamazonas\b/, rotulo: 'Amazônia' },
  { re: /\bvale do javari\b|\balto solimoes\b|\bsolimoes\b/, rotulo: 'Vale do Javari / Solimões' },
  { re: /\bpirarucu\b/, rotulo: 'cadeia do pirarucu (Amazônia)' },
  { re: /\bpantanal\b/, rotulo: 'Pantanal' },
  { re: /\byanomami\b|\btikuna\b|\bmunduruku\b/, rotulo: 'povos/territórios amazônicos' },
  { re: /\bbaixada fluminense\b|\brio de janeiro\b|\bfluminense\b/, rotulo: 'Rio de Janeiro' },
  { re: /\bsao paulo\b|\bcidade de sao paulo\b/, rotulo: 'São Paulo' },
  { re: /\bminas gerais\b|\btriangulo mineiro\b/, rotulo: 'Minas Gerais' },
  { re: /\brio grande do sul\b|\bpampa gaucho\b/, rotulo: 'Rio Grande do Sul' },
  { re: /\bsanta catarina\b/, rotulo: 'Santa Catarina' },
  { re: /\bestado do parana\b|\bparanaense\b/, rotulo: 'Paraná' },
  { re: /\bmato grosso do sul\b|\bestado de mato grosso\b/, rotulo: 'Centro-Oeste' },
  { re: /\broraima\b|\bamapa\b|\bacre\b|\bmanaus\b|\bbelem do para\b|\bestado do para\b/, rotulo: 'Norte' },
  { re: /\bespirito santo\b/, rotulo: 'Espírito Santo' },
  { re: /\bterritorio seguro,?\s*amazonia soberana\b/, rotulo: 'programa Amazônia Soberana' },
]

export type RelevanciaPiaui = {
  relevante: boolean
  /** Por que foi considerado fora do recorte do PI, se aplicável. */
  motivoFora: string | null
}

/**
 * Decide se o programa faz sentido para o gabinete no Piauí.
 * Mantém programas nacionais/genéricos; corta os claramente de outra região.
 */
export function avaliarRelevanciaPiaui(...partes: Array<string | null | undefined>): RelevanciaPiaui {
  const texto = normalizarTexto(partes.filter(Boolean).join(' \n '))
  if (!texto.trim()) return { relevante: true, motivoFora: null }

  const temFocoLocal = RE_FOCO_PI_NORDESTE.test(texto)
  const hits: string[] = []
  for (const regra of RE_FOCO_FORA) {
    if (regra.re.test(texto)) hits.push(regra.rotulo)
  }
  if (hits.length === 0) return { relevante: true, motivoFora: null }

  // Se cita PI/Nordeste junto com outra região, ainda pode ser multiestadual útil.
  if (temFocoLocal) return { relevante: true, motivoFora: null }

  return {
    relevante: false,
    motivoFora: `Foco regional fora do Piauí (${[...new Set(hits)].join(', ')})`,
  }
}
