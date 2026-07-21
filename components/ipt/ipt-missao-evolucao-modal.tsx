'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, Loader2, X } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import type { IptMunicipio } from '@/lib/ipt'
import {
  IPT_MISSOES,
  iptMissaoConfig,
  type IptMissaoId,
  type IptMissaoMudancaSentido,
} from '@/lib/ipt-missoes'
import {
  alertaMissaoEvento,
  carregarEventosMissao,
  IPT_MISSAO_ALERTA_COR,
  IPT_MISSAO_ALERTA_LABEL,
  labelSentidoMissao,
  leituraComparativoEvento,
  type IptMissaoAlertaNivel,
  type IptMissaoEvento,
} from '@/lib/ipt-missao-evolucao'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  municipios: IptMunicipio[]
  /** Quando muda (após sync), refaz o fetch. */
  refreshToken?: number
}

type GrupoMissao = {
  missao: IptMissaoId
  eventos: IptMissaoEvento[]
  entrou: number
  saiu: number
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function IptMissaoEvolucaoModal({ open, onClose, municipios, refreshToken = 0 }: Props) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [eventos, setEventos] = useState<IptMissaoEvento[]>([])
  const [filtroMissao, setFiltroMissao] = useState<IptMissaoId | 'todas'>('todas')
  const [filtroSentido, setFiltroSentido] = useState<IptMissaoMudancaSentido | 'todos'>('todos')
  const [filtroAlerta, setFiltroAlerta] = useState<IptMissaoAlertaNivel | 'todos'>('todos')
  const [filtroMunicipio, setFiltroMunicipio] = useState<string>('')
  const [busca, setBusca] = useState<string>('')
  const [gruposAbertos, setGruposAbertos] = useState<Partial<Record<IptMissaoId, boolean>>>({})

  const municipiosOpcoes = useMemo(
    () => [...municipios].map((m) => m.municipio).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [municipios]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    void carregarEventosMissao({
      missao: filtroMissao,
      sentido: filtroSentido,
      municipio: filtroMunicipio || undefined,
      limit: 400,
    }).then((lista) => {
      if (!cancelled) {
        setEventos(lista)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, filtroMissao, filtroSentido, filtroMunicipio, refreshToken])

  const filtrados = useMemo(() => {
    const q = busca
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    return eventos.filter((e) => {
      if (filtroAlerta !== 'todos' && alertaMissaoEvento(e).nivel !== filtroAlerta) return false
      if (!q) return true
      const comp = leituraComparativoEvento(e)
      const alerta = alertaMissaoEvento(e)
      const blob = `${e.municipio} ${e.motivo} ${e.missao} ${comp.metrica} ${comp.anterior} ${comp.atual} ${alerta.titulo}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return blob.includes(q)
    })
  }, [eventos, busca, filtroAlerta])

  const grupos = useMemo((): GrupoMissao[] => {
    const byMissao = new Map<IptMissaoId, IptMissaoEvento[]>()
    for (const e of filtrados) {
      const list = byMissao.get(e.missao) ?? []
      list.push(e)
      byMissao.set(e.missao, list)
    }
    return IPT_MISSOES.map((cfg) => {
      const lista = (byMissao.get(cfg.id) ?? []).slice().sort((a, b) => {
        if (a.createdAt !== b.createdAt) return b.createdAt.localeCompare(a.createdAt)
        return a.municipio.localeCompare(b.municipio, 'pt-BR')
      })
      let entrou = 0
      let saiu = 0
      for (const e of lista) {
        if (e.sentido === 'entrou') entrou += 1
        else saiu += 1
      }
      return { missao: cfg.id, eventos: lista, entrou, saiu }
    }).filter((g) => g.eventos.length > 0)
  }, [filtrados])

  const gruposKey = grupos.map((g) => g.missao).join('|')
  useEffect(() => {
    if (!gruposKey) return
    setGruposAbertos((prev) => {
      const next: Partial<Record<IptMissaoId, boolean>> = { ...prev }
      for (const id of gruposKey.split('|') as IptMissaoId[]) {
        if (next[id] == null) next[id] = true
      }
      return next
    })
  }, [gruposKey])

  const resumo = useMemo(() => {
    let entrou = 0
    let saiu = 0
    let criticos = 0
    let atencoes = 0
    let positivos = 0
    for (const e of filtrados) {
      if (e.sentido === 'entrou') entrou += 1
      else saiu += 1
      const nivel = alertaMissaoEvento(e).nivel
      if (nivel === 'critico') criticos += 1
      else if (nivel === 'atencao') atencoes += 1
      else positivos += 1
    }
    return { entrou, saiu, criticos, atencoes, positivos, total: filtrados.length }
  }, [filtrados])

  const toggleGrupo = (missao: IptMissaoId) => {
    setGruposAbertos((prev) => ({
      ...prev,
      [missao]: !(prev[missao] ?? true),
    }))
  }

  const expandirTodos = () => {
    const next: Partial<Record<IptMissaoId, boolean>> = {}
    for (const g of grupos) next[g.missao] = true
    setGruposAbertos(next)
  }

  const recolherTodos = () => {
    const next: Partial<Record<IptMissaoId, boolean>> = {}
    for (const g of grupos) next[g.missao] = false
    setGruposAbertos(next)
  }

  if (!open || !mounted) return null

  return createPortal(
    <div className="ipt-foco-modal" role="presentation">
      <button type="button" className="ipt-foco-modal__backdrop" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ipt-evolucao-titulo"
        className="ipt-foco-modal__panel ipt-evolucao-modal__panel"
      >
        <div className="ipt-foco-modal__head">
          <div>
            <p className="ipt-foco-modal__eyebrow">Sala de guerra</p>
            <h2 id="ipt-evolucao-titulo" className="ipt-foco-modal__title">
              Evolução das missões
            </h2>
          </div>
          <button type="button" className="ipt-foco-modal__close" onClick={onClose} aria-label="Fechar">
            <CockpitIcon icon={X} size="sm" />
          </button>
        </div>

        <p className="ipt-foco-modal__lead">
          Alertas automáticos por município: 🔴 crítico pede ação imediata, 🟡 atenção pede
          acompanhamento e 🟢 positivo registra vitória — sempre com o valor anterior e o atual.
        </p>

        <div className="ipt-evolucao-modal__filters">
          <label className="ipt-evolucao-modal__field">
            <span>Missão</span>
            <select
              value={filtroMissao}
              onChange={(e) => setFiltroMissao(e.target.value as IptMissaoId | 'todas')}
            >
              <option value="todas">Todas</option>
              {IPT_MISSOES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.titulo}
                </option>
              ))}
            </select>
          </label>
          <label className="ipt-evolucao-modal__field">
            <span>Movimento</span>
            <select
              value={filtroSentido}
              onChange={(e) =>
                setFiltroSentido(e.target.value as IptMissaoMudancaSentido | 'todos')
              }
            >
              <option value="todos">Todos</option>
              <option value="entrou">Entrou</option>
              <option value="saiu">Saiu</option>
            </select>
          </label>
          <label className="ipt-evolucao-modal__field">
            <span>Alerta</span>
            <select
              value={filtroAlerta}
              onChange={(e) => setFiltroAlerta(e.target.value as IptMissaoAlertaNivel | 'todos')}
            >
              <option value="todos">Todos</option>
              <option value="critico">🔴 Crítico</option>
              <option value="atencao">🟡 Atenção</option>
              <option value="positivo">🟢 Positivo</option>
            </select>
          </label>
          <label className="ipt-evolucao-modal__field ipt-evolucao-modal__field--wide">
            <span>Município</span>
            <select
              value={filtroMunicipio}
              onChange={(e) => setFiltroMunicipio(e.target.value)}
            >
              <option value="">Todos</option>
              {municipiosOpcoes.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <label className="ipt-evolucao-modal__field ipt-evolucao-modal__field--wide">
            <span>Busca</span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Município, métrica ou motivo…"
            />
          </label>
        </div>

        <div className="ipt-evolucao-modal__summary">
          <span>{resumo.total} eventos</span>
          <span className="ipt-evolucao-modal__pill ipt-evolucao-modal__pill--critico">
            🔴 {resumo.criticos} crítico{resumo.criticos === 1 ? '' : 's'}
          </span>
          <span className="ipt-evolucao-modal__pill ipt-evolucao-modal__pill--atencao">
            🟡 {resumo.atencoes} atenção
          </span>
          <span className="ipt-evolucao-modal__pill ipt-evolucao-modal__pill--positivo">
            🟢 {resumo.positivos} positivo{resumo.positivos === 1 ? '' : 's'}
          </span>
          <span className="ipt-evolucao-modal__pill ipt-evolucao-modal__pill--in">
            {resumo.entrou} entraram
          </span>
          <span className="ipt-evolucao-modal__pill ipt-evolucao-modal__pill--out">
            {resumo.saiu} saíram
          </span>
          {grupos.length > 0 ? (
            <div className="ipt-evolucao-modal__group-actions">
              <button type="button" onClick={expandirTodos}>
                Expandir tudo
              </button>
              <button type="button" onClick={recolherTodos}>
                Recolher tudo
              </button>
            </div>
          ) : null}
        </div>

        <div className="ipt-evolucao-modal__body">
          {loading ? (
            <div className="ipt-evolucao-modal__empty">
              <Loader2 className="h-5 w-5 animate-spin text-[#ff9800]" aria-hidden />
              Carregando evolução…
            </div>
          ) : grupos.length === 0 ? (
            <div className="ipt-evolucao-modal__empty">
              Nenhum movimento registrado ainda. Os eventos passam a ser gravados a cada atualização
              (manual ou automática a cada 10 min). Novos eventos passam a registrar valor anterior e
              atual.
            </div>
          ) : (
            <div className="ipt-evolucao-modal__groups">
              {grupos.map((grupo) => {
                const cfg = iptMissaoConfig(grupo.missao)
                const aberto = gruposAbertos[grupo.missao] ?? true
                return (
                  <section
                    key={grupo.missao}
                    className="ipt-evolucao-modal__group"
                    style={{ '--missao-cor': cfg.cor } as CSSProperties}
                  >
                    <button
                      type="button"
                      className="ipt-evolucao-modal__group-head"
                      aria-expanded={aberto}
                      onClick={() => toggleGrupo(grupo.missao)}
                    >
                      <CockpitIcon icon={aberto ? ChevronDown : ChevronRight} size="sm" />
                      <span
                        className="ipt-evolucao-modal__group-dot"
                        style={{ background: cfg.cor }}
                        aria-hidden
                      />
                      <strong>
                        Missão {cfg.tagline} - {cfg.titulo}
                      </strong>
                      <span className="ipt-evolucao-modal__group-count">
                        {grupo.eventos.length} evento{grupo.eventos.length === 1 ? '' : 's'}
                      </span>
                      <span className="ipt-evolucao-modal__pill ipt-evolucao-modal__pill--in">
                        {grupo.entrou} in
                      </span>
                      <span className="ipt-evolucao-modal__pill ipt-evolucao-modal__pill--out">
                        {grupo.saiu} out
                      </span>
                    </button>

                    {aberto ? (
                      <div className="ipt-evolucao-modal__table-wrap">
                        <table className="ipt-evolucao-modal__table">
                          <thead>
                            <tr>
                              <th>Alerta</th>
                              <th>Município</th>
                              <th>Movimento</th>
                              <th>Métrica</th>
                              <th>Anterior</th>
                              <th>Atual</th>
                              <th>Quando</th>
                              <th>Motivo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grupo.eventos.map((e) => {
                              const entrou = e.sentido === 'entrou'
                              const comp = leituraComparativoEvento(e)
                              const alerta = alertaMissaoEvento(e)
                              const cor = IPT_MISSAO_ALERTA_COR[alerta.nivel]
                              return (
                                <tr
                                  key={e.id}
                                  className={cn(
                                    'ipt-evolucao-modal__row',
                                    `ipt-evolucao-modal__row--${alerta.nivel}`
                                  )}
                                >
                                  <td>
                                    <span
                                      className="ipt-evolucao-modal__alerta"
                                      title={IPT_MISSAO_ALERTA_LABEL[alerta.nivel]}
                                    >
                                      <span
                                        className="ipt-evolucao-modal__alerta-dot"
                                        style={{ background: cor }}
                                        aria-hidden
                                      />
                                      <span className="ipt-evolucao-modal__alerta-txt">
                                        {alerta.titulo}
                                      </span>
                                    </span>
                                  </td>
                                  <td>
                                    <strong className="ipt-evolucao-modal__muni">{e.municipio}</strong>
                                  </td>
                                  <td>
                                    <span
                                      className={cn(
                                        'ipt-evolucao-modal__badge',
                                        entrou
                                          ? 'ipt-evolucao-modal__badge--in'
                                          : 'ipt-evolucao-modal__badge--out'
                                      )}
                                    >
                                      {labelSentidoMissao(e.sentido)}
                                    </span>
                                  </td>
                                  <td className="ipt-evolucao-modal__metric">{comp.metrica}</td>
                                  <td className="ipt-evolucao-modal__valor">{comp.anterior}</td>
                                  <td className="ipt-evolucao-modal__valor ipt-evolucao-modal__valor--atual">
                                    {comp.atual}
                                  </td>
                                  <td>
                                    <time dateTime={e.createdAt}>{formatWhen(e.createdAt)}</time>
                                  </td>
                                  <td className="ipt-evolucao-modal__motivo">{e.motivo}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
