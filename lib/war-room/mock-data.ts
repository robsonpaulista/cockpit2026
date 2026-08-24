/** Dados mock da War Room — CRM, disparos e materiais (até ligar APIs reais). */

export type WarRoomCrmFunnel = {
  entradas: number
  respondidas: number
  pendentes: number
  resolvidas: number
}

export type WarRoomCrmFunnelIcone = 'whatsapp' | 'user' | 'check' | 'flag'

export type WarRoomCrmFunnelStep = {
  key: string
  label: string
  value: number
  pct: number
  icone: WarRoomCrmFunnelIcone
}

export type WarRoomNamedShare = {
  label: string
  pct: number
}

export type WarRoomDisparoStatus = 'ok' | 'atencao' | 'critico'

export type WarRoomDisparo = {
  campanha: string
  /** ID externo da campanha no Fluxo (quando houver). */
  campanhaId?: string | null
  publico: string
  enviados: number
  entregues?: number
  clicksPct: number
  status?: WarRoomDisparoStatus
  /** Município alvo do disparo (quando aplicável). */
  cidade?: string | null
}

export type WarRoomMaterialStatus = 'ok' | 'baixo' | 'critico'

export type WarRoomMaterial = {
  item: string
  disponivel: number
  emTransito: number
  solicitado: number
  estoquePct?: number
  status?: WarRoomMaterialStatus
}

function resolveDisparoStatus(clicksPct: number): WarRoomDisparoStatus {
  if (clicksPct < 15) return 'critico'
  if (clicksPct < 18) return 'atencao'
  return 'ok'
}

function buildDisparo(
  base: Omit<WarRoomDisparo, 'entregues' | 'status'> & { cidade?: string | null },
): WarRoomDisparo {
  return {
    ...base,
    cidade: base.cidade ?? null,
    entregues: Math.round(base.enviados * 0.9),
    status: resolveDisparoStatus(base.clicksPct),
  }
}

function resolveMaterialStatus(
  disponivel: number,
  solicitado: number,
  estoquePct: number,
): WarRoomMaterialStatus {
  if (estoquePct < 15 || solicitado > disponivel) return 'critico'
  if (estoquePct < 35 || solicitado > disponivel * 0.5) return 'baixo'
  return 'ok'
}

function buildMaterial(
  base: Omit<WarRoomMaterial, 'estoquePct' | 'status'> & { estoqueTotal: number },
): WarRoomMaterial {
  const { estoqueTotal, ...rest } = base
  const estoquePct = Math.max(
    0,
    Math.min(100, Math.round((rest.disponivel / estoqueTotal) * 100)),
  )
  return {
    ...rest,
    estoquePct,
    status: resolveMaterialStatus(rest.disponivel, rest.solicitado, estoquePct),
  }
}

export const WAR_ROOM_CRM_FUNNEL: WarRoomCrmFunnel = {
  entradas: 12842,
  respondidas: 5671,
  pendentes: 198,
  resolvidas: 1256,
}

/** Etapas do funil clean — CRM / WhatsApp. */
export const WAR_ROOM_CRM_FUNNEL_STEPS: WarRoomCrmFunnelStep[] = [
  {
    key: 'novas',
    label: 'Novas conversas',
    value: 12842,
    pct: 100,
    icone: 'whatsapp',
  },
  {
    key: 'atendimento',
    label: 'Em atendimento',
    value: 5671,
    pct: 44,
    icone: 'user',
  },
  {
    key: 'qualificados',
    label: 'Qualificados',
    value: 2314,
    pct: 18,
    icone: 'check',
  },
  {
    key: 'convertidos',
    label: 'Convertidos (ações)',
    value: 1256,
    pct: 10,
    icone: 'flag',
  },
]

export const WAR_ROOM_CRM_ASSUNTOS: WarRoomNamedShare[] = [
  { label: 'Apoio / Adesão', pct: 32 },
  { label: 'Agenda / Eventos', pct: 24 },
  { label: 'Solicitações', pct: 18 },
  { label: 'Denúncias', pct: 12 },
  { label: 'Outros', pct: 14 },
]

export const WAR_ROOM_DISPAROS: WarRoomDisparo[] = [
  buildDisparo({
    campanha: 'Agenda de Picos',
    publico: 'Lideranças',
    enviados: 1248,
    clicksPct: 24,
    cidade: 'Picos',
  }),
  buildDisparo({
    campanha: 'Novo Vídeo',
    publico: 'Base',
    enviados: 8742,
    clicksPct: 18,
  }),
  buildDisparo({
    campanha: 'Visita Teresina',
    publico: 'Coordenadores',
    enviados: 224,
    clicksPct: 32,
    cidade: 'Teresina',
  }),
  buildDisparo({
    campanha: 'Lives Regionais',
    publico: 'Base',
    enviados: 5120,
    clicksPct: 15,
  }),
  buildDisparo({
    campanha: 'Mutirão Campo Maior',
    publico: 'Lideranças',
    enviados: 890,
    clicksPct: 21,
    cidade: 'Campo Maior',
  }),
  buildDisparo({
    campanha: 'Convite Audiência',
    publico: 'Coordenadores',
    enviados: 1560,
    clicksPct: 27,
  }),
  buildDisparo({
    campanha: 'Enquete Semanal',
    publico: 'Base',
    enviados: 6340,
    clicksPct: 12,
  }),
  buildDisparo({
    campanha: 'Alerta Operação',
    publico: 'Lideranças',
    enviados: 412,
    clicksPct: 41,
  }),
]

export const WAR_ROOM_MATERIAIS: WarRoomMaterial[] = [
  buildMaterial({
    item: 'Santinhos',
    disponivel: 250000,
    emTransito: 120000,
    solicitado: 85000,
    estoqueTotal: 400000,
  }),
  buildMaterial({
    item: 'Banners',
    disponivel: 1120,
    emTransito: 230,
    solicitado: 310,
    estoqueTotal: 5000,
  }),
  buildMaterial({
    item: 'Adesivos',
    disponivel: 45000,
    emTransito: 12000,
    solicitado: 30000,
    estoqueTotal: 90000,
  }),
  buildMaterial({
    item: 'Bonés',
    disponivel: 3500,
    emTransito: 1200,
    solicitado: 4000,
    estoqueTotal: 6000,
  }),
]

export type WarRoomAgendaItem = {
  id: string
  titulo: string
  horario: string
  municipio: string
  tipo: string
  status: string
  attended?: boolean | null
  arrivalTime?: string | null
}

/** Fallback quando a API de agendas não retorna itens do dia. */
export const WAR_ROOM_AGENDA_MOCK: WarRoomAgendaItem[] = [
  {
    id: 'mock-ag-1',
    titulo: 'Reunião de alinhamento',
    horario: '09:00',
    municipio: 'Sala de Situação',
    tipo: 'reuniao',
    status: 'concluido',
  },
  {
    id: 'mock-ag-2',
    titulo: 'Entrevista – Rádio Cidade',
    horario: '10:30',
    municipio: 'Candidato A',
    tipo: 'evento',
    status: 'planejada',
  },
  {
    id: 'mock-ag-3',
    titulo: 'Visita – Zona Sul (Teresina)',
    horario: '14:00',
    municipio: 'Carreata + Caminhada',
    tipo: 'visita',
    status: 'planejada',
  },
  {
    id: 'mock-ag-4',
    titulo: 'Live nas Redes Sociais',
    horario: '16:30',
    municipio: 'Plano de Governo',
    tipo: 'evento',
    status: 'planejada',
  },
  {
    id: 'mock-ag-5',
    titulo: 'Reunião com Lideranças',
    horario: '19:00',
    municipio: 'Sede Estadual',
    tipo: 'reuniao',
    status: 'planejada',
  },
]

export type WarRoomMobilizacaoMetric = {
  label: string
  value: number
  meta?: number
}

export type WarRoomMobilizacaoFunilTone = 'planejado' | 'andamento' | 'concluido'

export type WarRoomMobilizacaoFunilStep = {
  key: WarRoomMobilizacaoFunilTone
  label: string
  value: number
}

export type WarRoomMobilizacaoMock = {
  eventoTitulo: string
  eventoHorario: string
  eventoMunicipio: string
  pctConcluido: number
  funil: WarRoomMobilizacaoFunilStep[]
  metricas: WarRoomMobilizacaoMetric[]
}

/** Mock — mobilização ainda não tem vínculo direto com agenda. */
export const WAR_ROOM_MOBILIZACAO_MOCK: WarRoomMobilizacaoMock = {
  eventoTitulo: 'Convenção partidária',
  eventoHorario: '14:00',
  eventoMunicipio: 'Teresina',
  pctConcluido: 68,
  funil: [
    { key: 'planejado', label: 'Planejado', value: 1250 },
    { key: 'andamento', label: 'Em andamento', value: 850 },
    { key: 'concluido', label: 'Concluído', value: 1700 },
  ],
  metricas: [
    { label: 'Confirmados', value: 1700, meta: 2500 },
    { label: 'Lideranças', value: 42, meta: 50 },
    { label: 'Equipe campo', value: 28, meta: 30 },
    { label: 'Apoiadores', value: 312, meta: 400 },
    { label: 'Caravanas', value: 6, meta: 8 },
    { label: 'Comunidades', value: 14, meta: 20 },
  ],
}


export type WarRoomFeedTipo =
  | 'pesquisa'
  | 'visita'
  | 'expectativa'
  | 'conteudo'
  | 'mobilizacao'
  | 'alerta'
  | 'material'
  | 'disparo'

export type WarRoomFeedItem = {
  id: string
  hora: string
  acao: string
  responsavel?: string
  modulo: string
  tipo: WarRoomFeedTipo
}

/** Linha viva — últimos eventos operacionais registrados no dia. */
export const WAR_ROOM_FEED: WarRoomFeedItem[] = [
  {
    id: 'feed-1',
    hora: '19:42',
    acao: 'Confirmou presença na Convenção partidária',
    responsavel: 'Coord. Teresina',
    modulo: 'Mobilização',
    tipo: 'mobilizacao',
  },
  {
    id: 'feed-2',
    hora: '19:15',
    acao: 'Disparou campanha "Mutirão Campo Maior"',
    responsavel: 'Comunicação',
    modulo: 'Disparos',
    tipo: 'disparo',
  },
  {
    id: 'feed-3',
    hora: '18:50',
    acao: 'Registrou visita ao Mercado Público',
    responsavel: 'Equipe campo',
    modulo: 'Território',
    tipo: 'visita',
  },
  {
    id: 'feed-4',
    hora: '18:22',
    acao: 'Atualizou expectativa de votos em Picos',
    responsavel: 'Coord. Picos',
    modulo: 'IPT',
    tipo: 'expectativa',
  },
  {
    id: 'feed-5',
    hora: '17:58',
    acao: 'Alerta: pesquisa de Parnaíba atrasada',
    responsavel: 'Sistema',
    modulo: 'Pesquisas',
    tipo: 'alerta',
  },
  {
    id: 'feed-6',
    hora: '17:30',
    acao: 'Publicou novo vídeo institucional',
    responsavel: 'Redes sociais',
    modulo: 'Conteúdo',
    tipo: 'conteudo',
  },
  {
    id: 'feed-7',
    hora: '16:45',
    acao: 'Solicitou reposição de bonés',
    responsavel: 'Logística',
    modulo: 'Materiais',
    tipo: 'material',
  },
  {
    id: 'feed-8',
    hora: '16:10',
    acao: 'Pesquisa de Campo Maior entregue pelo instituto',
    responsavel: 'Opinar',
    modulo: 'Pesquisas',
    tipo: 'pesquisa',
  },
  {
    id: 'feed-9',
    hora: '15:38',
    acao: 'Cadastrou nova liderança em Floriano',
    responsavel: 'Coord. Floriano',
    modulo: 'Território',
    tipo: 'visita',
  },
  {
    id: 'feed-10',
    hora: '14:55',
    acao: 'Alerta: CTR baixo em "Lives Regionais"',
    responsavel: 'Sistema',
    modulo: 'Disparos',
    tipo: 'alerta',
  },
]
