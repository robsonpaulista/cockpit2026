/** Resultado por seção 2026 (SISTOT/TRE-PI) — gerado por `scripts/build-resultado-secao-2026.mjs`. */

export type ResultadoSecao2026Meta = {
  eleicao: string
  turno: number
  geradoEm: string
  totalSecoes: number
  totalMunicipios: number
}

export type ResultadoSecao2026Candidato = {
  id: string
  nome: string
  numero: string
  cargo: string
  fonte: string
  totalVotos: number
  secoesNoRelatorio: number
  /** Geral e parceiros de dobradinha; os demais aparecem só nas visões de resultado. */
  comparativo: boolean
}

export type ResultadoSecao2026Municipio = { codigo: string; nome: string }

export type ResultadoSecao2026Local = {
  id: number
  municipio: string
  zona: number
  nome: string
  endereco: string
  bairro: string
  cep: string
  lat: number | null
  lng: number | null
}

/** m = código do município, z = zona, s = seção, l = id do local, v = votos por candidato (ordem de `candidatos`). */
export type ResultadoSecao2026SecaoMulti = { m: string; z: number; s: number; l: number | null; v: number[] }

/** Seção vista para um único candidato. */
export type ResultadoSecao2026Secao = { m: string; z: number; s: number; v: number; l: number | null }

export type ResultadoSecao2026Payload = {
  meta: ResultadoSecao2026Meta
  candidatos: ResultadoSecao2026Candidato[]
  municipios: ResultadoSecao2026Municipio[]
  locais: ResultadoSecao2026Local[]
  secoes: ResultadoSecao2026SecaoMulti[]
}

export type ResultadoSecao2026Filtro = { municipio: string | null; zona: number | null }

export type MunicipioResumo2026 = {
  codigo: string
  nome: string
  votos: number
  secoes: number
  secoesComVoto: number
  locais: number
  zonas: number[]
  pctTotal: number
  mediaSecao: number
}

export type LocalResumo2026 = {
  localId: number | null
  local: ResultadoSecao2026Local | null
  municipioCodigo: string
  municipioNome: string
  zona: number
  votos: number
  secoes: ResultadoSecao2026Secao[]
  pctEscopo: number
}

export type SecaoDetalhe2026 = ResultadoSecao2026Secao & {
  municipioNome: string
  local: ResultadoSecao2026Local | null
}

export type ResumoGeral2026 = {
  votos: number
  secoes: number
  secoesComVoto: number
  secoesSemVoto: number
  municipios: number
  municipiosComVoto: number
  locais: number
  mediaSecao: number
  maiorSecao: SecaoDetalhe2026 | null
}

export type NivelArvore2026 = 'municipio' | 'bairro' | 'local' | 'zona' | 'secao'

export type NoArvore2026 = {
  key: string
  nivel: NivelArvore2026
  nome: string
  detalhe: string
  secoes: number
  /** Votos na ordem dos candidatos selecionados. */
  votos: number[]
  total: number
  lider: number | null
  filhos: NoArvore2026[]
}

export type LinhaComparativo2026 = {
  key: string
  nome: string
  detalhe: string
  municipioCodigo: string | null
  municipioNome: string
  zona: number | null
  localId: number | null
  secoes: number
  /** Votos na ordem dos candidatos selecionados. */
  votos: number[]
  total: number
  /** Posição (na seleção) de quem lidera; null em empate ou sem votos. */
  lider: number | null
}

export type ResumoComparativo2026 = {
  linhas: number
  totais: number[]
  vitorias: number[]
  exclusivos: number[]
  empates: number
  todosComVoto: number
  nenhumVoto: number
  /** Correlação de Pearson entre os dois primeiros selecionados, linha a linha. */
  correlacao: number | null
}

export function filtrarSecoes2026<T extends { m: string; z: number }>(
  secoes: T[],
  filtro: ResultadoSecao2026Filtro,
): T[] {
  return secoes.filter(
    (s) =>
      (filtro.municipio == null || s.m === filtro.municipio) &&
      (filtro.zona == null || s.z === filtro.zona),
  )
}

export function secoesDoCandidato2026(
  secoes: ResultadoSecao2026SecaoMulti[],
  indice: number,
): ResultadoSecao2026Secao[] {
  return secoes.map((s) => ({ m: s.m, z: s.z, s: s.s, l: s.l, v: s.v[indice] ?? 0 }))
}

function nomesMunicipio(payload: ResultadoSecao2026Payload): Map<string, string> {
  return new Map(payload.municipios.map((m) => [m.codigo, m.nome]))
}

function locaisPorId(payload: ResultadoSecao2026Payload): Map<number, ResultadoSecao2026Local> {
  return new Map(payload.locais.map((l) => [l.id, l]))
}

export function resumoGeral2026(
  payload: ResultadoSecao2026Payload,
  secoes: ResultadoSecao2026Secao[],
): ResumoGeral2026 {
  const votos = secoes.reduce((a, s) => a + s.v, 0)
  const secoesComVoto = secoes.filter((s) => s.v > 0).length
  const municipios = new Set(secoes.map((s) => s.m))
  const municipiosComVoto = new Set(secoes.filter((s) => s.v > 0).map((s) => s.m))
  const locais = new Set(secoes.map((s) => s.l).filter((l): l is number => l != null))
  let maior: ResultadoSecao2026Secao | null = null
  for (const s of secoes) if (!maior || s.v > maior.v) maior = s
  const nomes = nomesMunicipio(payload)
  const porId = locaisPorId(payload)
  return {
    votos,
    secoes: secoes.length,
    secoesComVoto,
    secoesSemVoto: secoes.length - secoesComVoto,
    municipios: municipios.size,
    municipiosComVoto: municipiosComVoto.size,
    locais: locais.size,
    mediaSecao: secoes.length ? votos / secoes.length : 0,
    maiorSecao:
      maior && maior.v > 0
        ? {
            ...maior,
            municipioNome: nomes.get(maior.m) ?? maior.m,
            local: maior.l != null ? porId.get(maior.l) ?? null : null,
          }
        : null,
  }
}

export function resumirMunicipios2026(
  payload: ResultadoSecao2026Payload,
  secoes: ResultadoSecao2026Secao[],
): MunicipioResumo2026[] {
  const total = secoes.reduce((a, s) => a + s.v, 0)
  const nomes = nomesMunicipio(payload)
  const acc = new Map<
    string,
    { votos: number; secoes: number; comVoto: number; locais: Set<number>; zonas: Set<number> }
  >()
  for (const s of secoes) {
    const cur = acc.get(s.m) ?? { votos: 0, secoes: 0, comVoto: 0, locais: new Set(), zonas: new Set() }
    cur.votos += s.v
    cur.secoes += 1
    if (s.v > 0) cur.comVoto += 1
    if (s.l != null) cur.locais.add(s.l)
    cur.zonas.add(s.z)
    acc.set(s.m, cur)
  }
  return [...acc.entries()].map(([codigo, c]) => ({
    codigo,
    nome: nomes.get(codigo) ?? codigo,
    votos: c.votos,
    secoes: c.secoes,
    secoesComVoto: c.comVoto,
    locais: c.locais.size,
    zonas: [...c.zonas].sort((a, b) => a - b),
    pctTotal: total ? (c.votos / total) * 100 : 0,
    mediaSecao: c.secoes ? c.votos / c.secoes : 0,
  }))
}

export function resumirLocais2026(
  payload: ResultadoSecao2026Payload,
  secoes: ResultadoSecao2026Secao[],
): LocalResumo2026[] {
  const total = secoes.reduce((a, s) => a + s.v, 0)
  const nomes = nomesMunicipio(payload)
  const porId = locaisPorId(payload)
  const acc = new Map<string, LocalResumo2026>()
  for (const s of secoes) {
    const key = s.l != null ? `l${s.l}` : `${s.m}|${s.z}|sem-local`
    const cur = acc.get(key) ?? {
      localId: s.l,
      local: s.l != null ? porId.get(s.l) ?? null : null,
      municipioCodigo: s.m,
      municipioNome: nomes.get(s.m) ?? s.m,
      zona: s.z,
      votos: 0,
      secoes: [],
      pctEscopo: 0,
    }
    cur.votos += s.v
    cur.secoes.push(s)
    acc.set(key, cur)
  }
  return [...acc.values()].map((l) => ({
    ...l,
    secoes: [...l.secoes].sort((a, b) => a.s - b.s),
    pctEscopo: total ? (l.votos / total) * 100 : 0,
  }))
}

export function detalharSecoes2026(
  payload: ResultadoSecao2026Payload,
  secoes: ResultadoSecao2026Secao[],
): SecaoDetalhe2026[] {
  const nomes = nomesMunicipio(payload)
  const porId = locaisPorId(payload)
  return secoes.map((s) => ({
    ...s,
    municipioNome: nomes.get(s.m) ?? s.m,
    local: s.l != null ? porId.get(s.l) ?? null : null,
  }))
}

function liderDe(votos: number[]): number | null {
  let max = 0
  let idx: number | null = null
  let empate = false
  votos.forEach((v, i) => {
    if (v > max) {
      max = v
      idx = i
      empate = false
    } else if (v === max && v > 0) {
      empate = true
    }
  })
  return empate ? null : idx
}

/** Uma linha por local de votação — base dos indicadores do comparativo. */
export function compararCandidatos2026(
  payload: ResultadoSecao2026Payload,
  secoes: ResultadoSecao2026SecaoMulti[],
  indices: number[],
): LinhaComparativo2026[] {
  const nomes = nomesMunicipio(payload)
  const porId = locaisPorId(payload)
  const acc = new Map<string, LinhaComparativo2026>()
  for (const s of secoes) {
    const key = s.l != null ? `l${s.l}` : `${s.m}|${s.z}|sem-local`
    let cur = acc.get(key)
    if (!cur) {
      const local = s.l != null ? porId.get(s.l) ?? null : null
      cur = {
        key,
        nome: local?.nome ?? 'Local não identificado',
        detalhe: [local?.endereco, local?.bairro].filter((x): x is string => Boolean(x)).join(' · '),
        municipioCodigo: s.m,
        municipioNome: nomes.get(s.m) ?? s.m,
        zona: s.z,
        localId: s.l,
        secoes: 0,
        votos: indices.map(() => 0),
        total: 0,
        lider: null,
      }
      acc.set(key, cur)
    }
    cur.secoes += 1
    indices.forEach((ci, i) => {
      const v = s.v[ci] ?? 0
      cur.votos[i] += v
      cur.total += v
    })
  }
  return [...acc.values()].map((l) => ({ ...l, lider: liderDe(l.votos) }))
}

const SEM_BAIRRO = 'SEM BAIRRO INFORMADO'

function bairroDe(local: ResultadoSecao2026Local | null): string {
  const b = local?.bairro?.trim().replace(/\s+/g, ' ').toUpperCase()
  return b || SEM_BAIRRO
}

type NoMutavel = Omit<NoArvore2026, 'filhos' | 'lider'> & { filhos: Map<string, NoMutavel> }

/**
 * Árvore [Município →] Bairro → Local de votação → Zona → Seção.
 * O nível Município só entra quando o escopo tem mais de uma cidade (bairros se repetem entre cidades).
 */
export function montarArvore2026(
  payload: ResultadoSecao2026Payload,
  secoes: ResultadoSecao2026SecaoMulti[],
  indices: number[],
): NoArvore2026[] {
  const nomes = nomesMunicipio(payload)
  const porId = locaisPorId(payload)
  const incluirMunicipio = new Set(secoes.map((s) => s.m)).size > 1
  const raiz = new Map<string, NoMutavel>()

  const obter = (
    mapa: Map<string, NoMutavel>,
    key: string,
    nivel: NivelArvore2026,
    nome: string,
    detalhe: string,
  ): NoMutavel => {
    let no = mapa.get(key)
    if (!no) {
      no = { key, nivel, nome, detalhe, secoes: 0, votos: indices.map(() => 0), total: 0, filhos: new Map() }
      mapa.set(key, no)
    }
    return no
  }

  for (const s of secoes) {
    const local = s.l != null ? porId.get(s.l) ?? null : null
    const bairro = bairroDe(local)
    const caminho: NoMutavel[] = []
    let nivelAtual = raiz
    let prefixo = ''
    if (incluirMunicipio) {
      prefixo = `m${s.m}`
      const m = obter(nivelAtual, prefixo, 'municipio', nomes.get(s.m) ?? s.m, '')
      caminho.push(m)
      nivelAtual = m.filhos
    }
    const kb = `${prefixo}|b${bairro}`
    const b = obter(nivelAtual, kb, 'bairro', bairro, '')
    caminho.push(b)
    const kl = `${kb}|l${s.l ?? `${s.m}-${s.z}`}`
    const l = obter(b.filhos, kl, 'local', local?.nome ?? 'Local não identificado', local?.endereco ?? '')
    caminho.push(l)
    const kz = `${kl}|z${s.z}`
    const z = obter(l.filhos, kz, 'zona', `Zona ${formatarZona2026(s.z)}`, '')
    caminho.push(z)
    const sec = obter(z.filhos, `${kz}|s${s.s}`, 'secao', `Seção ${formatarSecao2026(s.s)}`, '')
    caminho.push(sec)

    for (const no of caminho) {
      no.secoes += 1
      indices.forEach((ci, i) => {
        const v = s.v[ci] ?? 0
        no.votos[i] += v
        no.total += v
      })
    }
  }

  const finalizar = (mapa: Map<string, NoMutavel>): NoArvore2026[] =>
    [...mapa.values()].map((no) => ({
      ...no,
      lider: liderDe(no.votos),
      filhos: finalizar(no.filhos),
    }))

  return finalizar(raiz)
}

export type LinhaArvore2026 = {
  no: NoArvore2026
  profundidade: number
  /** Maior votação individual entre os irmãos (escala das barras). */
  maxIrmaos: number
}

/** Lista as linhas visíveis da árvore, em ordem de leitura, descendo só nos nós abertos. */
export function achatarArvore2026(
  nos: NoArvore2026[],
  aberto: (no: NoArvore2026) => boolean,
  profundidade = 0,
): LinhaArvore2026[] {
  const maxIrmaos = nos.reduce((m, no) => Math.max(m, ...no.votos), 0)
  return nos.flatMap((no) => {
    const linha: LinhaArvore2026 = { no, profundidade, maxIrmaos }
    return no.filhos.length && aberto(no)
      ? [linha, ...achatarArvore2026(no.filhos, aberto, profundidade + 1)]
      : [linha]
  })
}

function pearson(a: number[], b: number[]): number | null {
  const n = a.length
  if (n < 3) return null
  const ma = a.reduce((x, y) => x + y, 0) / n
  const mb = b.reduce((x, y) => x + y, 0) / n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da && db ? num / Math.sqrt(da * db) : null
}

export function resumirComparativo2026(linhas: LinhaComparativo2026[], n: number): ResumoComparativo2026 {
  const totais = Array.from({ length: n }, () => 0)
  const vitorias = Array.from({ length: n }, () => 0)
  const exclusivos = Array.from({ length: n }, () => 0)
  let empates = 0
  let todosComVoto = 0
  let nenhumVoto = 0
  for (const l of linhas) {
    l.votos.forEach((v, i) => {
      totais[i] += v
    })
    if (l.total === 0) {
      nenhumVoto++
      continue
    }
    if (l.lider == null) empates++
    else vitorias[l.lider]++
    const comVoto = l.votos.filter((v) => v > 0).length
    if (comVoto === n) todosComVoto++
    if (comVoto === 1) exclusivos[l.votos.findIndex((v) => v > 0)]++
  }
  return {
    linhas: linhas.length,
    totais,
    vitorias,
    exclusivos,
    empates,
    todosComVoto,
    nenhumVoto,
    correlacao:
      n >= 2
        ? pearson(
            linhas.map((l) => l.votos[0]),
            linhas.map((l) => l.votos[1]),
          )
        : null,
  }
}

function csvEsc(v: string | number): string {
  const t = String(v)
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

export function secoesParaCsv2026(linhas: SecaoDetalhe2026[]): string {
  const header = ['municipio', 'zona', 'secao', 'votos', 'local', 'endereco', 'bairro']
  const rows = linhas.map((s) =>
    [s.municipioNome, s.z, s.s, s.v, s.local?.nome ?? '', s.local?.endereco ?? '', s.local?.bairro ?? '']
      .map(csvEsc)
      .join(';'),
  )
  return [header.join(';'), ...rows].join('\n')
}

/** Uma linha por seção, com a hierarquia município → bairro → local → zona → seção. */
export function comparativoSecoesParaCsv2026(
  payload: ResultadoSecao2026Payload,
  secoes: ResultadoSecao2026SecaoMulti[],
  indices: number[],
): string {
  const nomes = nomesMunicipio(payload)
  const porId = locaisPorId(payload)
  const candidatos = indices.map((i) => payload.candidatos[i])
  const header = [
    'municipio',
    'bairro',
    'local',
    'endereco',
    'zona',
    'secao',
    ...candidatos.map((c) => `${c.nome} (${c.numero})`),
    'total',
    'lider',
  ]
  const rows = secoes.map((s) => {
    const local = s.l != null ? porId.get(s.l) ?? null : null
    const votos = indices.map((ci) => s.v[ci] ?? 0)
    const total = votos.reduce((a, b) => a + b, 0)
    const lider = liderDe(votos)
    return [
      nomes.get(s.m) ?? s.m,
      bairroDe(local),
      local?.nome ?? '',
      local?.endereco ?? '',
      s.z,
      s.s,
      ...votos,
      total,
      lider != null ? candidatos[lider]?.nome ?? '' : total ? 'empate' : '',
    ]
      .map(csvEsc)
      .join(';')
  })
  return [header.map(csvEsc).join(';'), ...rows].join('\n')
}

export type LinhaSecaoComparada2026 = {
  key: string
  municipioCodigo: string
  municipioNome: string
  bairro: string
  zona: number
  secao: number
  /** Votos na ordem dos selecionados: posição 0 é o geral, as demais são parceiros. */
  votos: number[]
  /** Confronto do geral com cada parceiro; `pares[p - 1]` corresponde a `votos[p]`. */
  pares: ParSecao2026[]
}

/** Geral × um parceiro numa seção. */
export type ParSecao2026 = {
  geral: number
  parceiro: number
  total: number
  /** 0 = geral à frente, 1 = parceiro à frente, null = empate ou sem votos. */
  lider: 0 | 1 | null
  /** Geral menos parceiro (negativo com o parceiro à frente). */
  saldo: number
  diferenca: number
  /** Diferença sobre a soma dos dois, em %. */
  margemPct: number
  /** Parceiro em % do geral. */
  razaoPct: number | null
}

export type ModoFaixa2026 = 'votos' | 'pct' | 'razao'

/** Intervalo (acima, ate]; `ate === 0` é o empate exato. */
export type FaixaDiferenca2026 = { id: string; rotulo: string; acima: number; ate: number | null }

export const FAIXAS_DIFERENCA_2026: Record<ModoFaixa2026, FaixaDiferenca2026[]> = {
  votos: [
    { id: 'v-empate', rotulo: 'Empate', acima: -1, ate: 0 },
    { id: 'v-1-2', rotulo: '1 a 2 votos', acima: 0, ate: 2 },
    { id: 'v-3-5', rotulo: '3 a 5 votos', acima: 2, ate: 5 },
    { id: 'v-6-10', rotulo: '6 a 10 votos', acima: 5, ate: 10 },
    { id: 'v-11-20', rotulo: '11 a 20 votos', acima: 10, ate: 20 },
    { id: 'v-21-50', rotulo: '21 a 50 votos', acima: 20, ate: 50 },
    { id: 'v-51', rotulo: 'Mais de 50 votos', acima: 50, ate: null },
  ],
  pct: [
    { id: 'p-empate', rotulo: 'Empate', acima: -1, ate: 0 },
    { id: 'p-5', rotulo: 'Até 5%', acima: 0, ate: 5 },
    { id: 'p-10', rotulo: '5% a 10%', acima: 5, ate: 10 },
    { id: 'p-25', rotulo: '10% a 25%', acima: 10, ate: 25 },
    { id: 'p-50', rotulo: '25% a 50%', acima: 25, ate: 50 },
    { id: 'p-75', rotulo: '50% a 75%', acima: 50, ate: 75 },
    { id: 'p-100', rotulo: 'Mais de 75%', acima: 75, ate: null },
  ],
  razao: [
    { id: 'r-zero', rotulo: 'Zerado', acima: -1, ate: 0 },
    { id: 'r-25', rotulo: 'Até 25%', acima: 0, ate: 25 },
    { id: 'r-50', rotulo: '25% a 50%', acima: 25, ate: 50 },
    { id: 'r-75', rotulo: '50% a 75%', acima: 50, ate: 75 },
    { id: 'r-100', rotulo: '75% a 100%', acima: 75, ate: 100 },
    { id: 'r-150', rotulo: '100% a 150%', acima: 100, ate: 150 },
    { id: 'r-mais', rotulo: 'Acima de 150%', acima: 150, ate: null },
  ],
}

/** `Infinity` quando o geral zerou e o parceiro não; `null` sem voto de nenhum. */
export function razaoPct2026(geral: number, parceiro: number): number | null {
  if (geral > 0) return (parceiro / geral) * 100
  return parceiro > 0 ? Number.POSITIVE_INFINITY : null
}

export function parSecao2026(geral: number, parceiro: number): ParSecao2026 {
  const total = geral + parceiro
  const saldo = geral - parceiro
  const diferenca = Math.abs(saldo)
  return {
    geral,
    parceiro,
    total,
    lider: saldo > 0 ? 0 : saldo < 0 ? 1 : null,
    saldo,
    diferenca,
    margemPct: total ? (diferenca / total) * 100 : 0,
    razaoPct: razaoPct2026(geral, parceiro),
  }
}

export function compararSecoes2026(
  payload: ResultadoSecao2026Payload,
  secoes: ResultadoSecao2026SecaoMulti[],
  indices: number[],
): LinhaSecaoComparada2026[] {
  const nomes = nomesMunicipio(payload)
  const porId = locaisPorId(payload)
  return secoes.map((s) => {
    const votos = indices.map((ci) => s.v[ci] ?? 0)
    return {
      key: `${s.m}|${s.z}|${s.s}`,
      municipioCodigo: s.m,
      municipioNome: nomes.get(s.m) ?? s.m,
      bairro: bairroDe(s.l != null ? porId.get(s.l) ?? null : null),
      zona: s.z,
      secao: s.s,
      votos,
      pares: votos.slice(1).map((v) => parSecao2026(votos[0] ?? 0, v)),
    }
  })
}

/** `NaN` quando o par não tem valor no modo (fica fora de qualquer faixa). */
export function valorFaixa2026(par: ParSecao2026, modo: ModoFaixa2026): number {
  if (modo === 'votos') return par.diferenca
  if (modo === 'pct') return par.margemPct
  return par.razaoPct ?? Number.NaN
}

/** Seções sem voto de nenhum dos dois ficam fora das faixas. */
export function parNaFaixa2026(par: ParSecao2026, f: FaixaDiferenca2026, modo: ModoFaixa2026): boolean {
  if (!par.total) return false
  const v = valorFaixa2026(par, modo)
  return v > f.acima && (f.ate == null || v <= f.ate)
}

export function secoesComparadasParaCsv2026(
  linhas: LinhaSecaoComparada2026[],
  candidatos: ResultadoSecao2026Candidato[],
): string {
  const geral = candidatos[0]?.nome ?? ''
  const parceiros = candidatos.slice(1)
  const pct = (v: number) => v.toFixed(2).replace('.', ',')
  const header = [
    'municipio',
    'bairro',
    'zona',
    'secao',
    ...candidatos.map((c) => `${c.nome} (${c.numero})`),
    ...parceiros.flatMap((c) => [
      `${geral} menos ${c.nome}`,
      `margem % ${geral} x ${c.nome}`,
      `${c.nome} em % de ${geral}`,
    ]),
  ]
  const rows = linhas.map((l) =>
    [
      l.municipioNome,
      l.bairro,
      l.zona,
      l.secao,
      ...l.votos,
      ...l.pares.flatMap((par) => [
        par.saldo,
        par.total ? pct(par.margemPct) : '',
        par.razaoPct == null ? '' : Number.isFinite(par.razaoPct) ? pct(par.razaoPct) : 'geral zerado',
      ]),
    ]
      .map(csvEsc)
      .join(';'),
  )
  return [header.map(csvEsc).join(';'), ...rows].join('\n')
}

export const formatarVotos2026 = (n: number): string => Math.round(n).toLocaleString('pt-BR')

export const formatarPct2026 = (n: number, casas = 2): string =>
  `${n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`

export function formatarRazao2026(r: number | null): string {
  if (r == null) return '—'
  return Number.isFinite(r) ? formatarPct2026(r, 0) : 'geral zerado'
}

export const formatarZona2026 = (z: number): string => String(z).padStart(4, '0')

export const formatarSecao2026 = (s: number): string => String(s).padStart(4, '0')
