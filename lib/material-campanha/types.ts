export const MATERIAL_CATEGORIAS = [
  'panfleto',
  'praguinha',
  'adesivo',
  'bandeira',
  'banner',
  'camiseta',
  'bone',
  'outro',
] as const

export type MaterialCategoria = (typeof MATERIAL_CATEGORIAS)[number]

export const MATERIAL_UNIDADES = ['un', 'pct', 'cx', 'kit', 'm'] as const
export type MaterialUnidade = (typeof MATERIAL_UNIDADES)[number]

export const MATERIAL_MOVIMENTO_TIPOS = ['entrada', 'saida', 'ajuste'] as const
export type MaterialMovimentoTipo = (typeof MATERIAL_MOVIMENTO_TIPOS)[number]

export const MATERIAL_PEDIDO_STATUS = [
  'novo',
  'em_analise',
  'aprovado',
  'separado',
  'entregue',
  'recusado',
  'cancelado',
] as const

export type MaterialPedidoStatus = (typeof MATERIAL_PEDIDO_STATUS)[number]

export const MATERIAL_PEDIDO_ORIGENS = ['app', 'whatsapp', 'manual'] as const
export type MaterialPedidoOrigem = (typeof MATERIAL_PEDIDO_ORIGENS)[number]

/** Status que ainda pedem ação na fila operacional. */
export const MATERIAL_PEDIDO_STATUS_ANDAMENTO: MaterialPedidoStatus[] = [
  'novo',
  'em_analise',
  'aprovado',
  'separado',
]

export type CampanhaMaterial = {
  id: string
  codigo: string | null
  nome: string
  categoria: MaterialCategoria
  unidade: MaterialUnidade
  descricao: string | null
  estoque_minimo: number
  /** Custo de aquisição por unidade (R$). */
  preco_compra: number
  saldo: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export type CampanhaMaterialMovimento = {
  id: string
  material_id: string
  tipo: MaterialMovimentoTipo
  quantidade: number
  saldo_anterior: number
  saldo_posterior: number
  motivo: string | null
  destino: string | null
  origem: string | null
  pedido_id: string | null
  referencia_externa: string | null
  preco_unitario: number | null
  valor_total: number | null
  created_by: string | null
  created_at: string
  material?: Pick<CampanhaMaterial, 'id' | 'nome' | 'codigo' | 'categoria' | 'unidade' | 'preco_compra'> | null
}

export type CampanhaMaterialPedidoItem = {
  id: string
  pedido_id: string
  material_id: string
  quantidade: number
  quantidade_atendida: number
  preco_unitario: number
  material?: Pick<
    CampanhaMaterial,
    'id' | 'nome' | 'codigo' | 'categoria' | 'unidade' | 'saldo' | 'preco_compra'
  > | null
}

export type CampanhaMaterialPedido = {
  id: string
  protocolo: string | null
  status: MaterialPedidoStatus
  solicitante_nome: string | null
  solicitante_telefone: string | null
  municipio: string | null
  destino: string | null
  observacao: string | null
  origem: MaterialPedidoOrigem
  whatsapp_message_id: string | null
  atendido_por: string | null
  atendido_em: string | null
  created_at: string
  updated_at: string
  itens?: CampanhaMaterialPedidoItem[]
  logs?: CampanhaMaterialPedidoLog[]
}

export type CampanhaMaterialPedidoLog = {
  id: string
  pedido_id: string
  acao: 'criado' | 'status_alterado'
  status_anterior: string | null
  status_novo: string
  user_id: string | null
  detalhe: string | null
  created_at: string
  usuario?: { name: string | null; email: string | null } | null
}

export const MATERIAL_CATEGORIA_LABEL: Record<MaterialCategoria, string> = {
  panfleto: 'Panfleto',
  praguinha: 'Praguinha',
  adesivo: 'Adesivo',
  bandeira: 'Bandeira',
  banner: 'Banner',
  camiseta: 'Camiseta',
  bone: 'Boné',
  outro: 'Outro',
}

export const MATERIAL_PEDIDO_STATUS_LABEL: Record<MaterialPedidoStatus, string> = {
  novo: 'Novo',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  separado: 'Separado',
  entregue: 'Entregue',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
}

export const MATERIAL_MOVIMENTO_TIPO_LABEL: Record<MaterialMovimentoTipo, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste',
}

/** Verbo da etapa para o log (quem fez o quê). */
export function labelAcaoPedidoLog(statusNovo: string, acao?: string): string {
  if (acao === 'criado' || statusNovo === 'novo') return 'Criou o pedido'
  if (statusNovo === 'em_analise') return 'Analisou'
  if (statusNovo === 'aprovado') return 'Aprovou'
  if (statusNovo === 'separado') return 'Separou'
  if (statusNovo === 'entregue') return 'Entregou'
  if (statusNovo === 'recusado') return 'Recusou'
  if (statusNovo === 'cancelado') return 'Cancelou'
  return 'Atualizou status'
}

export function nomeUsuarioPedidoLog(
  log: Pick<CampanhaMaterialPedidoLog, 'usuario' | 'user_id'>
): string {
  const nome = log.usuario?.name?.trim()
  if (nome) return nome
  const email = log.usuario?.email?.trim()
  if (email) return email
  if (log.user_id) return 'Usuário do sistema'
  return 'Sistema / automação'
}

export function isMaterialBaixoEstoque(m: Pick<CampanhaMaterial, 'saldo' | 'estoque_minimo'>): boolean {
  return m.saldo <= m.estoque_minimo
}

export function formatMaterialPreco(value: number | null | undefined): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return 'R$ 0,00'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Valor de um item = quantidade × preço unitário (snapshot ou atual). */
export function valorItemMaterial(
  quantidade: number,
  precoUnitario: number | null | undefined
): number {
  const q = Number(quantidade) || 0
  const p = Number(precoUnitario) || 0
  return Math.round(q * p * 100) / 100
}

export function valorPedidoMaterial(pedido: CampanhaMaterialPedido): number {
  return (pedido.itens ?? []).reduce((sum, it) => {
    const preco = it.preco_unitario ?? it.material?.preco_compra ?? 0
    return sum + valorItemMaterial(it.quantidade, preco)
  }, 0)
}
