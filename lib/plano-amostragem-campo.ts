import { distribuirInteiros } from '@/lib/plano-amostragem-publico'
import type {
  PlanoAmostragemAlocacaoBloco,
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

export type FichaCampoEntrevista = {
  id: string
  entrevistador: number
  sequencia: number
  municipio: string
  blocoId: string
  blocoSugerido: string
  tipoBloco: string
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

export type ValidacaoRoteiroCampo = {
  ok: boolean
  avisos: string[]
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

function pontoFromSetor(setor: SetorMapaPlano): PontoCampoBloco {
  const codigo = setor.cdSetor.slice(-4)
  const titulo = tituloSetor(setor)
  return {
    blocoId: setor.blocoId ?? '',
    blocoNome: setor.blocoNome ?? '',
    titulo,
    bairroRecorte: setor.urbano ? 'Urbano' : 'Rural',
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

/** Expande alocação da equipe em lista ordenada de blocos (uma entrada por ficha). */
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

function intercalarPontos(pontos: PontoCampoBloco[]): PontoCampoBloco[] {
  if (pontos.length <= 1) return pontos
  const porTitulo = new Map<string, PontoCampoBloco[]>()
  for (const p of pontos) {
    const lista = porTitulo.get(p.titulo) ?? []
    lista.push(p)
    porTitulo.set(p.titulo, lista)
  }
  const filas = [...porTitulo.values()].sort((a, b) => b.length - a.length)
  const resultado: PontoCampoBloco[] = []
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

  if (fichas.length !== plano.amostraTotal) {
    avisos.push(
      `Total de fichas (${fichas.length}) difere da amostra (${plano.amostraTotal}).`,
    )
  }

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

  if (fichasUrbanas !== metaUrbana) {
    avisos.push(`Urbano: meta ${metaUrbana}, fichas ${fichasUrbanas}.`)
  }
  if (fichasRurais !== metaRural) {
    avisos.push(`Rural: meta ${metaRural}, fichas ${fichasRurais}.`)
  }

  for (const bloco of plano.divisaoTerritorial) {
    const fichasBloco = fichas.filter((f) => f.blocoId === bloco.id).length
    if (fichasBloco !== bloco.entrevistas) {
      avisos.push(
        `Bloco "${bloco.nome}": meta ${bloco.entrevistas}, fichas ${fichasBloco}.`,
      )
    }
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

  return { ok: avisos.length === 0, avisos }
}

export function montarRoteiroCampo(
  plano: PlanoAmostragemPublico,
  ctx: ContextoRoteiroCampo = {},
): RoteiroCampoResumo {
  const fichas: FichaCampoEntrevista[] = []
  let globalSeq = 1
  const indicePontoPorBloco = new Map<string, number>()
  const pontosMapa = montarSequenciaPontosPorBloco(plano, ctx)

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
      fichas.push({
        id: `${plano.codigoIbge}-${String(membro.entrevistador).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
        entrevistador: membro.entrevistador,
        sequencia: globalSeq,
        municipio: plano.municipio,
        blocoId,
        blocoSugerido: blocoNome,
        tipoBloco: tipo,
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
