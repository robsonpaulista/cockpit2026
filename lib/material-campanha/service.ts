import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CampanhaMaterial,
  CampanhaMaterialMovimento,
  CampanhaMaterialPedido,
  MaterialMovimentoTipo,
  MaterialPedidoStatus,
} from '@/lib/material-campanha/types'
import { MATERIAL_PEDIDO_STATUS_ANDAMENTO, ordenarMateriaisExibicao } from '@/lib/material-campanha/types'

type Db = SupabaseClient

const PEDIDO_SELECT = `
  *,
  itens:campanha_material_pedido_itens(
    id, pedido_id, material_id, quantidade, quantidade_atendida, preco_unitario,
    material:campanha_materiais(id, nome, codigo, categoria, unidade, saldo, preco_compra)
  ),
  logs:campanha_material_pedido_logs(
    id, pedido_id, acao, status_anterior, status_novo, user_id, detalhe, created_at,
    usuario:profiles!campanha_material_pedido_logs_user_id_fkey(name, email)
  )
`

export function isMaterialCampanhaTableMissing(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return (
    error.code === '42P01' ||
    (msg.includes('campanha_materiais') && msg.includes('does not exist')) ||
    (msg.includes('schema cache') && msg.includes('campanha_'))
  )
}

export async function listarMateriais(
  supabase: Db,
  opts?: { includeInactive?: boolean }
): Promise<CampanhaMaterial[]> {
  let q = supabase
    .from('campanha_materiais')
    .select('*')
    .order('nome', { ascending: true })

  if (!opts?.includeInactive) q = q.eq('ativo', true)

  const { data, error } = await q
  if (error) throw error
  return ordenarMateriaisExibicao((data ?? []) as CampanhaMaterial[])
}

export async function criarMaterial(
  supabase: Db,
  input: {
    nome: string
    categoria: string
    unidade?: string
    codigo?: string | null
    descricao?: string | null
    estoque_minimo?: number
    preco_compra?: number
    saldo_inicial?: number
    userId?: string
  }
): Promise<CampanhaMaterial> {
  const saldoInicial = Math.max(0, Math.floor(input.saldo_inicial ?? 0))
  const preco = Math.max(0, Number(input.preco_compra ?? 0))
  const { data, error } = await supabase
    .from('campanha_materiais')
    .insert({
      nome: input.nome.trim(),
      categoria: input.categoria,
      unidade: input.unidade ?? 'un',
      codigo: input.codigo?.trim() || null,
      descricao: input.descricao?.trim() || null,
      estoque_minimo: Math.max(0, Math.floor(input.estoque_minimo ?? 0)),
      preco_compra: Number.isFinite(preco) ? preco : 0,
      saldo: saldoInicial,
      created_by: input.userId ?? null,
      updated_by: input.userId ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
  const material = data as CampanhaMaterial

  if (saldoInicial > 0) {
    await registrarMovimento(supabase, {
      materialId: material.id,
      tipo: 'entrada',
      quantidade: saldoInicial,
      motivo: 'Saldo inicial',
      userId: input.userId,
      skipSaldoUpdate: true,
      saldoAnteriorOverride: 0,
      saldoPosteriorOverride: saldoInicial,
    })
  }

  return material
}

export async function atualizarMaterial(
  supabase: Db,
  id: string,
  input: Partial<{
    nome: string
    categoria: string
    unidade: string
    codigo: string | null
    descricao: string | null
    estoque_minimo: number
    preco_compra: number
    ativo: boolean
    userId: string
  }>
): Promise<CampanhaMaterial> {
  const patch: Record<string, unknown> = { updated_by: input.userId ?? null }
  if (input.nome != null) patch.nome = input.nome.trim()
  if (input.categoria != null) patch.categoria = input.categoria
  if (input.unidade != null) patch.unidade = input.unidade
  if (input.codigo !== undefined) patch.codigo = input.codigo?.trim() || null
  if (input.descricao !== undefined) patch.descricao = input.descricao?.trim() || null
  if (input.estoque_minimo != null) patch.estoque_minimo = Math.max(0, Math.floor(input.estoque_minimo))
  if (input.preco_compra != null) {
    const preco = Math.max(0, Number(input.preco_compra))
    patch.preco_compra = Number.isFinite(preco) ? preco : 0
  }
  if (input.ativo != null) patch.ativo = input.ativo

  const { data, error } = await supabase
    .from('campanha_materiais')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as CampanhaMaterial
}

type RegistrarMovimentoInput = {
  materialId: string
  tipo: MaterialMovimentoTipo
  quantidade: number
  motivo?: string | null
  destino?: string | null
  origem?: string | null
  pedidoId?: string | null
  referenciaExterna?: string | null
  /** Preço unitário desta movimentação (R$). Em entrada, atualiza o custo do material. */
  precoUnitario?: number | null
  userId?: string
  /** Quando o saldo já foi gravado (ex.: saldo inicial no insert). */
  skipSaldoUpdate?: boolean
  saldoAnteriorOverride?: number
  saldoPosteriorOverride?: number
}

export async function registrarMovimento(
  supabase: Db,
  input: RegistrarMovimentoInput
): Promise<{ movimento: CampanhaMaterialMovimento; material: CampanhaMaterial }> {
  const qty = Math.floor(input.quantidade)
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Quantidade deve ser maior que zero')
  }

  const { data: material, error: mErr } = await supabase
    .from('campanha_materiais')
    .select('*')
    .eq('id', input.materialId)
    .single()

  if (mErr) throw mErr
  if (!material) throw new Error('Material não encontrado')
  if (!material.ativo) throw new Error('Material inativo')

  const saldoAnterior =
    input.saldoAnteriorOverride ?? (material.saldo as number)
  let saldoPosterior = saldoAnterior

  if (input.saldoPosteriorOverride != null) {
    saldoPosterior = input.saldoPosteriorOverride
  } else if (input.tipo === 'entrada') {
    saldoPosterior = saldoAnterior + qty
  } else if (input.tipo === 'saida') {
    if (saldoAnterior < qty) {
      throw new Error(
        `Saldo insuficiente (${saldoAnterior} disponível, pediu ${qty})`
      )
    }
    saldoPosterior = saldoAnterior - qty
  } else {
    // ajuste: quantidade = novo saldo absoluto
    saldoPosterior = qty
  }

  if (!input.skipSaldoUpdate) {
    const patchSaldo: Record<string, unknown> = {
      saldo: saldoPosterior,
      updated_by: input.userId ?? null,
    }

    // Entrada com preço: atualiza custo de compra do material (custo médio ponderado).
    if (
      input.tipo === 'entrada' &&
      input.precoUnitario != null &&
      Number.isFinite(input.precoUnitario) &&
      input.precoUnitario >= 0
    ) {
      const precoEntrada = Number(input.precoUnitario)
      const precoAtual = Number(material.preco_compra) || 0
      if (saldoAnterior <= 0 || precoAtual <= 0) {
        patchSaldo.preco_compra = precoEntrada
      } else {
        const medio =
          (saldoAnterior * precoAtual + qty * precoEntrada) / Math.max(saldoPosterior, 1)
        patchSaldo.preco_compra = Math.round(medio * 10000) / 10000
      }
    }

    const { error: uErr } = await supabase
      .from('campanha_materiais')
      .update(patchSaldo)
      .eq('id', input.materialId)
      .eq('saldo', saldoAnterior)

    if (uErr) throw uErr
  }

  const quantidadeMov =
    input.tipo === 'ajuste' ? Math.abs(saldoPosterior - saldoAnterior) || qty : qty

  const precoInformado =
    input.precoUnitario != null && Number.isFinite(input.precoUnitario)
      ? Math.max(0, Number(input.precoUnitario))
      : null
  const precoUnit =
    precoInformado ??
    (typeof material.preco_compra === 'number' && Number.isFinite(material.preco_compra)
      ? Number(material.preco_compra)
      : 0)
  const valorTotal =
    input.tipo === 'ajuste' ? null : Math.round(quantidadeMov * precoUnit * 100) / 100

  const { data: movimento, error: movErr } = await supabase
    .from('campanha_material_movimentos')
    .insert({
      material_id: input.materialId,
      tipo: input.tipo,
      quantidade: Math.max(1, quantidadeMov),
      saldo_anterior: saldoAnterior,
      saldo_posterior: saldoPosterior,
      motivo: input.motivo?.trim() || null,
      destino: input.destino?.trim() || null,
      origem: input.origem?.trim() || null,
      pedido_id: input.pedidoId ?? null,
      referencia_externa: input.referenciaExterna?.trim() || null,
      preco_unitario: input.tipo === 'ajuste' ? null : precoUnit,
      valor_total: valorTotal,
      created_by: input.userId ?? null,
    })
    .select(
      '*, material:campanha_materiais(id, nome, codigo, categoria, unidade, preco_compra)'
    )
    .single()

  if (movErr) throw movErr

  const { data: atualizado } = await supabase
    .from('campanha_materiais')
    .select('*')
    .eq('id', input.materialId)
    .single()

  return {
    movimento: movimento as CampanhaMaterialMovimento,
    material: (atualizado ?? material) as CampanhaMaterial,
  }
}

export async function listarMovimentos(
  supabase: Db,
  opts?: { materialId?: string; limite?: number }
): Promise<CampanhaMaterialMovimento[]> {
  const limite = Math.min(Math.max(opts?.limite ?? 50, 1), 200)
  let q = supabase
    .from('campanha_material_movimentos')
    .select(
      '*, material:campanha_materiais(id, nome, codigo, categoria, unidade, preco_compra)'
    )
    .order('created_at', { ascending: false })
    .limit(limite)

  if (opts?.materialId) q = q.eq('material_id', opts.materialId)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CampanhaMaterialMovimento[]
}

export async function listarPedidos(
  supabase: Db,
  opts?: { andamento?: boolean; limite?: number }
): Promise<CampanhaMaterialPedido[]> {
  const limite = Math.min(Math.max(opts?.limite ?? 40, 1), 100)
  let q = supabase
    .from('campanha_material_pedidos')
    .select(PEDIDO_SELECT)
    .order('created_at', { ascending: false })
    .limit(limite)

  if (opts?.andamento) {
    q = q.in('status', MATERIAL_PEDIDO_STATUS_ANDAMENTO)
  }

  const { data, error } = await q
  if (error) {
    // Tabela de logs ainda não criada → lista sem histórico
    if (/pedido_logs|campanha_material_pedido_logs/i.test(error.message ?? '')) {
      let q2 = supabase
        .from('campanha_material_pedidos')
        .select(
          `*,
          itens:campanha_material_pedido_itens(
            id, pedido_id, material_id, quantidade, quantidade_atendida, preco_unitario,
            material:campanha_materiais(id, nome, codigo, categoria, unidade, saldo, preco_compra)
          )`
        )
        .order('created_at', { ascending: false })
        .limit(limite)
      if (opts?.andamento) q2 = q2.in('status', MATERIAL_PEDIDO_STATUS_ANDAMENTO)
      const retry = await q2
      if (retry.error) throw retry.error
      return (retry.data ?? []) as CampanhaMaterialPedido[]
    }
    throw error
  }
  return ((data ?? []) as CampanhaMaterialPedido[]).map(ordenarLogsPedido)
}

function ordenarLogsPedido(pedido: CampanhaMaterialPedido): CampanhaMaterialPedido {
  const logs = [...(pedido.logs ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  return { ...pedido, logs }
}

async function registrarLogPedido(
  supabase: Db,
  input: {
    pedidoId: string
    acao: 'criado' | 'status_alterado'
    statusAnterior?: string | null
    statusNovo: string
    userId?: string | null
    detalhe?: string | null
  }
): Promise<void> {
  const { error } = await supabase.from('campanha_material_pedido_logs').insert({
    pedido_id: input.pedidoId,
    acao: input.acao,
    status_anterior: input.statusAnterior ?? null,
    status_novo: input.statusNovo,
    user_id: input.userId ?? null,
    detalhe: input.detalhe ?? null,
  })
  if (error) {
    // Não bloqueia o fluxo se a migration de logs ainda não rodou
    if (/pedido_logs|does not exist|schema cache/i.test(error.message ?? '')) {
      console.warn('Log de pedido não gravado (tabela ausente):', error.message)
      return
    }
    throw error
  }
}

export async function criarPedido(
  supabase: Db,
  input: {
    solicitanteNome?: string | null
    solicitanteTelefone?: string | null
    municipio?: string | null
    destino?: string | null
    observacao?: string | null
    origem?: 'app' | 'whatsapp' | 'manual'
    whatsappMessageId?: string | null
    userId?: string | null
    itens: Array<{ materialId: string; quantidade: number }>
  }
): Promise<CampanhaMaterialPedido> {
  if (!input.itens.length) throw new Error('Informe ao menos um item')

  const protocolo = `MAT-${Date.now().toString(36).toUpperCase()}`

  const { data: pedido, error } = await supabase
    .from('campanha_material_pedidos')
    .insert({
      protocolo,
      status: 'novo',
      solicitante_nome: input.solicitanteNome?.trim() || null,
      solicitante_telefone: input.solicitanteTelefone?.trim() || null,
      municipio: input.municipio?.trim() || null,
      destino: input.destino?.trim() || null,
      observacao: input.observacao?.trim() || null,
      origem: input.origem ?? 'app',
      whatsapp_message_id: input.whatsappMessageId ?? null,
      created_by: input.userId ?? null,
    })
    .select('*')
    .single()

  if (error) throw error

  const materialIds = [...new Set(input.itens.map((it) => it.materialId))]
  const { data: mats, error: mErr } = await supabase
    .from('campanha_materiais')
    .select('id, preco_compra')
    .in('id', materialIds)
  if (mErr) throw mErr
  const precoPorId = new Map(
    (mats ?? []).map((m) => [m.id as string, Number(m.preco_compra) || 0])
  )

  const rows = input.itens.map((it) => ({
    pedido_id: pedido.id,
    material_id: it.materialId,
    quantidade: Math.floor(it.quantidade),
    preco_unitario: precoPorId.get(it.materialId) ?? 0,
  }))

  const { error: iErr } = await supabase
    .from('campanha_material_pedido_itens')
    .insert(rows)

  if (iErr) throw iErr

  await registrarLogPedido(supabase, {
    pedidoId: pedido.id as string,
    acao: 'criado',
    statusNovo: 'novo',
    userId: input.userId,
    detalhe:
      input.origem === 'whatsapp'
        ? 'Pedido criado via WhatsApp'
        : input.origem === 'manual'
          ? 'Pedido criado manualmente'
          : 'Pedido criado pelo app',
  })

  const lista = await listarPedidos(supabase, { limite: 5 })
  const full = lista.find((p) => p.id === pedido.id)
  return full ?? (pedido as CampanhaMaterialPedido)
}

export async function atualizarStatusPedido(
  supabase: Db,
  pedidoId: string,
  status: MaterialPedidoStatus,
  userId?: string
): Promise<CampanhaMaterialPedido> {
  const { data: pedidoAtual, error: pErr } = await supabase
    .from('campanha_material_pedidos')
    .select('id, status, municipio, destino')
    .eq('id', pedidoId)
    .single()
  if (pErr) throw pErr
  if (!pedidoAtual) throw new Error('Pedido não encontrado')

  const statusAnterior = String(pedidoAtual.status)
  if (statusAnterior === status) {
    const lista = await listarPedidos(supabase, { limite: 80 })
    const full = lista.find((p) => p.id === pedidoId)
    if (full) return full
  }

  const patch: Record<string, unknown> = { status }

  if (status === 'entregue' || status === 'recusado' || status === 'cancelado') {
    patch.atendido_por = userId ?? null
    patch.atendido_em = new Date().toISOString()
  }

  // Ao entregar: baixa estoque dos itens (única forma de saída operacional)
  if (status === 'entregue') {
    if (statusAnterior !== 'separado') {
      throw new Error('Só é possível entregar pedidos na coluna Separado')
    }

    const { data: itens, error: iErr } = await supabase
      .from('campanha_material_pedido_itens')
      .select('*')
      .eq('pedido_id', pedidoId)

    if (iErr) throw iErr

    const destinoSaida =
      [pedidoAtual.municipio, pedidoAtual.destino].filter(Boolean).join(' — ') || null

    for (const item of itens ?? []) {
      const qtd = Number(item.quantidade) - Number(item.quantidade_atendida ?? 0)
      if (qtd <= 0) continue
      await registrarMovimento(supabase, {
        materialId: item.material_id as string,
        tipo: 'saida',
        quantidade: qtd,
        motivo: 'Entrega de pedido',
        destino: destinoSaida,
        pedidoId,
        userId,
        precoUnitario:
          item.preco_unitario != null ? Number(item.preco_unitario) : null,
      })
      await supabase
        .from('campanha_material_pedido_itens')
        .update({ quantidade_atendida: item.quantidade })
        .eq('id', item.id)
    }
  }

  const { error } = await supabase
    .from('campanha_material_pedidos')
    .update(patch)
    .eq('id', pedidoId)

  if (error) throw error

  await registrarLogPedido(supabase, {
    pedidoId,
    acao: 'status_alterado',
    statusAnterior,
    statusNovo: status,
    userId,
    detalhe: `${statusAnterior} → ${status}`,
  })

  const lista = await listarPedidos(supabase, { limite: 80 })
  const full = lista.find((p) => p.id === pedidoId)
  if (!full) throw new Error('Pedido atualizado, mas não foi possível recarregar')
  return full
}
