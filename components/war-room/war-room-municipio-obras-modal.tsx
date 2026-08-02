'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import {
  IconBuildingBridge,
  IconExternalLink,
  IconLoader2,
  IconX,
} from '@tabler/icons-react'
import { normalizeIptMunicipio } from '@/lib/ipt'
import {
  isObraLinhaTotalPlanilha,
  valorExibidoMapaObra,
  type ObraMapaRow,
} from '@/lib/obras-mapa'
import {
  indexRecapMatchesByObraId,
  type ObraRecapMatchSource,
} from '@/lib/obras-recap-match'
import { hrefSeiProcesso, isSeiExibirUrl } from '@/lib/sei-protocolo-url'

type ObraMapaComSei = ObraMapaRow & { sei?: string | null }

type Props = {
  municipio: string
  obras: ObraMapaComSei[] | null
  /** Itens do Recap (/dashboard/obras) para cruzar por SEI ou descrição. */
  recapObras?: ObraRecapMatchSource[] | null
  loading?: boolean
  onClose: () => void
}

function formatBrl(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function tituloObra(obra: ObraMapaRow): string {
  const nome = obra.obra?.trim()
  if (nome) return nome
  const tipo = obra.tipo?.trim()
  if (tipo) return tipo
  return 'Obra sem título'
}

function formatDataSei(iso: string | null | undefined): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function limparTextoSei(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Modal de obras do município — aberto a partir do ranking da Expectativa. */
export function WarRoomMunicipioObrasModal({
  municipio,
  obras,
  recapObras = null,
  loading = false,
  onClose,
}: Props) {
  const tituloId = useId()
  const [resolvedSeiUrls, setResolvedSeiUrls] = useState<Record<string, string>>(
    {},
  )

  const obrasMunicipio = useMemo(() => {
    if (!obras) return []
    const key = normalizeIptMunicipio(municipio)
    return obras
      .filter((o) => normalizeIptMunicipio(o.municipio ?? '') === key)
      .filter((o) => !isObraLinhaTotalPlanilha(o))
      .slice()
      .sort((a, b) => {
        const va = valorExibidoMapaObra(a) ?? 0
        const vb = valorExibidoMapaObra(b) ?? 0
        if (vb !== va) return vb - va
        return tituloObra(a).localeCompare(tituloObra(b), 'pt-BR')
      })
  }, [municipio, obras])

  const matchesById = useMemo(
    () => indexRecapMatchesByObraId(obrasMunicipio, recapObras ?? []),
    [obrasMunicipio, recapObras],
  )

  const matchedCount = matchesById.size

  const totalValor = useMemo(
    () => obrasMunicipio.reduce((s, o) => s + (valorExibidoMapaObra(o) ?? 0), 0),
    [obrasMunicipio],
  )

  /** Protocolos matched sem link exibir ainda — resolve na Pesquisa Pública. */
  const seisSemUrl = useMemo(() => {
    const out: string[] = []
    for (const obra of obrasMunicipio) {
      const match = matchesById.get(obra.id)
      if (!match) continue
      const sei = (obra.sei?.trim() || match.recap.sei?.trim() || '')
      if (!sei) continue
      const existing = (match.recap.sei_url ?? '').trim()
      if (existing && isSeiExibirUrl(existing)) continue
      if (resolvedSeiUrls[sei] && isSeiExibirUrl(resolvedSeiUrls[sei])) continue
      out.push(sei)
    }
    return [...new Set(out)]
  }, [obrasMunicipio, matchesById, resolvedSeiUrls])

  useEffect(() => {
    if (seisSemUrl.length === 0) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/sei/resolve-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seis: seisSemUrl }),
        })
        const json = (await res.json().catch(() => null)) as {
          urls?: Record<string, string | null>
          url?: string | null
          sei?: string
        } | null
        if (cancelled || !res.ok) return
        const next: Record<string, string> = {}
        if (json?.urls) {
          for (const [sei, url] of Object.entries(json.urls)) {
            if (url && isSeiExibirUrl(url)) next[sei] = url
          }
        } else if (json?.sei && json.url && isSeiExibirUrl(json.url)) {
          next[json.sei] = json.url
        }
        if (Object.keys(next).length === 0) return
        setResolvedSeiUrls((prev) => ({ ...prev, ...next }))
      } catch {
        /* ignore — fallback usa Pesquisa Pública */
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [seisSemUrl])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="wr-visita-modal wr-visita-modal--nested" role="presentation">
      <button
        type="button"
        className="wr-visita-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="wr-visita-modal__panel wr-municipio-detalhe-modal__panel"
      >
        <header className="wr-visita-modal__head">
          <div className="wr-visita-modal__head-main min-w-0">
            <span className="wr-visita-modal__icon" aria-hidden>
              <IconBuildingBridge className="h-4 w-4" stroke={1.75} />
            </span>
            <div className="min-w-0">
              <p className="wr-visita-modal__eyebrow">War Room · Obras</p>
              <h2 id={tituloId} className="wr-visita-modal__title truncate">
                Obras em {municipio}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="wr-visita-modal__close"
            aria-label="Fechar"
            onClick={onClose}
          >
            <IconX className="h-4 w-4" stroke={1.75} />
          </button>
        </header>

        {loading ? (
          <p className="wr-visita-modal__state flex items-center gap-2">
            <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.5} />
            Carregando obras…
          </p>
        ) : (
          <>
            <p className="wr-visita-modal__lead">
              {obrasMunicipio.length === 0
                ? 'Nenhuma obra cadastrada para este município na base do mapa.'
                : `${obrasMunicipio.length.toLocaleString('pt-BR')} obra${
                    obrasMunicipio.length === 1 ? '' : 's'
                  } · total ${formatBrl(totalValor)}${
                    matchedCount > 0
                      ? ` · ${matchedCount.toLocaleString('pt-BR')} com Recap/SEI`
                      : ''
                  }.`}
            </p>
            {obrasMunicipio.length === 0 ? (
              <p className="wr-visita-modal__state">Sem obras para listar.</p>
            ) : (
              <div className="wr-municipio-detalhe-modal__table-wrap">
                <table className="wr-municipio-detalhe-modal__table">
                  <thead>
                    <tr>
                      <th scope="col">Obra</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Órgão</th>
                      <th scope="col" className="wr-municipio-detalhe-modal__col-valor">
                        Valor
                      </th>
                      <th scope="col">Match</th>
                      <th scope="col">SEI</th>
                      <th scope="col">Andamento</th>
                      <th scope="col">Status SEI</th>
                      <th scope="col">Plano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {obrasMunicipio.map((obra) => {
                      const match = matchesById.get(obra.id)
                      const recap = match?.recap
                      const seiNumero = (obra.sei?.trim() || recap?.sei?.trim() || '')
                      const seiUrl =
                        resolvedSeiUrls[seiNumero] ||
                        recap?.sei_url?.trim() ||
                        null
                      const seiHref = match
                        ? hrefSeiProcesso(seiNumero, seiUrl)
                        : null
                      const andamentoData = formatDataSei(
                        recap?.sei_ultimo_andamento_data,
                      )
                      const andamentoTxt = limparTextoSei(recap?.sei_ultimo_andamento)
                      const andamentoFull = [andamentoData, andamentoTxt]
                        .filter(Boolean)
                        .join(' · ')
                      const statusTxt = limparTextoSei(recap?.sei_ultimo_status)
                      const planoLabel =
                        limparTextoSei(recap?.sei_plano_trabalho_tipo) ||
                        (recap?.sei_plano_trabalho_numero
                          ? `Doc. ${recap.sei_plano_trabalho_numero}`
                          : 'Abrir')
                      const matchLabel = match
                        ? match.kind === 'sei'
                          ? 'SEI'
                          : match.kind === 'descricao'
                            ? 'Descrição'
                            : 'Parcial'
                        : null

                      return (
                        <tr key={obra.id}>
                          <td className="wr-municipio-detalhe-modal__col-obra">
                            <span title={tituloObra(obra)}>{tituloObra(obra)}</span>
                          </td>
                          <td>
                            <span title={obra.tipo?.trim() || undefined}>
                              {obra.tipo?.trim() || '—'}
                            </span>
                          </td>
                          <td>
                            <span title={obra.orgao?.trim() || undefined}>
                              {obra.orgao?.trim() || '—'}
                            </span>
                          </td>
                          <td className="wr-municipio-detalhe-modal__col-valor tabular-nums">
                            {formatBrl(valorExibidoMapaObra(obra))}
                          </td>
                          <td>
                            {matchLabel ? (
                              <em className="wr-municipio-detalhe-modal__status--ok">
                                {matchLabel}
                              </em>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="wr-municipio-detalhe-modal__col-sei">
                            {seiNumero && seiHref ? (
                              <a
                                href={seiHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={
                                  seiUrl && isSeiExibirUrl(seiUrl)
                                    ? 'Abrir processo no SEI'
                                    : 'Abrir Pesquisa Pública do SEI'
                                }
                              >
                                <span>{seiNumero}</span>
                                <IconExternalLink className="h-3 w-3 shrink-0" stroke={1.75} />
                              </a>
                            ) : seiNumero ? (
                              <code title={seiNumero}>{seiNumero}</code>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="wr-municipio-detalhe-modal__col-clip">
                            {andamentoFull ? (
                              <span title={andamentoFull}>{andamentoFull}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="wr-municipio-detalhe-modal__col-clip">
                            {statusTxt ? <span title={statusTxt}>{statusTxt}</span> : '—'}
                          </td>
                          <td>
                            {recap?.sei_plano_trabalho_url?.trim() ? (
                              <a
                                href={recap.sei_plano_trabalho_url.trim()}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={planoLabel}
                              >
                                <span>{planoLabel}</span>
                                <IconExternalLink className="h-3 w-3 shrink-0" stroke={1.75} />
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
