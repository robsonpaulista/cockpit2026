import { distribuirInteiros } from '@/lib/plano-amostragem-publico'
import type {
  PlanoAmostragemAlocacaoBloco,
  PlanoAmostragemCota,
  PlanoAmostragemEquipe,
  PlanoAmostragemPublico,
} from '@/lib/plano-amostragem-publico-types'
import type { LocalMapaPlano } from '@/lib/eleitorado-locais-pi'
import type { SetorMapaPlano } from '@/lib/setores-censitarios-pi'

export type ResultadoEntrevistaCampo =
  | ''
  | 'completa'
  | 'recusa'
  | 'ausente'
  | 'inelegivel'

export type TurnoRecomendado = 'Manhã' | 'Tarde' | 'Noite'

export type FichaCampoEntrevista = {
  id: string
  entrevistador: number
  /** Sequência global na amostra (1…N). */
  sequencia: number
  /** Sequência dentro do entrevistador (1…meta). */
  sequenciaEntrevistador: number
  municipio: string
  blocoId: string
  blocoSugerido: string
  tipoBloco: string
  /** Turno sugerido para cumprir cota de horário. */
  turnoRecomendado: TurnoRecomendado
  /** Onde ir no campo — local de votação, setor IBGE ou instrução genérica. */
  localCampo: string
  bairroRecorte: string | null
  enderecoSugerido: string | null
  latitudeSugerida: number | null
  longitudeSugerida: number | null
  instrucaoCampo: string
  metaCotas: {
    sexo: ReadonlyArray<{ perfil: string; meta: number }>
    idade: ReadonlyArray<{ perfil: string; meta: number }>
    horario: ReadonlyArray<{ perfil: string; meta: number }>
  }
}

export type PontoCampoBloco = {
  blocoId: string
  blocoNome: string
  titulo: string
  bairroRecorte: string | null
  endereco: string | null
  lat: number | null
  lng: number | null
  instrucao: string
  fonte: 'tse' | 'ibge' | 'generico'
}

export type MonitorCotaCampo = {
  categoria: 'Sexo' | 'Idade' | 'Horário'
  perfil: string
  meta: number
  pct: number
  realizado: number
  pendente: number
}

export type ChecklistMetodologicoItem = {
  id: string
  label: string
  status: 'ok' | 'warn' | 'error'
  detalhe?: string
}

export type ValidacaoRoteiroCampo = {
  ok: boolean
  avisos: string[]
  checklist: ChecklistMetodologicoItem[]
}

export type ContextoRoteiroCampo = {
  locais?: LocalMapaPlano[]
  setores?: SetorMapaPlano[]
  /** Opinião pública com setores IBGE → pontos por setor; eleitoral → locais TSE. */
  usarSetoresIbge?: boolean
}

export type RoteiroCampoResumo = {
  plano: PlanoAmostragemPublico
  fichas: FichaCampoEntrevista[]
  pontosPorBloco: PontoCampoBloco[]
  monitorCotas: MonitorCotaCampo[]
  totalEntrevistadores: number
  validacao: ValidacaoRoteiroCampo
}

function blocoPorId(
  blocoId: string,
  blocos: PlanoAmostragemPublico['divisaoTerritorial'],
) {
  return blocos.find((b) => b.id === blocoId) ?? null
}

function chaveLocalUnico(local: LocalMapaPlano): string {
  if (local.zonaRural) {
    const recorte = (local.recorteRural ?? local.bairro).toLowerCase()
    return `${local.blocoId ?? ''}|${recorte}|${Math.round(local.lat * 1e4)}|${Math.round(local.lng * 1e4)}`
  }
  return `${local.blocoId ?? ''}|${local.id}`
}

function deduplicarLocais(locais: LocalMapaPlano[]): LocalMapaPlano[] {
  const mapa = new Map<string, LocalMapaPlano>()
  for (const local of locais) {
    const chave = chaveLocalUnico(local)
    const prev = mapa.get(chave)
    if (!prev || local.eleitores > prev.eleitores) {
      mapa.set(chave, local)
    }
  }
  return [...mapa.values()]
}

function pontoFromLocal(local: LocalMapaPlano): PontoCampoBloco {
  const escola = local.nmLocal?.trim() || null
  const povoado = local.recorteRural
  const titulo = local.zonaRural && povoado ? povoado : escola || local.bairro

  const enderecoPartes = [
    povoado && escola ? escola : null,
    local.endereco,
    !povoado && local.bairro !== titulo ? local.bairro : null,
  ].filter(Boolean)

  const instrucaoRural = povoado
    ? escola
      ? `Deslocar até ${povoado}. Ponto de referência: "${escola}". Entrevistar no comércio, praça ou domicílios do povoado; validar rota com liderança local.`
      : `Deslocar até ${povoado}. Entrevistar no comércio, praça ou domicílios do povoado; validar rota com liderança local.`
    : escola
      ? `Zona rural TSE — referência "${escola}". Validar povoado/comunidade com liderança local antes do deslocamento.`
      : 'Zona rural sem recorte identificado no TSE — combinar povoado de referência com prefeitura ou liderança local.'

  return {
    blocoId: local.blocoId ?? '',
    blocoNome: local.blocoNome ?? '',
    titulo,
    bairroRecorte: povoado ?? local.bairro,
    endereco: enderecoPartes.join(' · ') || null,
    lat: local.lat,
    lng: local.lng,
    instrucao: local.zonaRural
      ? instrucaoRural
      : `Local de referência TSE 2024 — entrevistar nas imediações de "${titulo}" (praça, comércio ou residências do entorno).`,
    fonte: 'tse',
  }
}

function tituloSetor(setor: SetorMapaPlano): string {
  const codigo = setor.cdSetor.slice(-4)
  const nomeBase = setor.rotulo.trim()
  const jaTemCodigo =
    nomeBase.toLowerCase().endsWith(codigo.toLowerCase()) ||
    nomeBase.toLowerCase() === `setor ${codigo}`.toLowerCase()
  if (jaTemCodigo) return nomeBase
  return `${nomeBase} — Setor ${codigo}`
}

function nomeRecorteSetor(setor: SetorMapaPlano): string {
  return setor.rotulo.trim() || `Setor ${setor.cdSetor.slice(-4)}`
}

function pontoFromSetor(setor: SetorMapaPlano): PontoCampoBloco {
  const codigo = setor.cdSetor.slice(-4)
  const titulo = tituloSetor(setor)
  return {
    blocoId: setor.blocoId ?? '',
    blocoNome: setor.blocoNome ?? '',
    titulo,
    bairroRecorte: nomeRecorteSetor(setor),
    endereco: `Setor censitário IBGE ${codigo} · ${setor.populacao.toLocaleString('pt-BR')} hab.`,
    lat: setor.centroide?.lat ?? null,
    lng: setor.centroide?.lng ?? null,
    instrucao: setor.urbano
      ? `Setor censitário IBGE ${codigo} (${setor.rotulo}). Usar GPS como ponto de partida e sortear domicílios/comércio dentro do recorte.`
      : `Setor rural IBGE ${codigo} (${setor.rotulo}). Combinar rota com liderança local; entrevistas domiciliares ou em ponto de convivência do povoado.`,
    fonte: 'ibge',
  }
}

function pontoGenerico(
  bloco: PlanoAmostragemPublico['divisaoTerritorial'][number],
): PontoCampoBloco {
  const urbano = bloco.tipo === 'urbano'
  return {
    blocoId: bloco.id,
    blocoNome: bloco.nome,
    titulo: bloco.nome,
    bairroRecorte: urbano ? 'Centro urbano' : 'Zona rural',
    endereco: null,
    lat: null,
    lng: null,
    instrucao: bloco.notas
      ? `${bloco.notas} Validar ponto exato com equipe local e mapa antes do campo.`
      : urbano
        ? 'Bloco genérico urbano — definir esquina, praça ou comércio de referência no centro do recorte com supervisor local.'
        : 'Bloco genérico rural — combinar povoado/comunidade de referência com prefeitura ou liderança antes do deslocamento.',
    fonte: 'generico',
  }
}

/** Só divide setor entre entrevistadores quando o bloco tiver mais que este N. */
const LIMITE_DIVIDIR_BLOCO_ENTREVISTAS = 15

function rotuloTurno(perfil: string): TurnoRecomendado {
  if (perfil.startsWith('Manhã')) return 'Manhã'
  if (perfil.startsWith('Tarde')) return 'Tarde'
  return 'Noite'
}

function intercalarTurnos(filas: TurnoRecomendado[][]): TurnoRecomendado[] {
  const resultado: TurnoRecomendado[] = []
  let restam = true
  while (restam) {
    restam = false
    for (const fila of filas) {
      if (fila.length > 0) {
        resultado.push(fila.shift()!)
        restam = restam || fila.length > 0
      }
    }
  }
  return resultado
}

/** Máximo de entrevistas noturnas no rural (% do estrato). */
const NOITE_RURAL_MAX_PCT = 0.1
/** Teto de alerta para concentração noturna no urbano (% do estrato). */
const NOITE_URBANO_MAX_PCT = 0.4

function somaMetas(mapa: Map<TurnoRecomendado, number>): number {
  return [...mapa.values()].reduce((acc, v) => acc + v, 0)
}

function normalizarMetasStrato(
  mapa: Map<TurnoRecomendado, number>,
  total: number,
): void {
  let soma = somaMetas(mapa)
  const ordem: TurnoRecomendado[] = ['Tarde', 'Manhã', 'Noite']
  while (soma < total) {
    for (const turno of ordem) {
      if (soma >= total) break
      mapa.set(turno, (mapa.get(turno) ?? 0) + 1)
      soma += 1
    }
  }
  while (soma > total) {
    for (const turno of ordem) {
      if (soma <= total) break
      const atual = mapa.get(turno) ?? 0
      if (atual > 0) {
        mapa.set(turno, atual - 1)
        soma -= 1
      }
    }
  }
}

/**
 * Metas de turno por estrato: split proporcional à amostra (cada zona fica com ~35% noite),
 * com teto de noite no rural por segurança/logística.
 */
export function distribuirMetasTurnoPorZona(
  nUrban: number,
  nRural: number,
  cotasHorario: ReadonlyArray<PlanoAmostragemCota>,
): { urban: Map<TurnoRecomendado, number>; rural: Map<TurnoRecomendado, number> } {
  const urban = new Map<TurnoRecomendado, number>()
  const rural = new Map<TurnoRecomendado, number>()

  for (const c of cotasHorario) {
    const turno = rotuloTurno(c.perfil)
    const split = distribuirInteiros(
      [
        { id: 'u', peso: nUrban },
        { id: 'r', peso: nRural },
      ],
      c.meta,
    )
    urban.set(turno, split.get('u') ?? 0)
    rural.set(turno, split.get('r') ?? 0)
  }

  const noiteRuralMax = Math.floor(nRural * NOITE_RURAL_MAX_PCT)
  const noiteRuralProp = rural.get('Noite') ?? 0
  if (noiteRuralProp > noiteRuralMax) {
    const shift = noiteRuralProp - noiteRuralMax
    rural.set('Noite', noiteRuralMax)
    rural.set('Manhã', (rural.get('Manhã') ?? 0) + Math.floor(shift / 2))
    rural.set('Tarde', (rural.get('Tarde') ?? 0) + shift - Math.floor(shift / 2))
  }

  normalizarMetasStrato(urban, nUrban)
  normalizarMetasStrato(rural, nRural)

  return { urban, rural }
}

function alocarTurnosNoStrato(
  indices: number[],
  metas: Map<TurnoRecomendado, number>,
  turnos: TurnoRecomendado[],
  disponiveis: Set<number>,
): void {
  const filas: TurnoRecomendado[][] = []
  for (const turno of ['Manhã', 'Tarde', 'Noite'] as TurnoRecomendado[]) {
    const n = metas.get(turno) ?? 0
    if (n > 0) filas.push(Array.from({ length: n }, () => turno))
  }
  const sequencia = intercalarTurnos(filas)
  let idx = 0
  for (const i of indices) {
    if (!disponiveis.has(i)) continue
    turnos[i] = sequencia[idx] ?? 'Tarde'
    idx += 1
    disponiveis.delete(i)
  }
}

/** Distribui cotas de horário por estrato — proporcional por zona, com teto de noite no rural. */
export function atribuirTurnosPorZona(
  fichasPreview: ReadonlyArray<{ tipoBloco: string }>,
  cotasHorario: ReadonlyArray<PlanoAmostragemCota>,
): TurnoRecomendado[] {
  const n = fichasPreview.length
  const turnos: TurnoRecomendado[] = Array.from({ length: n }, () => 'Tarde')
  const disponiveis = new Set<number>(Array.from({ length: n }, (_, i) => i))

  const indicesUrbanos = fichasPreview
    .map((f, i) => (f.tipoBloco === 'urbano' ? i : -1))
    .filter((i) => i >= 0)
  const indicesRurais = fichasPreview
    .map((f, i) => (f.tipoBloco === 'rural' ? i : -1))
    .filter((i) => i >= 0)

  const metas = distribuirMetasTurnoPorZona(
    indicesUrbanos.length,
    indicesRurais.length,
    cotasHorario,
  )

  alocarTurnosNoStrato(indicesRurais, metas.rural, turnos, disponiveis)
  alocarTurnosNoStrato(indicesUrbanos, metas.urban, turnos, disponiveis)

  for (const i of disponiveis) {
    turnos[i] = 'Tarde'
  }

  return turnos
}

/** @deprecated use atribuirTurnosPorZona após montar fichas */
export function expandirTurnosRecomendados(
  cotasHorario: ReadonlyArray<PlanoAmostragemCota>,
): TurnoRecomendado[] {
  const filas: TurnoRecomendado[][] = cotasHorario.map((c) => {
    const turno = rotuloTurno(c.perfil)
    const fila: TurnoRecomendado[] = []
    for (let i = 0; i < c.meta; i += 1) fila.push(turno)
    return fila
  })
  return intercalarTurnos(filas)
}

export function expandirAlocacaoEquipe(
  membro: PlanoAmostragemEquipe,
  blocos: PlanoAmostragemPublico['divisaoTerritorial'],
): Array<{ blocoId: string; blocoNome: string; tipo: string }> {
  const alocacao: PlanoAmostragemAlocacaoBloco[] =
    membro.alocacao?.length > 0
      ? membro.alocacao
      : parseAlocacaoLegada(membro.blocosSugeridos, blocos)

  const expandido: Array<{ blocoId: string; blocoNome: string; tipo: string }> = []
  for (const item of alocacao) {
    const bloco =
      blocoPorId(item.blocoId, blocos) ??
      blocos.find((b) => b.nome.toLowerCase() === item.blocoNome.toLowerCase())
    const tipo = bloco?.tipo ?? '—'
    for (let i = 0; i < item.entrevistas; i += 1) {
      expandido.push({
        blocoId: item.blocoId || bloco?.id || '',
        blocoNome: item.blocoNome,
        tipo,
      })
    }
  }
  return expandido
}

function parseAlocacaoLegada(
  texto: string,
  blocos: PlanoAmostragemPublico['divisaoTerritorial'],
): PlanoAmostragemAlocacaoBloco[] {
  if (!texto.trim()) return []
  return texto
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.+?)\s*\((\d+)\)\s*$/)
      const blocoNome = match ? match[1].trim() : part
      const entrevistas = match ? Number.parseInt(match[2], 10) : 1
      const bloco = blocos.find((b) => b.nome.toLowerCase() === blocoNome.toLowerCase())
      return {
        blocoId: bloco?.id ?? '',
        blocoNome,
        entrevistas,
      }
    })
}

/** Agrupa fichas do mesmo local/setor em sequência (facilita concentrar em um entrevistador). */
function sequenciaAgrupadaPorLocal(pontos: PontoCampoBloco[]): PontoCampoBloco[] {
  const grupos = new Map<string, PontoCampoBloco[]>()
  for (const p of pontos) {
    const lista = grupos.get(p.titulo) ?? []
    lista.push(p)
    grupos.set(p.titulo, lista)
  }
  return [...grupos.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .flatMap(([, lista]) => lista)
}

function intercalarPontos(pontos: PontoCampoBloco[]): PontoCampoBloco[] {
  return sequenciaAgrupadaPorLocal(pontos)
}

/**
 * Monta sequência de pontos por bloco — uma entrada por ficha, proporcional à população/eleitorado.
 */
export function montarSequenciaPontosPorBloco(
  plano: PlanoAmostragemPublico,
  ctx: ContextoRoteiroCampo = {},
): Map<string, PontoCampoBloco[]> {
  const locais = ctx.locais ?? []
  const setores = ctx.setores ?? []
  const usarSetores = ctx.usarSetoresIbge ?? false
  const mapa = new Map<string, PontoCampoBloco[]>()

  for (const bloco of plano.divisaoTerritorial) {
    if (bloco.entrevistas <= 0) {
      mapa.set(bloco.id, [])
      continue
    }

    let pontosExpandidos: PontoCampoBloco[] = []

    if (usarSetores && setores.length > 0) {
      const setoresBloco = setores.filter(
        (s) =>
          (bloco.setorIds?.includes(s.cdSetor) ?? false) || s.blocoId === bloco.id,
      )
      if (setoresBloco.length > 0) {
        const mapaSector = distribuirInteiros(
          setoresBloco.map((s) => ({ id: s.cdSetor, peso: s.populacao })),
          bloco.entrevistas,
        )
        for (const s of setoresBloco) {
          const n = mapaSector.get(s.cdSetor) ?? 0
          const ponto = pontoFromSetor(s)
          for (let i = 0; i < n; i += 1) pontosExpandidos.push(ponto)
        }
        pontosExpandidos = intercalarPontos(pontosExpandidos)
      }
    } else if (locais.length > 0) {
      const locaisBloco = deduplicarLocais(
        locais.filter((l) => l.blocoId === bloco.id),
      ).sort((a, b) => b.eleitores - a.eleitores)

      if (locaisBloco.length > 0) {
        const mapaLocal = distribuirInteiros(
          locaisBloco.map((l) => ({ id: l.id, peso: l.eleitores })),
          bloco.entrevistas,
        )
        for (const l of locaisBloco) {
          const n = mapaLocal.get(l.id) ?? 0
          const ponto = pontoFromLocal(l)
          for (let i = 0; i < n; i += 1) pontosExpandidos.push(ponto)
        }
        pontosExpandidos = intercalarPontos(pontosExpandidos)
      }
    }

    if (pontosExpandidos.length === 0) {
      const fallback = locais.length > 0 && !usarSetores
        ? deduplicarLocais(
            locais.filter((l) =>
              bloco.tipo === 'rural' ? l.zonaRural : !l.zonaRural,
            ),
          )
            .sort((a, b) => b.eleitores - a.eleitores)
            .slice(0, 12)
            .map(pontoFromLocal)
        : usarSetores && setores.length > 0
          ? setores
              .filter((s) => (bloco.tipo === 'rural' ? !s.urbano : s.urbano))
              .sort((a, b) => b.populacao - a.populacao)
              .slice(0, 8)
              .map(pontoFromSetor)
          : []

      if (fallback.length > 0) {
        const mapaFallback = distribuirInteiros(
          fallback.map((p, i) => ({
            id: String(i),
            peso: usarSetores
              ? (setores.find((s) => tituloSetor(s) === p.titulo)?.populacao ?? 1)
              : (locais.find((l) => pontoFromLocal(l).titulo === p.titulo)?.eleitores ?? 1),
          })),
          bloco.entrevistas,
        )
        for (let i = 0; i < fallback.length; i += 1) {
          const n = mapaFallback.get(String(i)) ?? 0
          for (let j = 0; j < n; j += 1) pontosExpandidos.push(fallback[i])
        }
        pontosExpandidos = intercalarPontos(pontosExpandidos)
      }
    }

    while (pontosExpandidos.length < bloco.entrevistas) {
      pontosExpandidos.push(pontoGenerico(bloco))
    }
    if (pontosExpandidos.length > bloco.entrevistas) {
      pontosExpandidos = pontosExpandidos.slice(0, bloco.entrevistas)
    }

    mapa.set(bloco.id, pontosExpandidos)
  }

  return mapa
}

/** Lista única de pontos por bloco (para mapa/referência). */
export function montarPontosCampoPorBloco(
  plano: PlanoAmostragemPublico,
  ctx: ContextoRoteiroCampo = {},
): Map<string, PontoCampoBloco[]> {
  const sequencia = montarSequenciaPontosPorBloco(plano, ctx)
  const mapa = new Map<string, PontoCampoBloco[]>()
  for (const [blocoId, pontos] of sequencia) {
    const unicos = new Map<string, PontoCampoBloco>()
    for (const p of pontos) {
      unicos.set(`${p.titulo}|${p.lat ?? ''}|${p.lng ?? ''}`, p)
    }
    mapa.set(blocoId, [...unicos.values()])
  }
  return mapa
}

function proximoPontoPorBlocoId(
  blocoId: string,
  pontosMapa: Map<string, PontoCampoBloco[]>,
  indicePorBloco: Map<string, number>,
  blocoFallback: PlanoAmostragemPublico['divisaoTerritorial'][number] | null,
): PontoCampoBloco {
  const pontos = pontosMapa.get(blocoId) ?? []
  const idx = indicePorBloco.get(blocoId) ?? 0
  indicePorBloco.set(blocoId, idx + 1)
  if (pontos[idx]) return pontos[idx]
  if (blocoFallback) return pontoGenerico(blocoFallback)
  return {
    blocoId,
    blocoNome: '—',
    titulo: '—',
    bairroRecorte: null,
    endereco: null,
    lat: null,
    lng: null,
    instrucao: 'Validar ponto com supervisor local.',
    fonte: 'generico',
  }
}

export function montarGuiaPontosDasFichas(fichas: FichaCampoEntrevista[]): PontoCampoBloco[] {
  const mapa = new Map<string, PontoCampoBloco>()
  for (const f of fichas) {
    const chave = `${f.blocoId}|${f.localCampo}|${f.latitudeSugerida ?? ''}|${f.longitudeSugerida ?? ''}`
    if (mapa.has(chave)) continue
    mapa.set(chave, {
      blocoId: f.blocoId,
      blocoNome: f.blocoSugerido,
      titulo: f.localCampo,
      bairroRecorte: f.bairroRecorte,
      endereco: f.enderecoSugerido,
      lat: f.latitudeSugerida,
      lng: f.longitudeSugerida,
      instrucao: f.instrucaoCampo,
      fonte: f.latitudeSugerida != null ? 'ibge' : 'generico',
    })
  }
  return [...mapa.values()].sort((a, b) =>
    a.blocoNome.localeCompare(b.blocoNome, 'pt-BR') ||
    a.titulo.localeCompare(b.titulo, 'pt-BR'),
  )
}

export function validarRoteiroCampo(
  plano: PlanoAmostragemPublico,
  fichas: FichaCampoEntrevista[],
): ValidacaoRoteiroCampo {
  const avisos: string[] = []
  const checklist: ChecklistMetodologicoItem[] = []

  const metaUrbana =
    plano.amostraUrbana ??
    plano.divisaoTerritorial
      .filter((b) => b.tipo === 'urbano')
      .reduce((acc, b) => acc + b.entrevistas, 0)
  const metaRural =
    plano.amostraRural ??
    plano.divisaoTerritorial
      .filter((b) => b.tipo === 'rural')
      .reduce((acc, b) => acc + b.entrevistas, 0)

  const fichasUrbanas = fichas.filter((f) => f.tipoBloco === 'urbano').length
  const fichasRurais = fichas.filter((f) => f.tipoBloco === 'rural').length
  const totalOk = fichas.length === plano.amostraTotal

  checklist.push({
    id: 'total',
    label: 'Total de fichas',
    status: totalOk ? 'ok' : 'error',
    detalhe: `${fichas.length}/${plano.amostraTotal}`,
  })
  if (!totalOk) {
    avisos.push(
      `Total de fichas (${fichas.length}) difere da amostra (${plano.amostraTotal}).`,
    )
  }

  const urbanoOk = fichasUrbanas === metaUrbana
  const ruralOk = fichasRurais === metaRural
  checklist.push({
    id: 'urbano',
    label: 'Urbano',
    status: urbanoOk ? 'ok' : 'error',
    detalhe: `${fichasUrbanas}/${metaUrbana}`,
  })
  checklist.push({
    id: 'rural',
    label: 'Rural',
    status: ruralOk ? 'ok' : 'error',
    detalhe: `${fichasRurais}/${metaRural}`,
  })
  if (!urbanoOk) avisos.push(`Urbano: meta ${metaUrbana}, fichas ${fichasUrbanas}.`)
  if (!ruralOk) avisos.push(`Rural: meta ${metaRural}, fichas ${fichasRurais}.`)

  const metasEntrevistadores = plano.equipeCampo.map((e) => e.entrevistas)
  const minMeta = metasEntrevistadores.length > 0 ? Math.min(...metasEntrevistadores) : 0
  const maxMeta = metasEntrevistadores.length > 0 ? Math.max(...metasEntrevistadores) : 0
  const balanceado = maxMeta - minMeta <= 1
  checklist.push({
    id: 'equipe',
    label: 'Entrevistadores balanceados',
    status: balanceado ? 'ok' : 'warn',
    detalhe: balanceado ? `${minMeta}–${maxMeta} por pessoa` : `variação ${minMeta}–${maxMeta}`,
  })

  let blocosOk = true
  for (const bloco of plano.divisaoTerritorial) {
    const fichasBloco = fichas.filter((f) => f.blocoId === bloco.id).length
    if (fichasBloco !== bloco.entrevistas) {
      blocosOk = false
      avisos.push(
        `Bloco "${bloco.nome}": meta ${bloco.entrevistas}, fichas ${fichasBloco}.`,
      )
    }
  }
  checklist.push({
    id: 'blocos',
    label: 'Blocos territoriais',
    status: blocosOk ? 'ok' : 'error',
    detalhe: blocosOk ? 'metas conferem' : 'divergência em bloco(s)',
  })

  const agrupados = plano.divisaoTerritorial.filter(
    (b) => b.id.includes('outros') || (b.setorIds?.length ?? 0) > 1,
  )
  let agrupadosOk = true
  for (const bloco of agrupados) {
    const locais = fichas.filter((f) => f.blocoId === bloco.id).map((f) => f.localCampo)
    const contagem = new Map<string, number>()
    for (const local of locais) contagem.set(local, (contagem.get(local) ?? 0) + 1)
    const vals = [...contagem.values()]
    if (vals.length > 1) {
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      if (max > min * 3 && min <= 2) agrupadosOk = false
    }
  }
  checklist.push({
    id: 'agrupados',
    label: 'Setores agrupados proporcionais',
    status: agrupadosOk ? 'ok' : 'warn',
    detalhe: agrupadosOk ? 'distribuição ponderada' : 'revisar pesos em rota agrupada',
  })

  checklist.push({
    id: 'guia',
    label: 'Guia de pontos compatível com fichas',
    status: 'ok',
    detalhe: 'gerado a partir das fichas finais',
  })

  const turnosMeta = new Map<TurnoRecomendado, number>()
  for (const c of plano.cotasHorario) turnosMeta.set(rotuloTurno(c.perfil), c.meta)
  const turnosFichas = new Map<TurnoRecomendado, number>()
  for (const f of fichas) {
    turnosFichas.set(f.turnoRecomendado, (turnosFichas.get(f.turnoRecomendado) ?? 0) + 1)
  }
  const turnosOk = (['Manhã', 'Tarde', 'Noite'] as TurnoRecomendado[]).every(
    (t) => (turnosFichas.get(t) ?? 0) === (turnosMeta.get(t) ?? 0),
  )
  const metaNoiteGlobal = turnosMeta.get('Noite') ?? 0
  const noiteRealizada = turnosFichas.get('Noite') ?? 0
  const noiteAbaixoPorTetoRural =
    !turnosOk && metaNoiteGlobal > 0 && noiteRealizada < metaNoiteGlobal
  checklist.push({
    id: 'turnos',
    label: 'Cotas de horário distribuídas por ficha',
    status: turnosOk ? 'ok' : noiteAbaixoPorTetoRural ? 'warn' : 'warn',
    detalhe: turnosOk
      ? 'Manhã/Tarde/Noite fecham com meta'
      : noiteAbaixoPorTetoRural
        ? `Noite ${noiteRealizada}/${metaNoiteGlobal} — excesso realocado para manhã/tarde (teto rural ${Math.round(NOITE_RURAL_MAX_PCT * 100)}%)`
        : `Manhã ${turnosFichas.get('Manhã') ?? 0}/${turnosMeta.get('Manhã') ?? 0} · Tarde ${turnosFichas.get('Tarde') ?? 0}/${turnosMeta.get('Tarde') ?? 0} · Noite ${noiteRealizada}/${metaNoiteGlobal}`,
  })
  if (!turnosOk) {
    avisos.push(
      noiteAbaixoPorTetoRural
        ? `Cota global de noite (${metaNoiteGlobal}) reduzida para ${noiteRealizada} pelo teto de segurança no rural — priorizar manhã/tarde no interior.`
        : 'Cotas de horário não fecham com turno recomendado nas fichas.',
    )
  }

  const localPorEntrevistador = new Map<string, Set<number>>()
  for (const f of fichas) {
    const chave = f.localCampo
    const set = localPorEntrevistador.get(chave) ?? new Set<number>()
    set.add(f.entrevistador)
    localPorEntrevistador.set(chave, set)
  }
  const setoresDivididos = [...localPorEntrevistador.entries()].filter(
    ([, ents]) => ents.size > 1,
  )
  const setoresPequenosDivididos = setoresDivididos.filter(([local]) => {
    const totalLocal = fichas.filter((f) => f.localCampo === local).length
    return totalLocal <= LIMITE_DIVIDIR_BLOCO_ENTREVISTAS
  })
  const qtdDivididos = setoresDivididos.length
  const qtdPequenos = setoresPequenosDivididos.length
  let statusSetores: ChecklistMetodologicoItem['status'] = 'ok'
  let detalheSetores = 'nenhum setor dividido entre entrevistadores'
  if (qtdPequenos > 0) {
    statusSetores = 'warn'
    detalheSetores = `OK com ressalva — ${qtdPequenos} setor(es) pequeno(s) divididos por balanceamento`
  } else if (qtdDivididos > 0) {
    statusSetores = 'warn'
    detalheSetores = `OK com ressalva — ${qtdDivididos} setor(es) em blocos grandes divididos entre entrevistadores`
  }
  checklist.push({
    id: 'setores-divididos',
    label: 'Setores divididos entre entrevistadores',
    status: statusSetores,
    detalhe: detalheSetores,
  })
  if (qtdPequenos > 0) {
    avisos.push(
      `${qtdPequenos} setor(es) com até ${LIMITE_DIVIDIR_BLOCO_ENTREVISTAS} entrevistas aparecem em mais de um entrevistador.`,
    )
  } else if (qtdDivididos > 0) {
    avisos.push(
      `${qtdDivididos} setor(es) divididos entre entrevistadores (blocos grandes) — revisar logística.`,
    )
  }

  const noiteUrbano = fichas.filter(
    (f) => f.tipoBloco === 'urbano' && f.turnoRecomendado === 'Noite',
  ).length
  const noiteRural = fichas.filter(
    (f) => f.tipoBloco === 'rural' && f.turnoRecomendado === 'Noite',
  ).length
  const nUrban = fichas.filter((f) => f.tipoBloco === 'urbano').length
  const nRural = fichas.filter((f) => f.tipoBloco === 'rural').length
  const pctNoiteUrbano = nUrban > 0 ? Math.round((noiteUrbano / nUrban) * 1000) / 10 : 0
  const pctNoiteRural = nRural > 0 ? Math.round((noiteRural / nRural) * 1000) / 10 : 0
  const ruralNoiteAlto = nRural > 0 && pctNoiteRural > NOITE_RURAL_MAX_PCT * 100 + 2
  const urbanNoiteAlto = nUrban > 0 && pctNoiteUrbano > NOITE_URBANO_MAX_PCT * 100 + 2
  const balanceamentoHorarioOk = !ruralNoiteAlto && !urbanNoiteAlto
  checklist.push({
    id: 'noite-rural',
    label: 'Balanceamento de horário por zona',
    status: balanceamentoHorarioOk ? 'ok' : 'warn',
    detalhe: balanceamentoHorarioOk
      ? `Urbano: ${pctNoiteUrbano}% noite · Rural: ${pctNoiteRural}% noite`
      : `Urbano ${pctNoiteUrbano}% noite (${noiteUrbano}/${nUrban}) · Rural ${pctNoiteRural}% noite (${noiteRural}/${nRural})`,
  })
  if (ruralNoiteAlto) {
    avisos.push(
      `Noite rural acima do teto (${pctNoiteRural}%) — priorizar manhã/tarde no campo.`,
    )
  }
  if (urbanNoiteAlto) {
    avisos.push(
      `Noite urbana concentrada (${pctNoiteUrbano}%) — reforçar turnos de manhã/tarde na sede.`,
    )
  }

  for (const membro of plano.equipeCampo) {
    const fichasMembro = fichas.filter((f) => f.entrevistador === membro.entrevistador)
    if (fichasMembro.length !== membro.entrevistas) {
      avisos.push(
        `Entrevistador ${membro.entrevistador}: meta ${membro.entrevistas}, fichas ${fichasMembro.length}.`,
      )
      continue
    }
    for (const aloc of membro.alocacao ?? []) {
      const fichasAloc = fichasMembro.filter((f) => f.blocoId === aloc.blocoId).length
      if (fichasAloc !== aloc.entrevistas) {
        avisos.push(
          `Entrevistador ${membro.entrevistador} · ${aloc.blocoNome}: roteiro ${aloc.entrevistas}, fichas ${fichasAloc}.`,
        )
      }
    }
  }

  const erros = checklist.filter((c) => c.status === 'error').length
  return {
    ok: erros === 0,
    avisos,
    checklist,
  }
}

export function montarRoteiroCampo(
  plano: PlanoAmostragemPublico,
  ctx: ContextoRoteiroCampo = {},
): RoteiroCampoResumo {
  const fichas: FichaCampoEntrevista[] = []
  let globalSeq = 1
  const indicePontoPorBloco = new Map<string, number>()
  const pontosMapa = montarSequenciaPontosPorBloco(plano, ctx)
  const fichasParaTurno: Array<{ tipoBloco: string }> = []

  const metaCotas = {
    sexo: plano.cotasSexo.map((c) => ({ perfil: c.perfil, meta: c.meta })),
    idade: plano.cotasIdade.map((c) => ({ perfil: c.perfil, meta: c.meta })),
    horario: plano.cotasHorario.map((c) => ({ perfil: c.perfil, meta: c.meta })),
  }

  for (const membro of plano.equipeCampo) {
    const alocacoes = expandirAlocacaoEquipe(membro, plano.divisaoTerritorial)
    for (let i = 0; i < alocacoes.length; i += 1) {
      const { blocoId, blocoNome, tipo } = alocacoes[i]
      const bloco = blocoPorId(blocoId, plano.divisaoTerritorial)
      const ponto = proximoPontoPorBlocoId(
        blocoId,
        pontosMapa,
        indicePontoPorBloco,
        bloco,
      )
      fichasParaTurno.push({ tipoBloco: tipo })
      fichas.push({
        id: `${plano.codigoIbge}-${String(membro.entrevistador).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
        entrevistador: membro.entrevistador,
        sequencia: globalSeq,
        sequenciaEntrevistador: i + 1,
        municipio: plano.municipio,
        blocoId,
        blocoSugerido: blocoNome,
        tipoBloco: tipo,
        turnoRecomendado: 'Tarde',
        localCampo: ponto.titulo,
        bairroRecorte: ponto.bairroRecorte,
        enderecoSugerido: ponto.endereco,
        latitudeSugerida: ponto.lat,
        longitudeSugerida: ponto.lng,
        instrucaoCampo: ponto.instrucao,
        metaCotas,
      })
      globalSeq += 1
    }
  }

  const turnos = atribuirTurnosPorZona(fichasParaTurno, plano.cotasHorario)
  for (let i = 0; i < fichas.length; i += 1) {
    fichas[i] = { ...fichas[i], turnoRecomendado: turnos[i] ?? 'Tarde' }
  }

  const pontosPorBloco = montarGuiaPontosDasFichas(fichas)
  const validacao = validarRoteiroCampo(plano, fichas)

  const monitorCotas: MonitorCotaCampo[] = [
    ...plano.cotasSexo.map((c) => ({
      categoria: 'Sexo' as const,
      perfil: c.perfil,
      meta: c.meta,
      pct: c.pct,
      realizado: 0,
      pendente: c.meta,
    })),
    ...plano.cotasIdade.map((c) => ({
      categoria: 'Idade' as const,
      perfil: c.perfil,
      meta: c.meta,
      pct: c.pct,
      realizado: 0,
      pendente: c.meta,
    })),
    ...plano.cotasHorario.map((c) => ({
      categoria: 'Horário' as const,
      perfil: c.perfil,
      meta: c.meta,
      pct: c.pct,
      realizado: 0,
      pendente: c.meta,
    })),
  ]

  return {
    plano,
    fichas,
    pontosPorBloco,
    monitorCotas,
    totalEntrevistadores: plano.equipeCampo.length,
    validacao,
  }
}
