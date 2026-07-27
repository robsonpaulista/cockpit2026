import { IPT_VISITAS_COBERTURA_DIAS, normalizeIptMunicipio, type IptMunicipio } from '@/lib/ipt'
import { municipioCobertoCampo } from '@/lib/ipt-missoes'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import { municipioDistanciaPairKey } from '@/lib/municipio-distancia-estrada'
import {
  getMunicipiosPorTerritorioDesenvolvimentoPI,
  getTerritorioDesenvolvimentoPI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import type { WarRoomAgendaProximoItem } from '@/lib/war-room/agenda-proximos'

export type WarRoomAgendaSugestaoOrdenacao = 'expectativa' | 'rota'
export type WarRoomAgendaSugestaoOrigem = 'teresina' | 'referencia'
export type WarRoomAgendaSugestaoDistanciaModo = 'estrada' | 'linha_reta'

export type WarRoomAgendaSugestaoTdItem = {
  municipio: string
  expectativaVotos: number
  pesoExpectativaPct: number
  visitasUltimos15Dias: number
  /** km desde a origem até este município */
  distanciaKmOrigem: number | null
  /** km desde o ponto anterior na rota (origem no 1º) */
  distanciaKmTrecho: number | null
  /** Cidade-pai da agenda (incluída quando a origem da rota é Teresina) */
  ehReferenciaAgenda?: boolean
}

export type WarRoomAgendaSugestaoTdResult = {
  td: TerritorioDesenvolvimentoPI | null
  cidadePai: string
  dataPaiKey: string
  dataPaiLabel: string
  janelaVisitasDias: number
  ordenacao: WarRoomAgendaSugestaoOrdenacao
  origemRota: WarRoomAgendaSugestaoOrigem
  origemLabel: string
  sugestoes: WarRoomAgendaSugestaoTdItem[]
  /** Soma dos trechos da rota (somente quando ordenacao === 'rota') */
  distanciaTotalKm: number | null
  distanciaModo: WarRoomAgendaSugestaoDistanciaModo
  totalNoTd: number
  excluidosComVisita: number
  excluidosComAgenda: number
  semCoordenada: number
}

type Coord = { lat: number; lng: number }

const TERESINA_NOME = 'Teresina'

const COORDS_BY_NORM = new Map(
  (municipiosPiaui as Array<{ nome: string; lat: number; lng: number }>).map((m) => [
    normalizeIptMunicipio(m.nome),
    { lat: m.lat, lng: m.lng } as Coord,
  ]),
)

function formatDataLabelBr(dayKey: string): string {
  const [y, m, d] = dayKey.split('-')
  if (!y || !m || !d) return dayKey
  return `${d}/${m}`
}

function temAgendaNoIntervalo(
  itens: WarRoomAgendaProximoItem[] | undefined,
  inicioKey: string,
  fimKey: string,
): boolean {
  if (!itens?.length) return false
  return itens.some((item) => item.dataKey >= inicioKey && item.dataKey <= fimKey)
}

function haversineKm(a: Coord, b: Coord): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function coordOf(nome: string): Coord | null {
  return COORDS_BY_NORM.get(normalizeIptMunicipio(nome)) ?? null
}

function lookupKm(
  de: string,
  para: string,
  distanciasEstrada: Record<string, number> | undefined,
): number | null {
  if (!distanciasEstrada) return null
  const key = municipioDistanciaPairKey(de, para)
  const km = distanciasEstrada[key]
  return typeof km === 'number' && Number.isFinite(km) ? km : null
}

function distanciaEntre(
  deNome: string,
  paraNome: string,
  deCoord: Coord | null,
  paraCoord: Coord | null,
  distanciasEstrada: Record<string, number> | undefined,
): { km: number | null; modo: WarRoomAgendaSugestaoDistanciaModo } {
  const estrada = lookupKm(deNome, paraNome, distanciasEstrada)
  if (estrada != null) return { km: estrada, modo: 'estrada' }
  if (deCoord && paraCoord) {
    return { km: haversineKm(deCoord, paraCoord), modo: 'linha_reta' }
  }
  return { km: null, modo: 'linha_reta' }
}

/**
 * Vizinho mais próximo: partindo da origem, sempre escolhe o elegível mais perto
 * do ponto atual (estrada se houver; senão linha reta).
 */
function ordenarPorRotaNearestNeighbor(
  itens: WarRoomAgendaSugestaoTdItem[],
  origemNome: string,
  origemCoord: Coord,
  distanciasEstrada: Record<string, number> | undefined,
): {
  ordenados: WarRoomAgendaSugestaoTdItem[]
  totalKm: number
  semCoord: number
  usouEstrada: boolean
} {
  const restantes = [...itens]
  const ordenados: WarRoomAgendaSugestaoTdItem[] = []
  let atualNome = origemNome
  let atualCoord = origemCoord
  let totalKm = 0
  let semCoord = 0
  let usouEstrada = false

  while (restantes.length > 0) {
    let bestIdx = -1
    let bestKm = Infinity
    let bestModo: WarRoomAgendaSugestaoDistanciaModo = 'linha_reta'

    for (let i = 0; i < restantes.length; i += 1) {
      const c = coordOf(restantes[i].municipio)
      if (!c) continue
      const d = distanciaEntre(
        atualNome,
        restantes[i].municipio,
        atualCoord,
        c,
        distanciasEstrada,
      )
      if (d.km == null) continue
      if (d.km < bestKm) {
        bestKm = d.km
        bestIdx = i
        bestModo = d.modo
      }
    }

    if (bestIdx < 0) {
      for (const item of restantes) {
        ordenados.push({
          ...item,
          distanciaKmOrigem: null,
          distanciaKmTrecho: null,
        })
        semCoord += 1
      }
      break
    }

    const [picked] = restantes.splice(bestIdx, 1)
    const pickedCoord = coordOf(picked.municipio)!
    const origemD = distanciaEntre(
      origemNome,
      picked.municipio,
      origemCoord,
      pickedCoord,
      distanciasEstrada,
    )
    if (bestModo === 'estrada' || origemD.modo === 'estrada') usouEstrada = true
    totalKm += bestKm
    ordenados.push({
      ...picked,
      distanciaKmOrigem: origemD.km != null ? Math.round(origemD.km) : null,
      distanciaKmTrecho: Math.round(bestKm),
    })
    atualNome = picked.municipio
    atualCoord = pickedCoord
  }

  return {
    ordenados,
    totalKm: Math.round(totalKm),
    semCoord,
    usouEstrada,
  }
}

/**
 * Sugere municípios do mesmo TD da cidade-pai (com compromisso) que:
 * - não têm visita recente (cobertura IPT, 15 dias);
 * - não têm agendamento entre hoje e a data do compromisso-pai.
 *
 * Ordenação:
 * - expectativa: maior expectativa primeiro;
 * - rota: vizinho mais próximo (km estrada se `distanciasEstrada` informado).
 */
export function buildSugestoesAgendaTd(opts: {
  cidadePai: string
  dataPaiKey: string
  hojeKey: string
  municipios: IptMunicipio[]
  agendaPorMunicipio: Map<string, WarRoomAgendaProximoItem[]>
  ordenacao?: WarRoomAgendaSugestaoOrdenacao
  origemRota?: WarRoomAgendaSugestaoOrigem
  /** Mapa `${origemNorm}|${destinoNorm}` → km rodoviário (cache/ORS). */
  distanciasEstrada?: Record<string, number>
}): WarRoomAgendaSugestaoTdResult {
  const {
    cidadePai,
    dataPaiKey,
    hojeKey,
    municipios,
    agendaPorMunicipio,
    ordenacao = 'expectativa',
    origemRota = 'referencia',
    distanciasEstrada,
  } = opts
  const td = getTerritorioDesenvolvimentoPI(cidadePai)
  const dataPaiLabel = formatDataLabelBr(dataPaiKey)
  const origemLabel = origemRota === 'teresina' ? TERESINA_NOME : cidadePai
  const empty: WarRoomAgendaSugestaoTdResult = {
    td,
    cidadePai,
    dataPaiKey,
    dataPaiLabel,
    janelaVisitasDias: IPT_VISITAS_COBERTURA_DIAS,
    ordenacao,
    origemRota,
    origemLabel,
    sugestoes: [],
    distanciaTotalKm: null,
    distanciaModo: 'linha_reta',
    totalNoTd: 0,
    excluidosComVisita: 0,
    excluidosComAgenda: 0,
    semCoordenada: 0,
  }

  if (!td || !dataPaiKey || dataPaiKey < hojeKey) return empty

  const paiKey = normalizeIptMunicipio(cidadePai)
  const nomesTd = getMunicipiosPorTerritorioDesenvolvimentoPI(td)
  const iptByNorm = new Map(
    municipios.map((m) => [normalizeIptMunicipio(m.municipio), m] as const),
  )

  let excluidosComVisita = 0
  let excluidosComAgenda = 0
  const base: WarRoomAgendaSugestaoTdItem[] = []
  const incluirCidadePai = origemRota === 'teresina'
  const origemCoord =
    origemRota === 'teresina' ? coordOf(TERESINA_NOME) : coordOf(cidadePai)

  for (const nome of nomesTd) {
    const norm = normalizeIptMunicipio(nome)
    const ehPai = norm === paiKey

    if (ehPai && !incluirCidadePai) continue

    const ipt = iptByNorm.get(norm)
    if (!ipt) continue
    if (ipt.expectativaVotos <= 0) continue

    if (!ehPai) {
      if (municipioCobertoCampo(ipt)) {
        excluidosComVisita += 1
        continue
      }

      const agendaItens = agendaPorMunicipio.get(norm)
      if (temAgendaNoIntervalo(agendaItens, hojeKey, dataPaiKey)) {
        excluidosComAgenda += 1
        continue
      }
    }

    const munCoord = coordOf(ipt.municipio)
    const dOrigem = distanciaEntre(
      origemLabel,
      ipt.municipio,
      origemCoord,
      munCoord,
      distanciasEstrada,
    )

    base.push({
      municipio: ipt.municipio,
      expectativaVotos: ipt.expectativaVotos,
      pesoExpectativaPct: ipt.pesoExpectativaPct,
      visitasUltimos15Dias: ipt.detalhes.visitasUltimos15Dias,
      distanciaKmOrigem: dOrigem.km != null ? Math.round(dOrigem.km) : null,
      distanciaKmTrecho: null,
      ehReferenciaAgenda: ehPai,
    })
  }

  let sugestoes = base
  let distanciaTotalKm: number | null = null
  let semCoordenada = 0
  let distanciaModo: WarRoomAgendaSugestaoDistanciaModo = 'linha_reta'

  if (ordenacao === 'rota') {
    if (origemCoord) {
      const rota = ordenarPorRotaNearestNeighbor(
        base,
        origemLabel,
        origemCoord,
        distanciasEstrada,
      )
      sugestoes = rota.ordenados
      distanciaTotalKm = rota.totalKm
      semCoordenada = rota.semCoord
      distanciaModo = rota.usouEstrada ? 'estrada' : 'linha_reta'
    } else {
      sugestoes = [...base].sort((a, b) =>
        a.municipio.localeCompare(b.municipio, 'pt-BR', { sensitivity: 'base' }),
      )
      semCoordenada = base.length
    }
  } else {
    sugestoes = [...base].sort((a, b) => {
      if (b.expectativaVotos !== a.expectativaVotos) {
        return b.expectativaVotos - a.expectativaVotos
      }
      return a.municipio.localeCompare(b.municipio, 'pt-BR', { sensitivity: 'base' })
    })
    semCoordenada = base.filter((i) => i.distanciaKmOrigem == null).length
  }

  return {
    td,
    cidadePai,
    dataPaiKey,
    dataPaiLabel,
    janelaVisitasDias: IPT_VISITAS_COBERTURA_DIAS,
    ordenacao,
    origemRota,
    origemLabel,
    sugestoes,
    distanciaTotalKm,
    distanciaModo,
    totalNoTd: incluirCidadePai
      ? nomesTd.length
      : Math.max(0, nomesTd.length - 1),
    excluidosComVisita,
    excluidosComAgenda,
    semCoordenada,
  }
}
