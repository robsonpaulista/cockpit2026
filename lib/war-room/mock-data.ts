/** Dados mock da War Room — CRM, disparos e materiais (até ligar APIs reais). */

export type WarRoomCrmFunnel = {
  entradas: number
  respondidas: number
  pendentes: number
  resolvidas: number
}

export type WarRoomNamedShare = {
  label: string
  pct: number
}

export type WarRoomDisparo = {
  campanha: string
  publico: string
  enviados: number
  clicksPct: number
}

export type WarRoomMaterial = {
  item: string
  disponivel: number
  emTransito: number
  solicitado: number
}

export const WAR_ROOM_CRM_FUNNEL: WarRoomCrmFunnel = {
  entradas: 856,
  respondidas: 612,
  pendentes: 198,
  resolvidas: 426,
}

export const WAR_ROOM_CRM_ASSUNTOS: WarRoomNamedShare[] = [
  { label: 'Apoio / Adesão', pct: 32 },
  { label: 'Agenda / Eventos', pct: 24 },
  { label: 'Solicitações', pct: 18 },
  { label: 'Denúncias', pct: 12 },
  { label: 'Outros', pct: 14 },
]

export const WAR_ROOM_DISPAROS: WarRoomDisparo[] = [
  {
    campanha: 'Agenda de Picos',
    publico: 'Lideranças',
    enviados: 1248,
    clicksPct: 24,
  },
  {
    campanha: 'Novo Vídeo',
    publico: 'Base',
    enviados: 8742,
    clicksPct: 18,
  },
  {
    campanha: 'Visita Teresina',
    publico: 'Coordenadores',
    enviados: 224,
    clicksPct: 32,
  },
  {
    campanha: 'Lives Regionais',
    publico: 'Base',
    enviados: 5120,
    clicksPct: 15,
  },
  {
    campanha: 'Mutirão Campo Maior',
    publico: 'Lideranças',
    enviados: 890,
    clicksPct: 21,
  },
]

export const WAR_ROOM_MATERIAIS: WarRoomMaterial[] = [
  { item: 'Santinhos', disponivel: 250000, emTransito: 120000, solicitado: 85000 },
  { item: 'Banners', disponivel: 1120, emTransito: 230, solicitado: 310 },
  { item: 'Adesivos', disponivel: 45000, emTransito: 12000, solicitado: 20000 },
  { item: 'Bonés', disponivel: 3500, emTransito: 1200, solicitado: 800 },
]

export type WarRoomAgendaItem = {
  id: string
  titulo: string
  horario: string
  municipio: string
  tipo: string
  status: string
}

/** Fallback quando a API de agendas não retorna itens do dia. */
export const WAR_ROOM_AGENDA_MOCK: WarRoomAgendaItem[] = [
  {
    id: 'mock-ag-1',
    titulo: 'Café com lideranças',
    horario: '08:00',
    municipio: 'Picos - PI',
    tipo: 'reuniao',
    status: 'planejada',
  },
  {
    id: 'mock-ag-2',
    titulo: 'Visita ao Mercado Público',
    horario: '10:00',
    municipio: 'Picos - PI',
    tipo: 'visita',
    status: 'planejada',
  },
  {
    id: 'mock-ag-3',
    titulo: 'Encontro com lideranças',
    horario: '14:30',
    municipio: 'Teresina - PI',
    tipo: 'reuniao',
    status: 'planejada',
  },
  {
    id: 'mock-ag-4',
    titulo: 'Caminhada no Centro',
    horario: '17:00',
    municipio: 'Teresina - PI',
    tipo: 'evento',
    status: 'planejada',
  },
  {
    id: 'mock-ag-5',
    titulo: 'Reunião Coord. Municipal',
    horario: '19:00',
    municipio: 'Teresina - PI',
    tipo: 'reuniao',
    status: 'planejada',
  },
]

export type WarRoomMobilizacaoMetric = {
  label: string
  value: number
  meta?: number
}

export type WarRoomMobilizacaoMock = {
  eventoTitulo: string
  eventoHorario: string
  eventoMunicipio: string
  metricas: WarRoomMobilizacaoMetric[]
}

/** Mock — mobilização ainda não tem vínculo direto com agenda. */
export const WAR_ROOM_MOBILIZACAO_MOCK: WarRoomMobilizacaoMock = {
  eventoTitulo: 'Convenção partidária',
  eventoHorario: '14:00',
  eventoMunicipio: 'Teresina',
  metricas: [
    { label: 'Confirmados', value: 186, meta: 220 },
    { label: 'Lideranças', value: 42, meta: 50 },
    { label: 'Equipe campo', value: 28, meta: 30 },
  ],
}

export type WarRoomPesquisaAndamento = {
  cidade: string
  instituto: string
  termino: string
  entrega: string
}

/** Mock — pesquisas em campo/tabulação (ainda sem API de andamento). */
export const WAR_ROOM_PESQUISAS_ANDAMENTO: WarRoomPesquisaAndamento[] = [
  {
    cidade: 'Picos',
    instituto: 'Amostragem',
    termino: '28/05',
    entrega: '02/06',
  },
  {
    cidade: 'Teresina',
    instituto: 'Opinar',
    termino: '29/05',
    entrega: '03/06',
  },
  {
    cidade: 'Parnaíba',
    instituto: 'DataAZ',
    termino: '27/05',
    entrega: '30/06',
  },
]
