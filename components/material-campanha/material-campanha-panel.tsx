'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  IconAlertTriangle,
  IconArrowDownLeft,
  IconHistory,
  IconPackage,
  IconPlus,
  IconRefresh,
  IconX,
} from '@tabler/icons-react'
import {
  DashboardPageChrome,
  DashboardPageHeader,
  dashboardPageBgClass,
} from '@/components/dashboard/dashboard-page-chrome'
import { cn } from '@/lib/utils'
import {
  isMaterialBaixoEstoque,
  MATERIAL_CATEGORIA_LABEL,
  MATERIAL_CATEGORIAS,
  MATERIAL_MOVIMENTO_TIPO_LABEL,
  MATERIAL_UNIDADES,
  type CampanhaMaterial,
  type CampanhaMaterialMovimento,
  type CampanhaMaterialPedido,
  type MaterialCategoria,
  type MaterialMovimentoTipo,
  type MaterialPedidoStatus,
  type MaterialUnidade,
} from '@/lib/material-campanha/types'
import {
  isPedidoMockId,
  MATERIAL_PEDIDOS_MOCK,
} from '@/lib/material-campanha/mock-pedidos'
import { MaterialPedidosKanban } from '@/components/material-campanha/material-pedidos-kanban'

type ModalKind = 'material' | 'movimento' | 'historico' | null

export function MaterialCampanhaPanel() {
  const [materiais, setMateriais] = useState<CampanhaMaterial[]>([])
  const [pedidos, setPedidos] = useState<CampanhaMaterialPedido[]>([])
  const [movimentos, setMovimentos] = useState<CampanhaMaterialMovimento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableMissing, setTableMissing] = useState(false)
  const [modal, setModal] = useState<ModalKind>(null)
  const [saving, setSaving] = useState(false)

  // form material
  const [editId, setEditId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [categoria, setCategoria] = useState<MaterialCategoria>('panfleto')
  const [unidade, setUnidade] = useState<MaterialUnidade>('un')
  const [estoqueMin, setEstoqueMin] = useState('0')
  const [precoCompra, setPrecoCompra] = useState('0')
  const [saldoInicial, setSaldoInicial] = useState('0')
  const [descricao, setDescricao] = useState('')

  // form movimento
  const [movMaterialId, setMovMaterialId] = useState('')
  const [movTipo, setMovTipo] = useState<MaterialMovimentoTipo>('entrada')
  const [movQtd, setMovQtd] = useState('')
  const [movPreco, setMovPreco] = useState('')
  const [movMotivo, setMovMotivo] = useState('')
  const [movDestino, setMovDestino] = useState('')
  const [filtroMaterialId, setFiltroMaterialId] = useState<string | null>(null)
  const solicitacoesRef = useRef<HTMLElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rMat, rPed, rMov] = await Promise.all([
        fetch('/api/material-campanha/materiais'),
        fetch('/api/material-campanha/pedidos?andamento=1'),
        fetch('/api/material-campanha/movimentos?limite=30'),
      ])

      if (rMat.headers.get('X-Material-Campanha') === 'table-missing') {
        setTableMissing(true)
        setMateriais([])
        setPedidos([])
        setMovimentos([])
        return
      }
      setTableMissing(false)

      if (!rMat.ok) throw new Error((await rMat.json()).error ?? 'Erro ao carregar materiais')
      if (!rPed.ok) throw new Error((await rPed.json()).error ?? 'Erro ao carregar pedidos')
      if (!rMov.ok) throw new Error((await rMov.json()).error ?? 'Erro ao carregar movimentos')

      setMateriais(await rMat.json())
      setPedidos(await rPed.json())
      setMovimentos(await rMov.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (filtroMaterialId && !materiais.some((m) => m.id === filtroMaterialId)) {
      setFiltroMaterialId(null)
    }
  }, [materiais, filtroMaterialId])

  const pedidosBase = useMemo(
    () => (pedidos.length > 0 ? pedidos : MATERIAL_PEDIDOS_MOCK),
    [pedidos]
  )
  const materialFiltro = useMemo(
    () => materiais.find((m) => m.id === filtroMaterialId) ?? null,
    [materiais, filtroMaterialId]
  )
  const pedidosExibidos = useMemo(() => {
    if (!materialFiltro) return pedidosBase
    return pedidosBase.filter((p) =>
      (p.itens ?? []).some(
        (it) =>
          it.material_id === materialFiltro.id ||
          (materialFiltro.codigo &&
            it.material?.codigo &&
            it.material.codigo.toLowerCase() === materialFiltro.codigo.toLowerCase()) ||
          (it.material?.nome &&
            it.material.nome.trim().toLowerCase() === materialFiltro.nome.trim().toLowerCase())
      )
    )
  }, [pedidosBase, materialFiltro])
  const usandoMockPedidos = pedidos.length === 0 && !tableMissing && !loading

  const selecionarMaterialFiltro = (m: CampanhaMaterial) => {
    setFiltroMaterialId((prev) => (prev === m.id ? null : m.id))
    // Leva o olhar para o Kanban após o clique
    window.setTimeout(() => {
      solicitacoesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const openNovoMaterial = () => {
    setEditId(null)
    setNome('')
    setCodigo('')
    setCategoria('panfleto')
    setUnidade('un')
    setEstoqueMin('0')
    setPrecoCompra('0')
    setSaldoInicial('0')
    setDescricao('')
    setModal('material')
  }

  const openEditMaterial = (m: CampanhaMaterial) => {
    setEditId(m.id)
    setNome(m.nome)
    setCodigo(m.codigo ?? '')
    setCategoria(m.categoria)
    setUnidade(m.unidade)
    setEstoqueMin(String(m.estoque_minimo))
    setPrecoCompra(String(m.preco_compra ?? 0))
    setSaldoInicial('0')
    setDescricao(m.descricao ?? '')
    setModal('material')
  }

  const openMovimento = (tipo: MaterialMovimentoTipo, materialId?: string) => {
    const id = materialId ?? materiais[0]?.id ?? ''
    const mat = materiais.find((m) => m.id === id)
    setMovTipo(tipo)
    setMovMaterialId(id)
    setMovQtd('')
    setMovPreco(mat ? String(mat.preco_compra ?? 0) : '')
    setMovMotivo('')
    setMovDestino('')
    setModal('movimento')
  }

  const saveMaterial = async () => {
    setSaving(true)
    setError(null)
    try {
      if (editId) {
        const res = await fetch(`/api/material-campanha/materiais/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome,
            codigo: codigo || null,
            categoria,
            unidade,
            estoque_minimo: Number(estoqueMin) || 0,
            preco_compra: Number(String(precoCompra).replace(',', '.')) || 0,
            descricao: descricao || null,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao salvar')
      } else {
        const res = await fetch('/api/material-campanha/materiais', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome,
            codigo: codigo || null,
            categoria,
            unidade,
            estoque_minimo: Number(estoqueMin) || 0,
            preco_compra: Number(String(precoCompra).replace(',', '.')) || 0,
            saldo_inicial: Number(saldoInicial) || 0,
            descricao: descricao || null,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao criar')
      }
      setModal(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar material')
    } finally {
      setSaving(false)
    }
  }

  const saveMovimento = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/material-campanha/movimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: movMaterialId,
          tipo: movTipo,
          quantidade: Number(movQtd),
          motivo: movMotivo || null,
          destino: movTipo === 'entrada' ? movDestino || null : null,
          origem: movTipo === 'entrada' ? movDestino || null : null,
          precoUnitario:
            movTipo === 'entrada' && movPreco.trim() !== ''
              ? Number(String(movPreco).replace(',', '.'))
              : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao registrar')
      setModal(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro no movimento')
    } finally {
      setSaving(false)
    }
  }

  const updatePedidoStatus = async (id: string, status: MaterialPedidoStatus) => {
    if (isPedidoMockId(id)) {
      setError('Estes pedidos são só demonstração. Crie um pedido real (ou via WhatsApp) para movimentar.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/material-campanha/pedidos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao atualizar pedido')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro no pedido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', dashboardPageBgClass)}>
      <DashboardPageChrome>
        <DashboardPageHeader
          title="Gestão de Material"
          description="Panfletos, praguinhas, adesivos e demais materiais — saldo, entradas, saídas e solicitações."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 rounded-full border border-card bg-surface px-3 py-1.5 text-xs font-medium text-text-primary"
              >
                <IconRefresh className={cn('h-3.5 w-3.5', loading && 'animate-spin')} stroke={1.5} />
                Atualizar
              </button>
              <button
                type="button"
                onClick={() => openMovimento('entrada')}
                disabled={!materiais.length}
                className="inline-flex items-center gap-1.5 rounded-full border border-card bg-surface px-3 py-1.5 text-xs font-medium text-text-primary disabled:opacity-40"
              >
                <IconArrowDownLeft className="h-3.5 w-3.5" stroke={1.5} />
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setModal('historico')}
                className="inline-flex items-center gap-1.5 rounded-full border border-card bg-surface px-3 py-1.5 text-xs font-medium text-text-primary"
              >
                <IconHistory className="h-3.5 w-3.5" stroke={1.5} />
                Histórico
              </button>
              <button
                type="button"
                onClick={openNovoMaterial}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#ff9800] bg-[#ff9800] px-3 py-1.5 text-xs font-medium text-black"
              >
                <IconPlus className="h-3.5 w-3.5" stroke={1.5} />
                Novo material
              </button>
            </div>
          }
        />
      </DashboardPageChrome>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-6">
        {tableMissing ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-text-primary">
            Tabelas ainda não existem no Supabase. Rode{' '}
            <code className="rounded bg-black/5 px-1">database/create-material-campanha.sql</code>.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-status-error/30 bg-status-error/10 p-3 text-sm text-status-error">
            {error}
          </div>
        ) : null}

        <section>
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Estoque</h2>
              <p className="text-xs text-text-secondary">
                Clique no card para filtrar as solicitações daquele material
              </p>
            </div>
          </div>

          {loading && !materiais.length ? (
            <p className="text-sm text-text-secondary">Carregando…</p>
          ) : !materiais.length ? (
            <div className="rounded-2xl border border-dashed border-card px-4 py-10 text-center text-sm text-text-secondary">
              Nenhum material cadastrado. Clique em <strong>Novo material</strong>.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {materiais.map((m) => {
                const baixo = isMaterialBaixoEstoque(m)
                const selecionado = filtroMaterialId === m.id
                return (
                  <article
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selecionarMaterialFiltro(m)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        selecionarMaterialFiltro(m)
                      }
                    }}
                    className={cn(
                      'flex cursor-pointer flex-col rounded-xl border bg-surface p-2.5 shadow-card outline-none transition-shadow',
                      'hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#ff9800]/40',
                      selecionado
                        ? 'border-[#ff9800] ring-2 ring-[#ff9800]/25'
                        : baixo
                          ? 'border-amber-500/50'
                          : 'border-card'
                    )}
                  >
                    <div className="flex items-start gap-1.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#ff9800]/12 text-[#ff9800]">
                        <IconPackage className="h-3.5 w-3.5" stroke={1.5} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[12.5px] font-semibold leading-tight text-text-primary">
                          {m.nome}
                        </h3>
                        <p className="truncate text-[10px] text-text-secondary">
                          {MATERIAL_CATEGORIA_LABEL[m.categoria]}
                          {m.codigo ? ` · ${m.codigo}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-end justify-between gap-1">
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-text-secondary">
                          Saldo
                        </p>
                        <p className="text-lg font-semibold leading-none tabular-nums text-text-primary">
                          {m.saldo.toLocaleString('pt-BR')}
                          <span className="ml-0.5 text-[10px] font-normal text-text-secondary">
                            {m.unidade}
                          </span>
                        </p>
                      </div>
                      {baixo ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-text-primary">
                          <IconAlertTriangle className="h-2.5 w-2.5" stroke={1.5} />
                          Mín. {m.estoque_minimo}
                        </span>
                      ) : (
                        <span className="text-[9px] text-text-secondary">
                          Mín. {m.estoque_minimo}
                        </span>
                      )}
                    </div>

                    <div
                      className="mt-2 flex flex-wrap gap-1 border-t border-card pt-2"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => openMovimento('entrada', m.id)}
                        className="rounded-full border border-card px-1.5 py-0.5 text-[10px] text-text-primary hover:bg-black/[0.03]"
                      >
                        + Entrada
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditMaterial(m)}
                        className="rounded-full border border-card px-1.5 py-0.5 text-[10px] text-text-primary hover:bg-black/[0.03]"
                      >
                        Editar
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section ref={solicitacoesRef}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Solicitações em andamento</h2>
              <p className="text-xs text-text-secondary">
                {materialFiltro ? (
                  <>
                    Filtrando por <strong>{materialFiltro.nome}</strong>
                    {pedidosExibidos.length === 0
                      ? ' — nenhuma solicitação com este material.'
                      : ` — ${pedidosExibidos.length} pedido(s).`}
                  </>
                ) : (
                  <>
                    Fluxo Kanban — a <strong>saída</strong> só ocorre ao marcar{' '}
                <strong>Entregar</strong> em Separado.
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {materialFiltro ? (
                <button
                  type="button"
                  onClick={() => setFiltroMaterialId(null)}
                  className="inline-flex items-center gap-1 rounded-full border border-card px-2.5 py-0.5 text-[10px] font-medium text-text-primary hover:bg-black/[0.03]"
                >
                  <IconX className="h-3 w-3" stroke={1.5} />
                  Limpar filtro
                </button>
              ) : null}
              {usandoMockPedidos ? (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-medium text-text-primary">
                  Demonstração
                </span>
              ) : null}
            </div>
          </div>

          {!pedidosExibidos.length ? (
            <div className="rounded-2xl border border-dashed border-card px-4 py-8 text-center text-sm text-text-secondary">
              {materialFiltro
                ? `Nenhuma solicitação em andamento com “${materialFiltro.nome}”.`
                : 'Nenhuma solicitação em andamento.'}
            </div>
          ) : (
            <MaterialPedidosKanban
              pedidos={pedidosExibidos}
              saving={saving}
              onAvancar={(id, status) => void updatePedidoStatus(id, status)}
              onRecusar={(id) => void updatePedidoStatus(id, 'recusado')}
            />
          )}
        </section>
      </div>

      {modal === 'material' ? (
        <ModalShell title={editId ? 'Editar material' : 'Novo material'} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <Field label="Nome">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Código">
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
                  placeholder="PANF-01"
                />
              </Field>
              <Field label="Categoria">
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as MaterialCategoria)}
                  className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
                >
                  {MATERIAL_CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {MATERIAL_CATEGORIA_LABEL[c]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Unidade">
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value as MaterialUnidade)}
                  className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
                >
                  {MATERIAL_UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Estoque mínimo">
                <input
                  type="number"
                  min={0}
                  value={estoqueMin}
                  onChange={(e) => setEstoqueMin(e.target.value)}
                  className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <Field label="Preço de compra (R$ / unidade)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={precoCompra}
                onChange={(e) => setPrecoCompra(e.target.value)}
                className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
                placeholder="0,00"
              />
            </Field>
            {!editId ? (
              <Field label="Saldo inicial">
                <input
                  type="number"
                  min={0}
                  value={saldoInicial}
                  onChange={(e) => setSaldoInicial(e.target.value)}
                  className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
                />
              </Field>
            ) : null}
            <Field label="Descrição">
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="rounded-full px-3 py-1.5 text-sm">
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving || !nome.trim()}
                onClick={() => void saveMaterial()}
                className="rounded-full bg-[#ff9800] px-4 py-1.5 text-sm font-medium text-black disabled:opacity-40"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {modal === 'movimento' ? (
        <ModalShell
          title={`${MATERIAL_MOVIMENTO_TIPO_LABEL[movTipo]} de estoque`}
          onClose={() => setModal(null)}
        >
          <div className="space-y-3">
            <Field label="Material">
              <select
                value={movMaterialId}
                onChange={(e) => {
                  const id = e.target.value
                  setMovMaterialId(id)
                  const mat = materiais.find((m) => m.id === id)
                  if (mat) setMovPreco(String(mat.preco_compra ?? 0))
                }}
                className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
              >
                {materiais.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} (saldo {m.saldo})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo">
              <select
                value={movTipo}
                onChange={(e) => setMovTipo(e.target.value as MaterialMovimentoTipo)}
                className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
              >
                <option value="entrada">Entrada</option>
                <option value="ajuste">Ajuste (definir saldo absoluto)</option>
              </select>
            </Field>
            <Field label={movTipo === 'ajuste' ? 'Novo saldo' : 'Quantidade'}>
              <input
                type="number"
                min={1}
                value={movQtd}
                onChange={(e) => setMovQtd(e.target.value)}
                className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
              />
            </Field>
            {movTipo === 'entrada' ? (
              <Field label="Preço de compra (R$ / unidade)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={movPreco}
                  onChange={(e) => setMovPreco(e.target.value)}
                  className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
                  placeholder="0,00"
                />
                <span className="mt-1 block text-[10px] text-text-secondary">
                  Atualiza o custo do material (média ponderada com o estoque atual).
                </span>
              </Field>
            ) : null}
            <Field label={movTipo === 'entrada' ? 'Origem / fornecedor' : 'Motivo do ajuste'}>
              <input
                value={movDestino}
                onChange={(e) => setMovDestino(e.target.value)}
                className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Motivo">
              <input
                value={movMotivo}
                onChange={(e) => setMovMotivo(e.target.value)}
                className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="rounded-full px-3 py-1.5 text-sm">
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving || !movMaterialId || !Number(movQtd)}
                onClick={() => void saveMovimento()}
                className="rounded-full bg-[#ff9800] px-4 py-1.5 text-sm font-medium text-black disabled:opacity-40"
              >
                {saving ? 'Registrando…' : 'Registrar'}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {modal === 'historico' ? (
        <ModalShell title="Histórico de movimentações" onClose={() => setModal(null)} wide>
          {!movimentos.length ? (
            <p className="text-sm text-text-secondary">Nenhuma movimentação ainda.</p>
          ) : (
            <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
              {movimentos.map((mov) => (
                <li
                  key={mov.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-card px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-medium text-text-primary">
                      {MATERIAL_MOVIMENTO_TIPO_LABEL[mov.tipo]} ·{' '}
                      {mov.material?.nome ?? mov.material_id}
                    </p>
                    <p className="text-text-secondary">
                      {new Date(mov.created_at).toLocaleString('pt-BR')}
                      {mov.motivo ? ` · ${mov.motivo}` : ''}
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="font-semibold text-text-primary">
                      {mov.tipo === 'entrada' ? '+' : mov.tipo === 'saida' ? '−' : '→'}
                      {mov.quantidade.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-text-secondary">
                      {mov.saldo_anterior} → {mov.saldo_posterior}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ModalShell>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  )
}

function ModalShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full rounded-2xl border border-card bg-surface shadow-card',
          wide ? 'max-w-xl' : 'max-w-md'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-card px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-black/5" aria-label="Fechar">
            <IconX className="h-4 w-4" stroke={1.5} />
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
      </div>
    </div>
  )
}
