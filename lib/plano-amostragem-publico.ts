import demografiaData from '@/data/demografia-municipios-piaui.json'
import { getEleitoradoByCity } from '@/lib/eleitores'
import { getTerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import type {
  PlanoAmostragemAlocacaoBloco,
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

function comPctAmostra(
  bloco: Omit<PlanoAmostragemBloco, 'pctAmostra'>,
  amostraTotal: number,
): PlanoAmostragemBloco {
  return { ...bloco, pctAmostra: pct(bloco.entrevistas, amostraTotal) }
}

type BlocoSemPctAmostra = Omit<PlanoAmostragemBloco, 'pctAmostra'>

/** Só divide bloco entre entrevistadores quando tiver mais que este N. */
const LIMITE_DIVIDIR_BLOCO_ENTREVISTAS = 15
/** Fragmento mínimo ao dividir bloco grande (evita pedaços de 1–3 entrevistas). */
const MIN_FRAGMENTO_BLOCO_ENTREVISTAS = 4

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
    { id: 'manha', perfil: 'Manhã (8h–12h)', peso: 28 },
    { id: 'tarde', perfil: 'Tarde (13h–17h)', peso: 37 },
    { id: 'noite', perfil: 'Noite (18h–21h)', peso: 35 },
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
): BlocoSemPctAmostra[] {
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

  const chaveBairro = (b: BairroReferencia) => `${b.nome}|${b.secoes}|${b.eleitores}`

  const mapaEntrevistas = distribuirInteiros(
    ordenados.map((b) => ({ id: chaveBairro(b), peso: pesoBairro(b, pesoPorEleitores) })),
    entrevistasUrbanas,
  )

  const contagemNomes = new Map<string, number>()
  for (const b of ordenados) {
    const chave = b.nome.toLowerCase()
    contagemNomes.set(chave, (contagemNomes.get(chave) ?? 0) + 1)
  }

  const rotuloPeso = pesoPorEleitores ? 'eleitores' : 'seções'
  const blocos: Array<{ id: string; nome: string; peso: number; notas?: string; entrevistas: number }> =
    []
  const agrupados: BairroReferencia[] = []

  for (const b of ordenados) {
    const entrevistas = mapaEntrevistas.get(chaveBairro(b)) ?? 0
    if (entrevistas <= 0) continue

    const individual =
      entrevistas >= MIN_ENTREVISTAS_BLOCO_INDIVIDUAL &&
      pesoBairro(b, pesoPorEleitores) >= MIN_POPULACAO_PONTO_ISOLADO

    if (individual) {
      const duplicado = (contagemNomes.get(b.nome.toLowerCase()) ?? 0) > 1
      const nomeExibicao = duplicado
        ? `${b.nome} — ${pesoPorEleitores ? `${b.eleitores.toLocaleString('pt-BR')} eleitores` : `${b.secoes} seção(ões)`}`
        : b.nome
      blocos.push({
        id: `bairro-${b.nome}-${b.secoes}`,
        nome: nomeExibicao,
        peso: pesoBairro(b, pesoPorEleitores),
        entrevistas,
        notas: pesoPorEleitores
          ? `${b.eleitores.toLocaleString('pt-BR')} eleitores · ${b.secoes} seção(ões) TSE 2024.`
          : `${b.secoes} seção(ões) eleitoral(is) de referência (TSE 2024).`,
      })
    } else {
      agrupados.push(b)
    }
  }

  if (agrupados.length > 0) {
    const entrevistasAgrupadas = agrupados.reduce(
      (acc, b) => acc + (mapaEntrevistas.get(chaveBairro(b)) ?? 0),
      0,
    )
    blocos.push({
      id: 'bairro-outros',
      nome: 'Demais bairros (agrupados)',
      peso: agrupados.reduce((acc, b) => acc + pesoBairro(b, pesoPorEleitores), 0),
      entrevistas: entrevistasAgrupadas,
      notas: `${agrupados.length} bairro(s) agrupados por baixa densidade de ${rotuloPeso} — entrevistas proporcionais ao peso de cada bairro na rota.`,
    })
  }

  return blocos
    .sort((a, b) => b.entrevistas - a.entrevistas)
    .map((b) => ({
      id: b.id,
      nome: b.nome,
      pesoPct: pct(b.entrevistas, entrevistasUrbanas),
      entrevistas: b.entrevistas,
      tipo: 'urbano' as const,
      notas: b.notas,
    }))
}

function codigoSetor(cdSetor: string): string {
  return cdSetor.slice(-4)
}

function formatarNomeSetor(s: SetorReferencia): string {
  const codigo = codigoSetor(s.cdSetor)
  const nomeBase = s.nome.trim()
  const jaTemCodigo =
    nomeBase.toLowerCase().endsWith(codigo.toLowerCase()) ||
    nomeBase.toLowerCase() === `setor ${codigo}`.toLowerCase()
  if (jaTemCodigo) return nomeBase
  return `${nomeBase} — Setor ${codigo}`
}

/** Setores com ≥3 entrevistas e ≥100 hab. viram bloco individual; demais entram em rota agrupada. */
const MIN_ENTREVISTAS_BLOCO_INDIVIDUAL = 3
const MIN_POPULACAO_PONTO_ISOLADO = 100

function montarBlocosPorSetores(
  setores: SetorReferencia[],
  totalEntrevistas: number,
  tipo: 'urbano' | 'rural',
): BlocoSemPctAmostra[] {
  const filtrados = setores.filter(
    (s) => (tipo === 'urbano' ? s.urbano : !s.urbano) && s.populacao > 0,
  )
  if (filtrados.length === 0) {
    return tipo === 'urbano'
      ? montarBlocosUrbanos([], totalEntrevistas, true)
      : montarBlocosRurais(totalEntrevistas)
  }

  const mapaEntrevistas = distribuirInteiros(
    filtrados.map((s) => ({ id: s.cdSetor, peso: s.populacao })),
    totalEntrevistas,
  )

  const blocos: BlocoSemPctAmostra[] = []
  const agrupados: SetorReferencia[] = []

  const ordenados = [...filtrados].sort((a, b) => b.populacao - a.populacao)
  for (const s of ordenados) {
    const entrevistas = mapaEntrevistas.get(s.cdSetor) ?? 0
    if (entrevistas <= 0) continue

    const individual =
      entrevistas >= MIN_ENTREVISTAS_BLOCO_INDIVIDUAL &&
      s.populacao >= MIN_POPULACAO_PONTO_ISOLADO

    if (individual) {
      blocos.push({
        id: `setor-${s.cdSetor}`,
        nome: formatarNomeSetor(s),
        pesoPct: pct(entrevistas, totalEntrevistas),
        entrevistas,
        tipo,
        notas: `${s.populacao.toLocaleString('pt-BR')} hab. · setor ${codigoSetor(s.cdSetor)} (IBGE 2022).`,
        setorIds: [s.cdSetor],
      })
    } else {
      agrupados.push(s)
    }
  }

  if (agrupados.length > 0) {
    const entrevistasAgrupadas = agrupados.reduce(
      (acc, s) => acc + (mapaEntrevistas.get(s.cdSetor) ?? 0),
      0,
    )
    blocos.push({
      id: tipo === 'urbano' ? 'setor-outros' : 'rur-setor-outros',
      nome:
        tipo === 'urbano'
          ? 'Demais setores urbanos (agrupados)'
          : 'Demais setores rurais (agrupados)',
      pesoPct: pct(entrevistasAgrupadas, totalEntrevistas),
      entrevistas: entrevistasAgrupadas,
      tipo,
      notas: `${agrupados.length} setor(es) IBGE — entrevistas proporcionais à população de cada setor na rota.`,
      setorIds: agrupados.map((s) => s.cdSetor),
    })
  }

  return blocos.sort((a, b) => b.entrevistas - a.entrevistas)
}

function montarBlocosUrbanosSetores(
  setores: SetorReferencia[],
  entrevistasUrbanas: number,
): BlocoSemPctAmostra[] {
  return montarBlocosPorSetores(setores, entrevistasUrbanas, 'urbano')
}

function montarBlocosRuraisSetores(
  setores: SetorReferencia[],
  entrevistasRurais: number,
): BlocoSemPctAmostra[] {
  return montarBlocosPorSetores(setores, entrevistasRurais, 'rural')
}

function montarBlocosRuraisTse(
  bairros: BairroReferencia[],
  entrevistasRurais: number,
): BlocoSemPctAmostra[] {
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

function montarBlocosRurais(entrevistasRurais: number): BlocoSemPctAmostra[] {
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
  const capacidades = new Map<number, number>()
  const alocacoes = new Map<number, PlanoAmostragemAlocacaoBloco[]>()

  const cotas = distribuirInteiros(
    Array.from({ length: n }, (_, i) => ({ id: String(i + 1), peso: 1 })),
    total,
  )

  for (let i = 1; i <= n; i += 1) {
    const meta = cotas.get(String(i)) ?? 0
    capacidades.set(i, meta)
    alocacoes.set(i, [])
  }

  const pushAlocacao = (entrevistador: number, bloco: PlanoAmostragemBloco, qtd: number) => {
    if (qtd <= 0) return
    const lista = alocacoes.get(entrevistador) ?? []
    const ultimo = lista[lista.length - 1]
    if (ultimo?.blocoId === bloco.id) {
      ultimo.entrevistas += qtd
    } else {
      lista.push({ blocoId: bloco.id, blocoNome: bloco.nome, entrevistas: qtd })
    }
    alocacoes.set(entrevistador, lista)
    capacidades.set(entrevistador, (capacidades.get(entrevistador) ?? 0) - qtd)
  }

  const melhorEncaixe = (qtd: number): number | null => {
    const candidatos = [...capacidades.entries()]
      .filter(([, cap]) => cap >= qtd)
      .sort((a, b) => a[1] - b[1])
    return candidatos[0]?.[0] ?? null
  }

  const maiorCapacidade = (): number | null => {
    let melhor: number | null = null
    let maxCap = 0
    for (const [id, cap] of capacidades) {
      if (cap > maxCap) {
        maxCap = cap
        melhor = id
      }
    }
    return melhor
  }

  type Pendente = { bloco: PlanoAmostragemBloco; restante: number }
  const indivisiveis: Pendente[] = blocos
    .filter((b) => b.entrevistas > 0 && b.entrevistas <= LIMITE_DIVIDIR_BLOCO_ENTREVISTAS)
    .map((bloco) => ({ bloco, restante: bloco.entrevistas }))
    .sort((a, b) => b.restante - a.restante)

  const divisiveis: Pendente[] = blocos
    .filter((b) => b.entrevistas > LIMITE_DIVIDIR_BLOCO_ENTREVISTAS)
    .map((bloco) => ({ bloco, restante: bloco.entrevistas }))
    .sort((a, b) => b.restante - a.restante)

  // Blocos ≤15 entrevistas: sempre inteiros em um único entrevistador (best-fit decrescente)
  for (const item of indivisiveis) {
    const ent = melhorEncaixe(item.restante) ?? maiorCapacidade()
    if (ent == null || (capacidades.get(ent) ?? 0) < item.restante) {
      continue
    }
    pushAlocacao(ent, item.bloco, item.restante)
    item.restante = 0
  }

  // Repescagem: blocos indivisíveis que não encaixaram — maior capacidade disponível
  for (const item of indivisiveis.filter((p) => p.restante > 0)) {
    const ent = maiorCapacidade()
    if (ent == null || (capacidades.get(ent) ?? 0) < item.restante) continue
    pushAlocacao(ent, item.bloco, item.restante)
    item.restante = 0
  }

  // Blocos grandes: dividir com fragmentos ≥ MIN_FRAGMENTO
  for (const item of divisiveis) {
    while (item.restante > 0) {
      const ent = melhorEncaixe(item.restante) ?? maiorCapacidade()
      if (ent == null || (capacidades.get(ent) ?? 0) <= 0) break

      const cap = capacidades.get(ent) ?? 0
      let take = Math.min(cap, item.restante)

      if (take < item.restante && item.restante - take < MIN_FRAGMENTO_BLOCO_ENTREVISTAS) {
        take = item.restante - MIN_FRAGMENTO_BLOCO_ENTREVISTAS
      }
      if (take < MIN_FRAGMENTO_BLOCO_ENTREVISTAS && item.restante > MIN_FRAGMENTO_BLOCO_ENTREVISTAS) {
        const outro = melhorEncaixe(item.restante)
        if (outro != null && outro !== ent) {
          pushAlocacao(outro, item.bloco, item.restante)
          item.restante = 0
          continue
        }
      }
      if (take <= 0) break

      pushAlocacao(ent, item.bloco, take)
      item.restante -= take
    }
  }

  // Passagem final: esgotar blocos pendentes e capacidades restantes
  const pendentesFinais = [...indivisiveis, ...divisiveis].filter((p) => p.restante > 0)
  for (const item of pendentesFinais) {
    while (item.restante > 0) {
      const ent = melhorEncaixe(item.restante) ?? maiorCapacidade()
      if (ent == null || (capacidades.get(ent) ?? 0) <= 0) break
      const take = Math.min(capacidades.get(ent) ?? 0, item.restante)
      if (take <= 0) break
      pushAlocacao(ent, item.bloco, take)
      item.restante -= take
    }
  }

  const equipe: PlanoAmostragemEquipe[] = []
  for (let i = 1; i <= n; i += 1) {
    const meta = cotas.get(String(i)) ?? 0
    if (meta <= 0) continue
    const atribuidos = alocacoes.get(i) ?? []
    equipe.push({
      entrevistador: i,
      entrevistas: meta,
      alocacao: atribuidos,
      blocosSugeridos:
        atribuidos.map((a) => `${a.blocoNome} (${a.entrevistas})`).join('; ') || '—',
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
  ].map((b) => comPctAmostra(b, amostraTotal))

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
    amostraUrbana: entrevistasUrbanas,
    amostraRural: entrevistasRurais,
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
      'Auditoria mínima obrigatória: recontactar 10% das fichas por telefone ou visita de checagem.',
      'Auditoria recomendada: 20% das fichas, com prioridade para zona rural e blocos agrupados.',
      'Auditoria dirigida (100%): todos os casos suspeitos — entrevistas muito rápidas; muitas no mesmo GPS; alta taxa de recusa; todas no mesmo horário; entrevistador acima da média de produtividade.',
      'Conferir distribuição real vs. cotas (sexo, idade e horário) ao final de cada dia de campo.',
      'Anexar mapa fotográfico ou croqui dos pontos sorteados por bloco.',
    ],
    avisos,
    bairrosReferencia: (input.bairros ?? []).map((b) => b.nome),
  }
}
