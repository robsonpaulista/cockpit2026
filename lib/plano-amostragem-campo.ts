import type { LocalMapaPlano } from '@/lib/eleitorado-locais-pi'
import type { PlanoAmostragemPublico } from '@/lib/plano-amostragem-publico-types'
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
}

function parseBlocosEntrevistador(texto: string): string[] {
  if (!texto.trim()) return ['—']
  return texto
    .split(';')
    .map((part) => {
      const trimmed = part.trim()
      const match = trimmed.match(/^(.+?)\s*\(\d+\)\s*$/)
      return match ? match[1].trim() : trimmed
    })
    .filter((b) => b.length > 0)
}

function tipoBlocoPorNome(
  nome: string,
  blocos: PlanoAmostragemPublico['divisaoTerritorial'],
): string {
  const alvo = blocos.find((b) => b.nome.toLowerCase() === nome.toLowerCase())
  return alvo?.tipo ?? '—'
}

function blocoPorNome(
  nome: string,
  blocos: PlanoAmostragemPublico['divisaoTerritorial'],
) {
  return blocos.find((b) => b.nome.toLowerCase() === nome.toLowerCase()) ?? null
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

function pontoFromSetor(setor: SetorMapaPlano): PontoCampoBloco {
  const codigo = setor.cdSetor.slice(-4)
  return {
    blocoId: setor.blocoId ?? '',
    blocoNome: setor.blocoNome ?? '',
    titulo: setor.rotulo,
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

/** Monta lista de pontos de campo por bloco territorial (TSE, IBGE ou fallback). */
export function montarPontosCampoPorBloco(
  plano: PlanoAmostragemPublico,
  ctx: ContextoRoteiroCampo = {},
): Map<string, PontoCampoBloco[]> {
  const locais = ctx.locais ?? []
  const setores = ctx.setores ?? []
  const usarSetores = ctx.usarSetoresIbge ?? false
  const mapa = new Map<string, PontoCampoBloco[]>()

  for (const bloco of plano.divisaoTerritorial) {
    let pontos: PontoCampoBloco[] = []

    if (usarSetores && setores.length > 0) {
      pontos = setores
        .filter((s) => s.blocoId === bloco.id)
        .sort((a, b) => b.populacao - a.populacao)
        .map(pontoFromSetor)
    } else if (locais.length > 0) {
      pontos = deduplicarLocais(locais.filter((l) => l.blocoId === bloco.id))
        .sort((a, b) => b.eleitores - a.eleitores)
        .map(pontoFromLocal)
    }

    if (pontos.length === 0 && locais.length > 0 && !usarSetores) {
      const tipoRural = bloco.tipo === 'rural'
      pontos = deduplicarLocais(
        locais.filter((l) => (tipoRural ? l.zonaRural : !l.zonaRural)),
      )
        .sort((a, b) => b.eleitores - a.eleitores)
        .slice(0, 12)
        .map(pontoFromLocal)
    }

    if (pontos.length === 0 && setores.length > 0 && usarSetores) {
      const tipoRural = bloco.tipo === 'rural'
      pontos = setores
        .filter((s) => (tipoRural ? !s.urbano : s.urbano))
        .sort((a, b) => b.populacao - a.populacao)
        .slice(0, 8)
        .map(pontoFromSetor)
    }

    if (pontos.length === 0) {
      pontos = [pontoGenerico(bloco)]
    }

    mapa.set(bloco.id, pontos)
  }

  return mapa
}

function proximoPonto(
  blocoNome: string,
  blocos: PlanoAmostragemPublico['divisaoTerritorial'],
  pontosMapa: Map<string, PontoCampoBloco[]>,
  indicePorBloco: Map<string, number>,
): PontoCampoBloco {
  const bloco = blocoPorNome(blocoNome, blocos)
  const blocoId = bloco?.id ?? ''
  const pontos = pontosMapa.get(blocoId) ?? (bloco ? [pontoGenerico(bloco)] : [])
  const idx = indicePorBloco.get(blocoNome) ?? 0
  indicePorBloco.set(blocoNome, idx + 1)
  return pontos[idx % pontos.length]
}

export function montarRoteiroCampo(
  plano: PlanoAmostragemPublico,
  ctx: ContextoRoteiroCampo = {},
): RoteiroCampoResumo {
  const fichas: FichaCampoEntrevista[] = []
  let globalSeq = 1
  const indicePontoPorBloco = new Map<string, number>()
  const pontosMapa = montarPontosCampoPorBloco(plano, ctx)
  const pontosPorBloco = [...pontosMapa.values()].flat()

  const metaCotas = {
    sexo: plano.cotasSexo.map((c) => ({ perfil: c.perfil, meta: c.meta })),
    idade: plano.cotasIdade.map((c) => ({ perfil: c.perfil, meta: c.meta })),
    horario: plano.cotasHorario.map((c) => ({ perfil: c.perfil, meta: c.meta })),
  }

  for (const membro of plano.equipeCampo) {
    const blocos = parseBlocosEntrevistador(membro.blocosSugeridos)
    for (let i = 0; i < membro.entrevistas; i += 1) {
      const bloco = blocos[i % blocos.length] ?? blocos[0] ?? '—'
      const ponto = proximoPonto(bloco, plano.divisaoTerritorial, pontosMapa, indicePontoPorBloco)
      fichas.push({
        id: `${plano.codigoIbge}-${String(membro.entrevistador).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
        entrevistador: membro.entrevistador,
        sequencia: globalSeq,
        municipio: plano.municipio,
        blocoSugerido: bloco,
        tipoBloco: tipoBlocoPorNome(bloco, plano.divisaoTerritorial),
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
  }
}
