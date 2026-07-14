'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownRight, ArrowUpRight, Loader2, X } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import type { IptMunicipio } from '@/lib/ipt'
import {
  IPT_MISSOES,
  iptMissaoConfig,
  type IptMissaoId,
  type IptMissaoMudancaSentido,
} from '@/lib/ipt-missoes'
import {
  carregarEventosMissao,
  labelSentidoMissao,
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
  const [filtroMunicipio, setFiltroMunicipio] = useState<string>('')
  const [busca, setBusca] = useState<string>('')

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
    if (!q) return eventos
    return eventos.filter((e) => {
      const blob = `${e.municipio} ${e.motivo} ${e.missao}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return blob.includes(q)
    })
  }, [eventos, busca])

  const resumo = useMemo(() => {
    let entrou = 0
    let saiu = 0
    for (const e of filtrados) {
      if (e.sentido === 'entrou') entrou += 1
      else saiu += 1
    }
    return { entrou, saiu, total: filtrados.length }
  }, [filtrados])

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
            <p className="ipt-foco-modal__eyebrow">Insight contínuo</p>
            <h2 id="ipt-evolucao-titulo" className="ipt-foco-modal__title">
              Evolução das missões
            </h2>
          </div>
          <button type="button" className="ipt-foco-modal__close" onClick={onClose} aria-label="Fechar">
            <CockpitIcon icon={X} size="sm" />
          </button>
        </div>

        <p className="ipt-foco-modal__lead">
          Quando cada município entrou ou saiu de uma missão — e o porquê — a cada sincronização do
          diagnóstico.
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
              placeholder="Município ou motivo…"
            />
          </label>
        </div>

        <div className="ipt-evolucao-modal__summary">
          <span>{resumo.total} eventos</span>
          <span className="ipt-evolucao-modal__pill ipt-evolucao-modal__pill--in">
            {resumo.entrou} entraram
          </span>
          <span className="ipt-evolucao-modal__pill ipt-evolucao-modal__pill--out">
            {resumo.saiu} saíram
          </span>
        </div>

        <div className="ipt-evolucao-modal__body">
          {loading ? (
            <div className="ipt-evolucao-modal__empty">
              <Loader2 className="h-5 w-5 animate-spin text-[#ff9800]" aria-hidden />
              Carregando evolução…
            </div>
          ) : filtrados.length === 0 ? (
            <div className="ipt-evolucao-modal__empty">
              Nenhum movimento registrado ainda. Os eventos passam a ser gravados a cada atualização
              (manual ou automática a cada 10 min).
            </div>
          ) : (
            <ul className="ipt-evolucao-modal__list">
              {filtrados.map((e) => {
                const cfg = iptMissaoConfig(e.missao)
                const entrou = e.sentido === 'entrou'
                return (
                  <li key={e.id} className="ipt-evolucao-modal__item">
                    <div
                      className={cn(
                        'ipt-evolucao-modal__icon',
                        entrou
                          ? 'ipt-evolucao-modal__icon--in'
                          : 'ipt-evolucao-modal__icon--out'
                      )}
                      aria-hidden
                    >
                      <CockpitIcon icon={entrou ? ArrowUpRight : ArrowDownRight} size="sm" />
                    </div>
                    <div className="ipt-evolucao-modal__content">
                      <div className="ipt-evolucao-modal__row">
                        <strong>{e.municipio}</strong>
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
                        <span className="ipt-evolucao-modal__missao" style={{ color: cfg.cor }}>
                          {cfg.titulo}
                        </span>
                        <time dateTime={e.createdAt}>{formatWhen(e.createdAt)}</time>
                      </div>
                      <p>{e.motivo}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
