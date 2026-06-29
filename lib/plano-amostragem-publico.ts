import demografiaData from '@/data/demografia-municipios-piaui.json'
import { getEleitoradoByCity } from '@/lib/eleitores'
import { getTerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import type {
  PlanoAmostragemBloco,
  PlanoAmostragemCota,
  PlanoAmostragemEquipe,
  PlanoAmostragemPublico,
  TipoPesquisaPublico,
} from '@/lib/plano-amostragem-publico-types'

type DemografiaMunicipio = (typeof demografiaData)[number]

export type BairroReferencia = {
  nome: string
  secoes: number
  eleitores: number
  zonaRural?: boolean
}

export type SetorReferencia = {
  cdSetor: string
  nome: string
  populacao: number
  urbano: boolean
}

export type GerarPlanoAmostragemInput = {
  municipio: string
  amostraTotal: number
  tipoPesquisa: TipoPesquisaPublico
  institutoDestino?: string | null
  bairros?: BairroReferencia[]
  setores?: SetorReferencia[]
  /** Quando disponível, substitui split IBGE urbano/rural. */
  eleitoradoUrbanoTse?: number
  eleitoradoRuralTse?: number
  /** População urbana/rural por setor IBGE (prioridade sobre TSE/IBGE municipal). */
  populacaoUrbanaSetor?: number
  populacaoRuralSetor?: number
  pesoPorEleitores?: boolean
  /** Blocos e split por setor IBGE (somente opinião pública). */
  modoSetoresIbge?: boolean
  /** Define qual base numérica manda no plano territorial. */
  pesoTerritorial?: 'populacao_ibge' | 'eleitorado_tse'
  /** Quantidade de entrevistadores de campo (default: sugerido ~75 entrevistas/pessoa). */
  entrevistadores?: number
}

/** Distribui inteiros pelo método de maiores restos (Hamilton). */
export function distribuirInteiros(
  proporcoes: ReadonlyArray<{ id: string; peso: number }>,
  total: number,
): Map<string, number> {
  const resultado = new Map<string, number>()
  if (total <= 0 || proporcoes.length === 0) return resultado

  const somaPesos = proporcoes.reduce((acc, item) => acc + Math.max(0, item.peso), 0)
  if (somaPesos <= 0) return resultado

  const partes = proporcoes.map((item) => {
    const bruto = (Math.max(0, item.peso) / somaPesos) * total
    const base = Math.floor(bruto)
    return { id: item.id, base, resto: bruto - base }
  })

  for (const parte of partes) {
    resultado.set(parte.id, parte.base)
  }

  let faltam = total - partes.reduce((acc, parte) => acc + parte.base, 0)
  const ordenados = [...partes].sort((a, b) => b.resto - a.resto)
  let idx = 0
  while (faltam > 0 && ordenados.length > 0) {
    const alvo = ordenados[idx % ordenados.length]
    resultado.set(alvo.id, (resultado.get(alvo.id) ?? 0) + 1)
    faltam -= 1
    idx += 1
  }

  return resultado
}

function encontrarDemografia(municipio: string): DemografiaMunicipio | null {
  const alvo = normalizeMunicipioNome(municipio)
  return (
    demografiaData.find((item) => normalizeMunicipioNome(item.municipio) === alvo) ?? null
  )
}

function pct(numerador: number, denominador: number): number {
  if (denominador <= 0) return 0
  return Math.round((numerador / denominador) * 1000) / 10
}

/** Subdivisão da faixa 15–59 em faixas de entrevista (proporções médias NE — ver aviso no plano). */
const SUBFAIXAS_15_59: ReadonlyArray<{ id: string; perfil: string; peso: number }> = [
  { id: '16-24', perfil: '16 a 24 anos', peso: 0.28 },
  { id: '25-34', perfil: '25 a 34 anos', peso: 0.26 },
  { id: '35-44', perfil: '35 a 44 anos', peso: 0.22 },
  { id: '45-59', perfil: '45 a 59 anos', peso: 0.24 },
]

function montarCotasIdade(demo: DemografiaMunicipio, total: number): PlanoAmostragemCota[] {
  const pop = demo.populacao_censo_2022
  const faixa15_59 = demo.faixas_etarias.de_15_a_59
  const faixa60 = demo.faixas_etarias.de_60_ou_mais

  const pesos = [
    ...SUBFAIXAS_15_59.map((sub) => ({
      id: sub.id,
      perfil: sub.perfil,
      peso: faixa15_59 * sub.peso,
    })),
    { id: '60+', perfil: '60 anos ou mais', peso: faixa60 },
  ]

  const mapa = distribuirInteiros(
    pesos.map((p) => ({ id: p.id, peso: p.peso })),
    total,
  )

  return pesos.map((p) => ({
    perfil: p.perfil,
    meta: mapa.get(p.id) ?? 0,
    pct: pct(mapa.get(p.id) ?? 0, total),
  }))
}

function montarCotasSexo(demo: DemografiaMunicipio, total: number): PlanoAmostragemCota[] {
  const pesos = [
    { id: 'F', perfil: 'Mulher', peso: demo.sexo.feminino },
    { id: 'M', perfil: 'Homem', peso: demo.sexo.masculino },
  ]
  const mapa = distribuirInteiros(pesos, total)
  return pesos.map((p) => ({
    perfil: p.perfil,
    meta: mapa.get(p.id) ?? 0,
    pct: pct(mapa.get(p.id) ?? 0, total),
  }))
}

function montarCotasHorario(total: number): PlanoAmostragemCota[] {
  const faixas = [
    { id: 'manha', perfil: 'Manhã (8h–12h)', peso: 40 },
    { id: 'tarde', perfil: 'Tarde (13h–17h)', peso: 35 },
    { id: 'noite', perfil: 'Noite (18h–21h)', peso: 25 },
  ]
  const mapa = distribuirInteiros(
    faixas.map((f) => ({ id: f.id, peso: f.peso })),
    total,
  )
  return faixas.map((f) => ({
    perfil: f.perfil,
    meta: mapa.get(f.id) ?? 0,
    pct: pct(mapa.get(f.id) ?? 0, total),
  }))
}

function blocosUrbanosGenericos(): ReadonlyArray<{ id: string; nome: string; peso: number }> {
  return [
    { id: 'urb-centro', nome: 'Centro / comércio', peso: 30 },
    { id: 'urb-res-n', nome: 'Residencial Norte', peso: 25 },
    { id: 'urb-res-s', nome: 'Residencial Sul / Leste', peso: 25 },
    { id: 'urb-periferia', nome: 'Periferia / expansão urbana', peso: 20 },
  ]
}

function pesoBairro(b: BairroReferencia, porEleitores: boolean): number {
  if (porEleitores && b.eleitores > 0) return b.eleitores
  return b.secoes > 0 ? b.secoes : 0
}

function montarBlocosUrbanos(
  bairros: BairroReferencia[],
  entrevistasUrbanas: number,
  pesoPorEleitores: boolean,
): PlanoAmostragemBloco[] {
  const validos = bairros.filter(
    (b) => b.nome.trim().length > 0 && !b.zonaRural && pesoBairro(b, pesoPorEleitores) > 0,
  )
  if (validos.length === 0) {
    const genericos = blocosUrbanosGenericos()
    const mapa = distribuirInteiros(
      genericos.map((g) => ({ id: g.id, peso: g.peso })),
      entrevistasUrbanas,
    )
    return genericos.map((g) => ({
      id: g.id,
      nome: g.nome,
      pesoPct: pct(mapa.get(g.id) ?? 0, entrevistasUrbanas),
      entrevistas: mapa.get(g.id) ?? 0,
      tipo: 'urbano' as const,
      notas: 'Bloco genérico — validar no campo com mapa local e TRE.',
    }))
  }

  const ordenados = [...validos].sort(
    (a, b) => pesoBairro(b, pesoPorEleitores) - pesoBairro(a, pesoPorEleitores),
  )
  const top = ordenados.slice(0, Math.min(6, ordenados.length))
  const resto = ordenados.slice(top.length)
  const rotuloPeso = pesoPorEleitores ? 'eleitores' : 'seções'
  const blocos: Array<{ id: string; nome: string; peso: number; notas?: string }> = top.map(
    (b, i) => ({
      id: `bairro-${i}`,
      nome: b.nome,
      peso: pesoBairro(b, pesoPorEleitores),
      notas: pesoPorEleitores
        ? `${b.eleitores.toLocaleString('pt-BR')} eleitores · ${b.secoes} seção(ões) TSE 2024.`
        : `${b.secoes} seção(ões) eleitoral(is) de referência (TSE 2024).`,
    }),
  )

  if (resto.length > 0) {
    blocos.push({
      id: 'bairro-outros',
      nome: 'Demais bairros (agrupados)',
      peso: resto.reduce((acc, b) => acc + pesoBairro(b, pesoPorEleitores), 0),
      notas: `${resto.length} bairro(s) agrupados por baixa densidade de ${rotuloPeso}.`,
    })
  }

  const mapa = distribuirInteiros(
    blocos.map((b) => ({ id: b.id, peso: b.peso })),
    entrevistasUrbanas,
  )

  return blocos.map((b) => ({
    id: b.id,
    nome: b.nome,
    pesoPct: pct(mapa.get(b.id) ?? 0, entrevistasUrbanas),
    entrevistas: mapa.get(b.id) ?? 0,
    tipo: 'urbano' as const,
    notas: b.notas,
  }))
}

function montarBlocosUrbanosSetores(
  setores: SetorReferencia[],
  entrevistasUrbanas: number,
): PlanoAmostragemBloco[] {
  const validos = setores.filter((s) => s.urbano && s.populacao > 0)
  if (validos.length === 0) {
    return montarBlocosUrbanos([], entrevistasUrbanas, true)
  }

  const ordenados = [...validos].sort((a, b) => b.populacao - a.populacao)
  const top = ordenados.slice(0, Math.min(6, ordenados.length))
  const resto = ordenados.slice(top.length)

  const blocos: Array<{ id: string; nome: string; peso: number; notas?: string }> = top.map(
    (s, i) => ({
      id: `setor-${i}`,
      nome: s.nome,
      peso: s.populacao,
      notas: `${s.populacao.toLocaleString('pt-BR')} hab. · setor ${s.cdSetor.slice(-4)} (IBGE 2022).`,
    }),
  )

  if (resto.length > 0) {
    blocos.push({
      id: 'setor-outros',
      nome: 'Demais setores urbanos (agrupados)',
      peso: resto.reduce((acc, s) => acc + s.populacao, 0),
      notas: `${resto.length} setor(es) IBGE agrupados por baixa população.`,
    })
  }

  const mapa = distribuirInteiros(
    blocos.map((b) => ({ id: b.id, peso: b.peso })),
    entrevistasUrbanas,
  )

  return blocos.map((b) => ({
    id: b.id,
    nome: b.nome,
    pesoPct: pct(mapa.get(b.id) ?? 0, entrevistasUrbanas),
    entrevistas: mapa.get(b.id) ?? 0,
    tipo: 'urbano' as const,
    notas: b.notas,
  }))
}

function montarBlocosRuraisSetores(
  setores: SetorReferencia[],
  entrevistasRurais: number,
): PlanoAmostragemBloco[] {
  const rurais = setores.filter((s) => !s.urbano && s.populacao > 0)
  if (rurais.length === 0) {
    return montarBlocosRurais(entrevistasRurais)
  }

  const ordenados = [...rurais].sort((a, b) => b.populacao - a.populacao)
  const top = ordenados.slice(0, Math.min(4, ordenados.length))
  const resto = ordenados.slice(top.length)

  const blocos: Array<{ id: string; nome: string; peso: number; notas?: string }> = top.map(
    (s, i) => ({
      id: `rur-setor-${i}`,
      nome: s.nome,
      peso: s.populacao,
      notas: `${s.populacao.toLocaleString('pt-BR')} hab. · setor rural IBGE.`,
    }),
  )

  if (resto.length > 0) {
    blocos.push({
      id: 'rur-setor-outros',
      nome: 'Demais setores rurais (agrupados)',
      peso: resto.reduce((acc, s) => acc + s.populacao, 0),
      notas: `${resto.length} setor(es) rurais IBGE agrupados.`,
    })
  }

  const mapa = distribuirInteiros(
    blocos.map((b) => ({ id: b.id, peso: b.peso })),
    entrevistasRurais,
  )

  return blocos.map((b) => ({
    id: b.id,
    nome: b.nome,
    pesoPct: pct(mapa.get(b.id) ?? 0, entrevistasRurais),
    entrevistas: mapa.get(b.id) ?? 0,
    tipo: 'rural' as const,
    notas: b.notas,
  }))
}

function montarBlocosRuraisTse(
  bairros: BairroReferencia[],
  entrevistasRurais: number,
): PlanoAmostragemBloco[] {
  const validos = bairros.filter((b) => b.zonaRural && b.eleitores > 0)
  if (validos.length === 0) {
    return montarBlocosRurais(entrevistasRurais)
  }

  const ordenados = [...validos].sort((a, b) => b.eleitores - a.eleitores)
  const top = ordenados.slice(0, Math.min(4, ordenados.length))
  const resto = ordenados.slice(top.length)

  const blocos: Array<{ id: string; nome: string; peso: number; notas?: string }> = top.map(
    (b, i) => ({
      id: `rur-bairro-${i}`,
      nome: b.nome,
      peso: b.eleitores,
      notas: `${b.eleitores.toLocaleString('pt-BR')} eleitores · ${b.secoes} seção(ões) TSE 2024.`,
    }),
  )

  if (resto.length > 0) {
    blocos.push({
      id: 'rur-bairro-outros',
      nome: 'Demais recortes rurais (agrupados)',
      peso: resto.reduce((acc, b) => acc + b.eleitores, 0),
      notas: `${resto.length} recorte(s) rurais TSE agrupados.`,
    })
  }

  const mapa = distribuirInteiros(
    blocos.map((b) => ({ id: b.id, peso: b.peso })),
    entrevistasRurais,
  )

  return blocos.map((b) => ({
    id: b.id,
    nome: b.nome,
    pesoPct: pct(mapa.get(b.id) ?? 0, entrevistasRurais),
    entrevistas: mapa.get(b.id) ?? 0,
    tipo: 'rural' as const,
    notas: b.notas,
  }))
}

function montarBlocosRurais(entrevistasRurais: number): PlanoAmostragemBloco[] {
  const blocos = [
    {
      id: 'rur-proxima',
      nome: 'Rural próximo (até ~15 km do centro)',
      peso: 35,
      notas: 'Comunidades, assentamentos e povoados de fácil acesso.',
    },
    {
      id: 'rur-media',
      nome: 'Rural médio (15–40 km)',
      peso: 35,
      notas: 'Vilas e povoados intermediários — combinar com lideranças locais.',
    },
    {
      id: 'rur-dispersa',
      nome: 'Rural dispersa / povoados distantes',
      peso: 30,
      notas: 'Priorizar entrevistas domiciliares; validar roteiro com prefeitura/TRE.',
    },
  ]

  const mapa = distribuirInteiros(
    blocos.map((b) => ({ id: b.id, peso: b.peso })),
    entrevistasRurais,
  )

  return blocos.map((b) => ({
    id: b.id,
    nome: b.nome,
    pesoPct: pct(mapa.get(b.id) ?? 0, entrevistasRurais),
    entrevistas: mapa.get(b.id) ?? 0,
    tipo: 'rural' as const,
    notas: b.notas,
  }))
}

function montarEquipe(
  total: number,
  blocos: PlanoAmostragemBloco[],
  nEntrevistadores: number,
): PlanoAmostragemEquipe[] {
  const n = Math.max(1, Math.min(50, Math.round(nEntrevistadores)))
  const cotas = distribuirInteiros(
    Array.from({ length: n }, (_, i) => ({ id: String(i + 1), peso: 1 })),
    total,
  )

  const equipe: PlanoAmostragemEquipe[] = []
  const blocosOrdenados = [...blocos].sort((a, b) => b.entrevistas - a.entrevistas)
  let blocoIdx = 0
  let restanteBloco = blocosOrdenados[0]?.entrevistas ?? 0
  let blocoAtual = blocosOrdenados[0]?.nome ?? '—'

  for (let i = 1; i <= n; i += 1) {
    const meta = cotas.get(String(i)) ?? 0
    if (meta <= 0) continue

    const atribuidos: string[] = []
    let falta = meta
    while (falta > 0 && blocoIdx < blocosOrdenados.length) {
      const take = Math.min(falta, restanteBloco)
      if (take > 0) {
        atribuidos.push(`${blocoAtual} (${take})`)
        falta -= take
        restanteBloco -= take
      }
      if (restanteBloco <= 0) {
        blocoIdx += 1
        blocoAtual = blocosOrdenados[blocoIdx]?.nome ?? '—'
        restanteBloco = blocosOrdenados[blocoIdx]?.entrevistas ?? 0
      }
    }

    equipe.push({
      entrevistador: i,
      entrevistas: meta,
      blocosSugeridos: atribuidos.join('; ') || blocoAtual,
    })
  }

  return equipe
}

/** Sugestão padrão: ~75 entrevistas por entrevistador, entre 2 e 15 pessoas. */
export function sugerirEntrevistadores(amostraTotal: number): number {
  const n = Math.ceil(amostraTotal / 75)
  return Math.max(2, Math.min(15, n))
}

export function listarMunicipiosPlanoAmostragem(): ReadonlyArray<{
  municipio: string
  codigoIbge: string
  populacao: number
}> {
  return demografiaData
    .map((item) => ({
      municipio: item.municipio,
      codigoIbge: item.codigo_ibge,
      populacao: item.populacao_censo_2022,
    }))
    .sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR'))
}

export function gerarPlanoAmostragemPublico(input: GerarPlanoAmostragemInput): PlanoAmostragemPublico {
  const demo = encontrarDemografia(input.municipio)
  if (!demo) {
    throw new Error(`Município não encontrado na demografia IBGE: ${input.municipio}`)
  }

  const amostraTotal = Math.max(100, Math.min(2000, Math.round(input.amostraTotal)))
  const taxaUrbana = demo.urbanizacao.taxa_urbana
  const taxaRural = demo.urbanizacao.taxa_rural
  const pesoTerritorial =
    input.pesoTerritorial ??
    (input.tipoPesquisa === 'eleitoral' ? 'eleitorado_tse' : 'populacao_ibge')
  const pesoPorEleitores =
    input.pesoPorEleitores ?? pesoTerritorial === 'eleitorado_tse'
  const modoSetores =
    pesoTerritorial === 'populacao_ibge' &&
    (input.modoSetoresIbge ?? false) &&
    (input.setores?.length ?? 0) > 0

  const urTse = input.eleitoradoUrbanoTse ?? 0
  const rurTse = input.eleitoradoRuralTse ?? 0
  const popUrbSetor = input.populacaoUrbanaSetor ?? 0
  const popRurSetor = input.populacaoRuralSetor ?? 0

  const usaSplitSetor =
    pesoTerritorial === 'populacao_ibge' && popUrbSetor + popRurSetor > 0
  const usaSplitTse =
    pesoTerritorial === 'eleitorado_tse' && urTse + rurTse > 0

  const mapaUrRural = distribuirInteiros(
    usaSplitSetor
      ? [
          { id: 'urbano', peso: popUrbSetor },
          { id: 'rural', peso: popRurSetor },
        ]
      : usaSplitTse
        ? [
            { id: 'urbano', peso: urTse },
            { id: 'rural', peso: rurTse },
          ]
        : [
            { id: 'urbano', peso: demo.urbanizacao.urbana },
            { id: 'rural', peso: demo.urbanizacao.rural },
          ],
    amostraTotal,
  )

  const entrevistasUrbanas = mapaUrRural.get('urbano') ?? 0
  const entrevistasRurais = mapaUrRural.get('rural') ?? 0

  const blocosUrbanos = modoSetores
    ? montarBlocosUrbanosSetores(input.setores ?? [], entrevistasUrbanas)
    : montarBlocosUrbanos(input.bairros ?? [], entrevistasUrbanas, pesoPorEleitores)
  const blocosRurais = modoSetores
    ? montarBlocosRuraisSetores(input.setores ?? [], entrevistasRurais)
    : pesoPorEleitores
      ? montarBlocosRuraisTse(input.bairros ?? [], entrevistasRurais)
      : montarBlocosRurais(entrevistasRurais)

  const divisaoTerritorial: PlanoAmostragemBloco[] = [
    ...blocosUrbanos,
    ...blocosRurais,
  ]

  const entrevistadoresPrevistos =
    input.entrevistadores != null
      ? Math.max(1, Math.min(50, Math.round(input.entrevistadores)))
      : sugerirEntrevistadores(amostraTotal)

  const eleitorado = getEleitoradoByCity(demo.municipio)
  const territorio = getTerritorioDesenvolvimentoPI(demo.municipio)

  const tipoLabel = input.tipoPesquisa === 'eleitoral' ? 'eleitoral' : 'de opinião pública'
  const margemAprox =
    amostraTotal >= 600 ? '±4 p.p.' : amostraTotal >= 500 ? '±4,4 p.p.' : '±4,9 p.p.'

  const splitLabel = usaSplitSetor
    ? 'população por setor IBGE 2022'
    : usaSplitTse
      ? 'eleitorado TSE 2024'
      : 'IBGE Censo 2022'

  const avisos = [
    'Plano preliminar gerado automaticamente — validar povoados, rotas rurais e limites de bairro com equipe local antes do campo.',
    'Faixas etárias 16–59 usam subdivisão estimada a partir do Censo 2022 (IBGE); refinar se houver microdado municipal.',
    `Split urbano/rural ponderado pela ${splitLabel}.`,
    pesoTerritorial === 'eleitorado_tse'
      ? 'Pesquisa eleitoral: blocos e cotas territoriais ponderados pelo eleitorado TSE (locais/seções 2024), alinhado ao universo de votantes.'
      : 'Opinião pública: blocos territoriais ponderados pela população IBGE (Censo 2022), alinhado ao universo de residentes.',
    modoSetores
      ? 'Blocos por setor censitário IBGE — nível territorial mais fino para opinião pública.'
      : pesoPorEleitores && (input.bairros?.length ?? 0) > 0
        ? 'Blocos urbanos e rurais ponderados por eleitores TSE (bairro/recorte oficial).'
        : 'Blocos rurais genéricos ou sem TSE fino — validar roteiro com prefeitura e lideranças.',
    pesoTerritorial === 'eleitorado_tse' && (input.setores?.length ?? 0) > 0
      ? 'Mapa de setores IBGE disponível apenas como referência espacial; execução de campo segue blocos TSE.'
      : null,
  ].filter((a): a is string => Boolean(a))

  if (input.tipoPesquisa === 'eleitoral') {
    avisos.push(
      'Pesquisa eleitoral exige registro no TSE e método amostral documentado; este documento é insumo metodológico, não substitui parecer jurídico.',
    )
  }

  return {
    municipio: demo.municipio,
    codigoIbge: demo.codigo_ibge,
    territorio,
    populacaoCenso2022: demo.populacao_censo_2022,
    populacaoEstimada: demo.populacao_estimada_ultimo_ano,
    anoEstimativa: demo.ano_estimativa,
    taxaUrbanaPct: taxaUrbana,
    taxaRuralPct: taxaRural,
    eleitorado,
    amostraTotal,
    entrevistadoresPrevistos,
    tipoPesquisa: input.tipoPesquisa,
    institutoDestino: input.institutoDestino?.trim() || null,
    geradoEm: new Date().toISOString(),
    metodologiaResumo: `Amostragem ${tipoLabel} estratificada por zona urbana/rural (${splitLabel}), com cotas de sexo e idade e blocos territoriais${
      modoSetores
        ? ' por setor censitário IBGE (população)'
        : pesoPorEleitores
          ? ' ponderados por eleitorado TSE'
          : ''
    }. N=${amostraTotal} entrevistas face a face; margem de erro aproximada ${margemAprox} para proporções, nível de confiança 95% (população infinita).`,
    divisaoTerritorial,
    cotasSexo: montarCotasSexo(demo, amostraTotal),
    cotasIdade: montarCotasIdade(demo, amostraTotal),
    cotasHorario: montarCotasHorario(amostraTotal),
    equipeCampo: montarEquipe(amostraTotal, divisaoTerritorial, entrevistadoresPrevistos),
    regrasCampo: [
      'Sortear ponto de partida dentro do bloco (esquina, comércio, praça) e aplicar regra de deslocamento (ex.: a cada 5 domicílios, 1 entrevista elegível).',
      'Registrar endereço aproximado, horário, sexo, faixa etária e resultado (completa / recusa / ausente).',
      'Não entrevistar em colégios eleitorais no dia de eleição; evitar aglomerações partidárias.',
      'Priorizar entrevistas presenciais; telefone só como reposição documentada.',
    ],
    regrasSorteio: [
      'Elegível: residente no município há ≥6 meses, ≥16 anos.',
      input.tipoPesquisa === 'eleitoral'
        ? 'Para intenção de voto: eleitor regular, não candidato, não parente de candidato até 2º grau.'
        : 'Para opinião pública: adultos ≥16 anos residentes no recorte do bloco.',
      'Substituir recusa mantendo estrato (mesmo bloco, sexo e faixa etária).',
    ],
    auditoria: [
      'Supervisor deve recontactar 10% das fichas por telefone ou visita de checagem.',
      'Conferir distribuição real vs. cotas ao final de cada dia de campo.',
      'Anexar mapa fotográfico ou croqui dos pontos sorteados por bloco.',
    ],
    avisos,
    bairrosReferencia: (input.bairros ?? []).map((b) => b.nome),
  }
}
