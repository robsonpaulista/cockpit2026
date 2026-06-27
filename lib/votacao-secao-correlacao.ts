import {
  HIERARQUIA_CARGOS_VOTO_CASADO,
  isVotavelLegendaBweb,
  ordemHierarquiaCargo,
} from '@/lib/votacao-secao'
import type { CandidatoMatrizColuna, LinhaMatrizSecao } from '@/lib/votacao-secao-matriz'

/** Margem na matriz e pílulas (semelhança por seção). */
export const MARGEM_VOTOS_PARECIDOS = 0.5

/** Margem mais restrita para sugestão de voto casado no modal (60%). */
export const MARGEM_VOTOS_CASADOS = 0.6

/** Mínimo de seções com votos casados para exibir no modal de mapeamento. */
export const PCT_MINIMO_VOTO_CASADO_MODAL = 50

export type NivelSemelhancaVotos = 'alta' | 'media' | 'baixa' | 'minima'

export type AnaliseComparacaoVotos = {
  candidatoA: CandidatoMatrizColuna
  candidatoB: CandidatoMatrizColuna
  margem: number
  secoesTotal: number
  secoesComAmbos: number
  secoesParecidas: number
  pctSecoesParecidas: number
  /** Soma dos votos do candidato A nas seções com semelhança. */
  votosASemelhantes: number
  /** Soma dos votos do candidato B nas seções com semelhança. */
  votosBSemelhantes: number
  /** % dos votos totais do candidato A concentrados nas seções semelhantes. */
  pctVotosASobreTotal: number
  /** % dos votos totais do candidato B concentrados nas seções semelhantes. */
  pctVotosBSobreTotal: number
  nivel: NivelSemelhancaVotos
  rotuloNivel: string
  resumo: string
}

/**
 * Dois candidatos têm votos parecidos na seção quando ambos receberam votos
 * e o maior não ultrapassa 50% a mais que o menor.
 * Ex.: 100 × 140 → parecido · 100 × 160 → distinto
 */
export function votosParecidosNaSecao(
  votosA: number,
  votosB: number,
  margem = MARGEM_VOTOS_PARECIDOS,
): boolean {
  if (votosA <= 0 || votosB <= 0) return false
  const menor = Math.min(votosA, votosB)
  const maior = Math.max(votosA, votosB)
  return maior <= menor * (1 + margem)
}

/** Par de candidatos com votos semelhantes na mesma seção. */
export type ParSemelhanteSecao = {
  idA: string
  idB: string
  nomeA: string
  nomeB: string
}

function primeiroNome(nome: string): string {
  return (nome.trim().split(/\s+/)[0] ?? nome).toUpperCase()
}

function chaveGrupoComparacao(c: CandidatoMatrizColuna): string {
  return c.anoEleicao != null ? `${c.anoEleicao}:${c.dsCargo}` : c.dsCargo
}

function rotuloParSemelhante(a: CandidatoMatrizColuna, b: CandidatoMatrizColuna): {
  nomeA: string
  nomeB: string
} {
  const sufixoA = a.anoEleicao != null ? ` (${String(a.anoEleicao).slice(-2)})` : ''
  const sufixoB = b.anoEleicao != null ? ` (${String(b.anoEleicao).slice(-2)})` : ''
  return {
    nomeA: `${primeiroNome(a.nmVotavel)}${sufixoA}`,
    nomeB: `${primeiroNome(b.nmVotavel)}${sufixoB}`,
  }
}

/** Lista pares de grupos (cargo ou cargo+ano) diferentes com votos parecidos na linha. */
export function paresSemelhantesNaLinha(
  votos: Record<string, number>,
  candidatos: CandidatoMatrizColuna[],
  margem = MARGEM_VOTOS_PARECIDOS,
): ParSemelhanteSecao[] {
  const pares: ParSemelhanteSecao[] = []
  const porGrupo = new Map<string, CandidatoMatrizColuna[]>()
  for (const c of candidatos) {
    const chave = chaveGrupoComparacao(c)
    const lista = porGrupo.get(chave) ?? []
    lista.push(c)
    porGrupo.set(chave, lista)
  }

  const grupos = [...porGrupo.keys()]
  if (grupos.length < 2) return pares

  for (let i = 0; i < grupos.length; i++) {
    for (let j = i + 1; j < grupos.length; j++) {
      const listaA = porGrupo.get(grupos[i]) ?? []
      const listaB = porGrupo.get(grupos[j]) ?? []
      for (const a of listaA) {
        for (const b of listaB) {
          if (votosParecidosNaSecao(votos[a.id] ?? 0, votos[b.id] ?? 0, margem)) {
            const rotulos = rotuloParSemelhante(a, b)
            pares.push({
              idA: a.id,
              idB: b.id,
              nomeA: rotulos.nomeA,
              nomeB: rotulos.nomeB,
            })
          }
        }
      }
    }
  }

  return pares
}

/** @deprecated use paresSemelhantesNaLinha().length > 0 */
export function linhaTemSemelhancaVotos(
  votos: Record<string, number>,
  candidatos: CandidatoMatrizColuna[],
  margem = MARGEM_VOTOS_PARECIDOS,
): boolean {
  return paresSemelhantesNaLinha(votos, candidatos, margem).length > 0
}

export function mapaParesSemelhantesPorSecao(
  linhas: LinhaMatrizSecao[],
  candidatos: CandidatoMatrizColuna[],
  margem = MARGEM_VOTOS_PARECIDOS,
  paresPermitidos?: ReadonlySet<string> | null,
): Map<string, ParSemelhanteSecao[]> {
  const mapa = new Map<string, ParSemelhanteSecao[]>()
  if (candidatos.length < 2) return mapa
  for (const linha of linhas) {
    let pares = paresSemelhantesNaLinha(linha.votos, candidatos, margem)
    if (paresPermitidos?.size) {
      pares = pares.filter((p) => paresPermitidos.has(chaveParSemelhante(p.idA, p.idB)))
    }
    mapa.set(linha.localId, pares)
  }
  return mapa
}

export function chaveParSemelhante(idA: string, idB: string): string {
  return [idA, idB].sort().join('::')
}

/** Pares únicos agregados de várias seções (ex.: linha de bairro). */
export function paresSemelhantesAgregados(
  secoes: LinhaMatrizSecao[],
  mapa: Map<string, ParSemelhanteSecao[]>,
): ParSemelhanteSecao[] {
  const vistos = new Map<string, ParSemelhanteSecao>()
  for (const secao of secoes) {
    for (const par of mapa.get(secao.localId) ?? []) {
      const chave = [par.idA, par.idB].sort().join('::')
      vistos.set(chave, par)
    }
  }
  return [...vistos.values()]
}

/** @deprecated use mapaParesSemelhantesPorSecao */
export function mapaSemelhancaPorSecao(
  linhas: LinhaMatrizSecao[],
  candidatos: CandidatoMatrizColuna[],
): Map<string, boolean> {
  const mapa = new Map<string, boolean>()
  const pares = mapaParesSemelhantesPorSecao(linhas, candidatos)
  for (const [id, lista] of pares) {
    mapa.set(id, lista.length > 0)
  }
  return mapa
}

export function contarSecoesSemelhantes(
  mapa: Map<string, ParSemelhanteSecao[] | boolean>,
): number {
  let n = 0
  for (const v of mapa.values()) {
    if (Array.isArray(v) ? v.length > 0 : v) n += 1
  }
  return n
}

export function classificarSemelhancaVotos(pct: number): {
  nivel: NivelSemelhancaVotos
  rotulo: string
} {
  if (pct >= 70) return { nivel: 'alta', rotulo: 'Alta semelhança' }
  if (pct >= 50) return { nivel: 'media', rotulo: 'Semelhança moderada' }
  if (pct >= 30) return { nivel: 'baixa', rotulo: 'Semelhança baixa' }
  return { nivel: 'minima', rotulo: 'Pouca semelhança' }
}

export function analisarComparacaoVotos(
  linhas: LinhaMatrizSecao[],
  candidatoA: CandidatoMatrizColuna,
  candidatoB: CandidatoMatrizColuna,
  margem = MARGEM_VOTOS_PARECIDOS,
): AnaliseComparacaoVotos {
  let secoesComAmbos = 0
  let secoesParecidas = 0
  let votosASemelhantes = 0
  let votosBSemelhantes = 0

  for (const linha of linhas) {
    const va = linha.votos[candidatoA.id] ?? 0
    const vb = linha.votos[candidatoB.id] ?? 0
    if (va <= 0 || vb <= 0) continue
    secoesComAmbos += 1
    if (votosParecidosNaSecao(va, vb, margem)) {
      secoesParecidas += 1
      votosASemelhantes += va
      votosBSemelhantes += vb
    }
  }

  const secoesTotal = linhas.length
  const pctSecoesParecidas = secoesTotal > 0 ? (secoesParecidas / secoesTotal) * 100 : 0
  const pctVotosASobreTotal =
    candidatoA.totalVotos > 0 ? (votosASemelhantes / candidatoA.totalVotos) * 100 : 0
  const pctVotosBSobreTotal =
    candidatoB.totalVotos > 0 ? (votosBSemelhantes / candidatoB.totalVotos) * 100 : 0
  const { nivel, rotulo } = classificarSemelhancaVotos(pctSecoesParecidas)
  const margemPct = Math.round(margem * 100)

  const resumo =
    secoesParecidas === 0
      ? `Nenhuma seção com semelhança de votos (margem de até ${margemPct}%).`
      : `${secoesParecidas} de ${secoesTotal} seções com votos semelhantes (até ${margemPct}% de diferença) — ${votosASemelhantes.toLocaleString('pt-BR')} votos (${primeiroNome(candidatoA.nmVotavel)}) e ${votosBSemelhantes.toLocaleString('pt-BR')} votos (${primeiroNome(candidatoB.nmVotavel)}) nessas urnas.`

  return {
    candidatoA,
    candidatoB,
    margem,
    secoesTotal,
    secoesComAmbos,
    secoesParecidas,
    pctSecoesParecidas,
    votosASemelhantes,
    votosBSemelhantes,
    pctVotosASobreTotal,
    pctVotosBSobreTotal,
    nivel,
    rotuloNivel: rotulo,
    resumo,
  }
}

export function analisesComparacaoEntreCargos(
  linhas: LinhaMatrizSecao[],
  candidatos: CandidatoMatrizColuna[],
  margem = MARGEM_VOTOS_PARECIDOS,
): AnaliseComparacaoVotos[] {
  const porGrupo = new Map<string, CandidatoMatrizColuna[]>()
  for (const c of candidatos) {
    const chave = chaveGrupoComparacao(c)
    const lista = porGrupo.get(chave) ?? []
    lista.push(c)
    porGrupo.set(chave, lista)
  }

  const grupos = [...porGrupo.keys()]
  if (grupos.length < 2) return []

  const analises: AnaliseComparacaoVotos[] = []

  for (let i = 0; i < grupos.length; i++) {
    for (let j = i + 1; j < grupos.length; j++) {
      const listaA = porGrupo.get(grupos[i]) ?? []
      const listaB = porGrupo.get(grupos[j]) ?? []
      for (const a of listaA) {
        for (const b of listaB) {
          analises.push(analisarComparacaoVotos(linhas, a, b, margem))
        }
      }
    }
  }

  return analises.sort((x, y) => y.pctSecoesParecidas - x.pctSecoesParecidas)
}

/** @deprecated use analisesComparacaoEntreCargos */
export const analisesVotoCasadoEntreCargos = analisesComparacaoEntreCargos

/** @deprecated use AnaliseComparacaoVotos */
export type AnaliseVotoCasado = AnaliseComparacaoVotos

export type ParVotoCasadoSugerido = AnaliseComparacaoVotos

export type EmparelhamentoVotoCasado = {
  candidatoOrigem: CandidatoMatrizColuna
  candidatoDestino: CandidatoMatrizColuna
  analise: AnaliseComparacaoVotos
}

export type GrupoVotoCasadoPorOrigem = {
  origem: CandidatoMatrizColuna
  vinculos: EmparelhamentoVotoCasado[]
}

/** Um degrau da hierarquia (ex.: Deputado Federal → Deputado Estadual). */
export type NivelHierarquiaVotoCasado = {
  cargoMaior: string
  cargoMenor: string
  gruposPorOrigem: GrupoVotoCasadoPorOrigem[]
}

export type MapeamentoVotoCasado = {
  margem: number
  margemPct: number
  emparelhamentos: EmparelhamentoVotoCasado[]
  /** Pares cargo maior → cargo imediatamente abaixo, agrupados por candidato de origem. */
  niveisHierarquia: NivelHierarquiaVotoCasado[]
}

function agruparEmparelhamentosPorOrigem(
  emparelhamentos: EmparelhamentoVotoCasado[],
): GrupoVotoCasadoPorOrigem[] {
  const mapa = new Map<string, EmparelhamentoVotoCasado[]>()

  for (const e of emparelhamentos) {
    const lista = mapa.get(e.candidatoOrigem.id) ?? []
    lista.push(e)
    mapa.set(e.candidatoOrigem.id, lista)
  }

  return [...mapa.values()]
    .map((vinculos) => ({
      origem: vinculos[0].candidatoOrigem,
      vinculos: [...vinculos].sort(
        (a, b) => b.analise.pctSecoesParecidas - a.analise.pctSecoesParecidas,
      ),
    }))
    .sort((a, b) => {
      const porCargo = ordemHierarquiaCargo(a.origem.dsCargo) - ordemHierarquiaCargo(b.origem.dsCargo)
      if (porCargo !== 0) return porCargo
      return b.origem.totalVotos - a.origem.totalVotos
    })
}

/**
 * Lista vínculos cargo maior → cargo menor (todos os destinos com ≥1 seção casada por origem).
 * `candidatosCargoMaior` deve estar acima de `candidatosCargoMenor` na hierarquia.
 */
export function emparelharVotosCasadosEntreCargos(
  linhas: LinhaMatrizSecao[],
  candidatosCargoMaior: CandidatoMatrizColuna[],
  candidatosCargoMenor: CandidatoMatrizColuna[],
  margem = MARGEM_VOTOS_CASADOS,
  pctMinimo = PCT_MINIMO_VOTO_CASADO_MODAL,
): EmparelhamentoVotoCasado[] {
  const emparelhamentos: EmparelhamentoVotoCasado[] = []
  const ordenadosOrigem = [...candidatosCargoMaior].sort((a, b) => b.totalVotos - a.totalVotos)

  for (const origem of ordenadosOrigem) {
    for (const destino of candidatosCargoMenor) {
      const analise = analisarComparacaoVotos(linhas, origem, destino, margem)
      if (analise.secoesParecidas === 0) continue
      if (analise.pctSecoesParecidas < pctMinimo) continue
      emparelhamentos.push({ candidatoOrigem: origem, candidatoDestino: destino, analise })
    }
  }

  return emparelhamentos
}

/**
 * Mapa automático de possível voto casado no município (um ano, por seção).
 * Percorre a hierarquia cargo a cargo (maior → imediatamente abaixo); em cada degrau,
 * lista por candidato de origem os destinos com ≥ pctMinimo de seções casadas.
 */
export function mapearVotosCasadosMunicipio(
  linhas: LinhaMatrizSecao[],
  candidatos: CandidatoMatrizColuna[],
  opcoes?: {
    margem?: number
    pctMinimoExibicao?: number
  },
): MapeamentoVotoCasado | null {
  const margem = opcoes?.margem ?? MARGEM_VOTOS_CASADOS
  const pctMinimoExibicao = opcoes?.pctMinimoExibicao ?? PCT_MINIMO_VOTO_CASADO_MODAL

  const candidatosElegiveis = candidatos.filter((c) => !isVotavelLegendaBweb(c.nrVotavel))

  const porCargo = new Map<string, CandidatoMatrizColuna[]>()
  for (const c of candidatosElegiveis) {
    const lista = porCargo.get(c.dsCargo) ?? []
    lista.push(c)
    porCargo.set(c.dsCargo, lista)
  }

  if (porCargo.size < 2 || linhas.length === 0) return null

  const niveisHierarquia: NivelHierarquiaVotoCasado[] = []
  const emparelhamentos: EmparelhamentoVotoCasado[] = []

  for (let h = 0; h < HIERARQUIA_CARGOS_VOTO_CASADO.length - 1; h++) {
    const cargoMaior = HIERARQUIA_CARGOS_VOTO_CASADO[h]
    const cargoMenor = HIERARQUIA_CARGOS_VOTO_CASADO[h + 1]
    const listaMaior = porCargo.get(cargoMaior)
    const listaMenor = porCargo.get(cargoMenor)
    if (!listaMaior?.length || !listaMenor?.length) continue

    const nivelEmparelhamentos = emparelharVotosCasadosEntreCargos(
      linhas,
      listaMaior,
      listaMenor,
      margem,
      pctMinimoExibicao,
    )
    if (nivelEmparelhamentos.length === 0) continue

    emparelhamentos.push(...nivelEmparelhamentos)
    niveisHierarquia.push({
      cargoMaior,
      cargoMenor,
      gruposPorOrigem: agruparEmparelhamentosPorOrigem(nivelEmparelhamentos),
    })
  }

  if (niveisHierarquia.length === 0) return null

  return {
    margem,
    margemPct: Math.round(margem * 100),
    emparelhamentos,
    niveisHierarquia,
  }
}

const BAIRRO_SEM_CADASTRO = 'Sem bairro cadastrado'

function chaveBairroDistribuicao(nmBairro: string | null | undefined): string {
  const nome = (nmBairro || BAIRRO_SEM_CADASTRO).trim()
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export type SecaoVinculoParecida = {
  nrZona: number
  nrSecao: number
  nrLocalVotacao: number | null
  nmLocalVotacao: string | null
  votosOrigem: number
  votosDestino: number
}

export type LocalVinculoParecido = {
  id: string
  rotulo: string
  secoes: SecaoVinculoParecida[]
}

export type BairroDistribuicaoVinculo = {
  id: string
  nmBairro: string
  secoesNoBairro: number
  secoesComAmbos: number
  secoesParecidas: number
  pctParecidasNoBairro: number
  locais: LocalVinculoParecido[]
}

/**
 * Seções em que o par teve votos proporcionais (margem), agrupadas por bairro e local.
 */
export function distribuicaoVinculoPorBairro(
  linhas: LinhaMatrizSecao[],
  origem: CandidatoMatrizColuna,
  destino: CandidatoMatrizColuna,
  margem = MARGEM_VOTOS_CASADOS,
): BairroDistribuicaoVinculo[] {
  const mapa = new Map<
    string,
    {
      nmBairro: string
      secoesNoBairro: number
      secoesComAmbos: number
      secoesParecidas: number
      locaisMap: Map<string, LocalVinculoParecido>
    }
  >()

  for (const linha of linhas) {
    const nmBairro = linha.nmBairro?.trim() || BAIRRO_SEM_CADASTRO
    const bid = chaveBairroDistribuicao(linha.nmBairro)
    const vo = linha.votos[origem.id] ?? 0
    const vd = linha.votos[destino.id] ?? 0

    let bloco = mapa.get(bid)
    if (!bloco) {
      bloco = {
        nmBairro,
        secoesNoBairro: 0,
        secoesComAmbos: 0,
        secoesParecidas: 0,
        locaisMap: new Map(),
      }
      mapa.set(bid, bloco)
    }
    bloco.secoesNoBairro++

    if (vo <= 0 || vd <= 0) continue
    bloco.secoesComAmbos++
    if (!votosParecidosNaSecao(vo, vd, margem)) continue

    bloco.secoesParecidas++
    const localKey = `${linha.nrZona}:${linha.nrLocalVotacao ?? 0}:${linha.nmLocalVotacao ?? ''}`
    let loc = bloco.locaisMap.get(localKey)
    if (!loc) {
      const rotulo =
        linha.nmLocalVotacao?.trim() ||
        (linha.nrLocalVotacao != null
          ? `Local ${linha.nrLocalVotacao}`
          : `Zona ${linha.nrZona}`)
      loc = { id: localKey, rotulo, secoes: [] }
      bloco.locaisMap.set(localKey, loc)
    }
    loc.secoes.push({
      nrZona: linha.nrZona,
      nrSecao: linha.nrSecao,
      nrLocalVotacao: linha.nrLocalVotacao,
      nmLocalVotacao: linha.nmLocalVotacao,
      votosOrigem: vo,
      votosDestino: vd,
    })
  }

  return [...mapa.values()]
    .filter((b) => b.secoesParecidas > 0)
    .map((b) => ({
      id: chaveBairroDistribuicao(b.nmBairro),
      nmBairro: b.nmBairro,
      secoesNoBairro: b.secoesNoBairro,
      secoesComAmbos: b.secoesComAmbos,
      secoesParecidas: b.secoesParecidas,
      pctParecidasNoBairro:
        b.secoesComAmbos > 0 ? (b.secoesParecidas / b.secoesComAmbos) * 100 : 0,
      locais: [...b.locaisMap.values()].sort((a, c) => c.secoes.length - a.secoes.length),
    }))
    .sort(
      (a, c) =>
        c.secoesParecidas - a.secoesParecidas ||
        a.nmBairro.localeCompare(c.nmBairro, 'pt-BR'),
    )
}
