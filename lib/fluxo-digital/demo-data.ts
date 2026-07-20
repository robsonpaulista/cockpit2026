import type { FluxoDigitalResumo, FluxoEtapaId } from '@/lib/fluxo-digital/types'

const etapasOk = (parcial?: FluxoEtapaId[]): Record<FluxoEtapaId, 'ok' | 'parcial' | 'pendente'> => {
  const all: FluxoEtapaId[] = [
    'planejado',
    'produzido',
    'enviado',
    'divulgado',
    'visita',
    'pos_visita',
    'concluido',
  ]
  const set = new Set(parcial ?? [])
  return Object.fromEntries(
    all.map((id) => [id, set.has(id) ? 'parcial' : 'ok'])
  ) as Record<FluxoEtapaId, 'ok' | 'parcial' | 'pendente'>
}

const etapasAte = (ultimaOk: FluxoEtapaId): Record<FluxoEtapaId, 'ok' | 'parcial' | 'pendente'> => {
  const ordem: FluxoEtapaId[] = [
    'planejado',
    'produzido',
    'enviado',
    'divulgado',
    'visita',
    'pos_visita',
    'concluido',
  ]
  const idx = ordem.indexOf(ultimaOk)
  return Object.fromEntries(
    ordem.map((id, i) => {
      if (i < idx) return [id, 'ok']
      if (i === idx) return [id, 'parcial']
      return [id, 'pendente']
    })
  ) as Record<FluxoEtapaId, 'ok' | 'parcial' | 'pendente'>
}

const etapasNenhuma = (): Record<FluxoEtapaId, 'ok' | 'parcial' | 'pendente'> => ({
  planejado: 'pendente',
  produzido: 'pendente',
  enviado: 'pendente',
  divulgado: 'pendente',
  visita: 'pendente',
  pos_visita: 'pendente',
  concluido: 'pendente',
})

/** Dados de demonstração alinhados ao mock — serão substituídos por agregação real. */
export const FLUXO_DIGITAL_DEMO: FluxoDigitalResumo = {
  escopoLabel: 'Piauí — 224 municípios',
  periodoLabel: '13/07/2024 a 19/07/2024',
  atualizadoEm: 'hoje, 08:42',
  etapas: [
    { id: 'planejado', label: 'Planejado', cidades: 142, pct: 100 },
    { id: 'produzido', label: 'Produzido', cidades: 118, pct: 83 },
    { id: 'enviado', label: 'Enviado', cidades: 107, pct: 75 },
    { id: 'divulgado', label: 'Divulgado', cidades: 94, pct: 66 },
    { id: 'visita', label: 'Visita', cidades: 72, pct: 51 },
    { id: 'pos_visita', label: 'Pós-visita', cidades: 58, pct: 41 },
    { id: 'concluido', label: 'Concluído', cidades: 42, pct: 30 },
  ],
  kpis: [
    { id: 'pubs', label: 'Publicações', valor: '386', detalhe: 'total', deltaPct: 18 },
    { id: 'alcance', label: 'Alcance total', valor: '2,48M', detalhe: 'pessoas', deltaPct: 24 },
    { id: 'eng', label: 'Engajamento', valor: '184K', detalhe: 'interações', deltaPct: 21 },
    { id: 'cliques', label: 'Cliques / ações', valor: '23,7K', detalhe: 'ações', deltaPct: 15 },
    { id: 'invest', label: 'Investimento', valor: 'R$ 186,4K', detalhe: 'total investido', deltaPct: 11 },
  ],
  totalConteudos: 386,
  tipos: [
    { id: 'video', label: 'Vídeo', pct: 36, cor: '#2563eb' },
    { id: 'imagem', label: 'Imagem', pct: 28, cor: '#e28000' },
    { id: 'carrossel', label: 'Carrossel', pct: 16, cor: '#8b5cf6' },
    { id: 'stories', label: 'Stories', pct: 12, cor: '#06b6d4' },
    { id: 'reels', label: 'Reels', pct: 8, cor: '#22c55e' },
  ],
  municipios: [
    {
      municipio: 'Parnaíba',
      prioridade: 'Alta expectativa',
      etapas: etapasOk(),
      conteudos: 14,
      engajamento: 'alto',
    },
    {
      municipio: 'Picos',
      prioridade: 'Alta expectativa',
      etapas: etapasOk(['pos_visita']),
      conteudos: 11,
      engajamento: 'alto',
    },
    {
      municipio: 'São João do Piauí',
      etapas: etapasOk(),
      conteudos: 9,
      engajamento: 'medio',
    },
    {
      municipio: 'Pedro II',
      prioridade: 'Média',
      etapas: etapasNenhuma(),
      conteudos: 0,
      engajamento: 'baixo',
    },
    {
      municipio: 'Campo Maior',
      prioridade: 'Média',
      etapas: etapasAte('enviado'),
      conteudos: 3,
      engajamento: 'baixo',
    },
    {
      municipio: 'Floriano',
      prioridade: 'Alta expectativa',
      etapas: etapasAte('visita'),
      conteudos: 7,
      engajamento: 'medio',
    },
    {
      municipio: 'Piripiri',
      etapas: etapasAte('divulgado'),
      conteudos: 5,
      engajamento: 'medio',
    },
    {
      municipio: 'Oeiras',
      etapas: etapasOk(),
      conteudos: 8,
      engajamento: 'alto',
    },
  ],
  retornos: [
    { id: 'conversas', label: 'Conversas iniciadas', valor: '1.842', deltaPct: 20 },
    { id: 'cadastros', label: 'Cadastros gerados', valor: '623', deltaPct: 18 },
    { id: 'apoios', label: 'Apoios declarados', valor: '412', deltaPct: 22 },
    { id: 'site', label: 'Visitas ao site', valor: '8.764', deltaPct: 17 },
    { id: 'downloads', label: 'Downloads materiais', valor: '1.256', deltaPct: 19 },
  ],
  bandeiras: [
    { id: 'hospital-amor', nome: 'Hospital de Amor', pct: 92 },
    { id: 'saude', nome: 'Saúde', pct: 87 },
    { id: 'infra', nome: 'Infraestrutura', pct: 73 },
    { id: 'educacao', nome: 'Educação', pct: 61 },
    { id: 'eca', nome: 'ECA Digital', pct: 44 },
    { id: 'animais', nome: 'Animais', pct: 37 },
    { id: 'agricultura', nome: 'Agricultura', pct: 31 },
  ],
  destaques: [
    {
      id: '1',
      titulo: 'Entrega de ambulância',
      local: 'Parnaíba',
      data: '18/07',
      rede: 'instagram',
      alcance: '48K',
      curtidas: '3,2K',
    },
    {
      id: '2',
      titulo: 'Visita ao Hospital de Amor',
      local: 'Teresina',
      data: '17/07',
      rede: 'instagram',
      alcance: '62K',
      curtidas: '4,1K',
    },
    {
      id: '3',
      titulo: 'Obra de asfalto entregue',
      local: 'Picos',
      data: '16/07',
      rede: 'facebook',
      alcance: '31K',
      curtidas: '1,8K',
    },
    {
      id: '4',
      titulo: 'Agenda com lideranças',
      local: 'Floriano',
      data: '15/07',
      rede: 'instagram',
      alcance: '22K',
      curtidas: '980',
    },
    {
      id: '5',
      titulo: 'Prestação de contas',
      local: 'Oeiras',
      data: '14/07',
      rede: 'tiktok',
      alcance: '91K',
      curtidas: '6,4K',
    },
  ],
  acoes: [
    {
      id: 'envio',
      quantidade: 15,
      rotulo: 'cidades aguardando envio de conteúdo',
      tom: 'ok',
    },
    {
      id: 'divulgacao',
      quantidade: 22,
      rotulo: 'cidades sem divulgação pós-envio',
      tom: 'alerta',
    },
    {
      id: 'bandeiras',
      quantidade: 18,
      rotulo: 'bandeiras abaixo da média de desempenho',
      tom: 'info',
    },
  ],
}
