'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Loader2, Newspaper, RefreshCw } from 'lucide-react'
import type { RadarNoticiaItem } from '@/lib/radar-224/buscar-noticias'
import {
  agruparAcontecimentos,
  construirLeituraContexto,
  enriquecerNoticiasRadar,
  type RadarAcontecimento,
} from '@/lib/radar-224/leitura-noticias'
import { cn } from '@/lib/utils'

type NoticiasApiPayload = {
  ok?: boolean
  error?: string
  total?: number
  itens?: RadarNoticiaItem[]
}

type Props = {
  municipio: string | null
  /** Entregas/obras do município (para linha “Relacionado ao mandato”). */
  entregasMandato?: number
  /** Dentro do painel cidade: título mais curto, sem card próprio. */
  compact?: boolean
}

/**
 * Notícias do Radar 224 com leitura de contexto derivada dos títulos.
 */
export function IptRadarNoticias({ municipio, entregasMandato = 0, compact = false }: Props) {
  const [itens, setItens] = useState<RadarNoticiaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const reqIdRef = useRef(0)
  const lastFetchedRef = useRef<string | null>(null)

  const enriquecidas = useMemo(() => enriquecerNoticiasRadar(itens), [itens])
  const leitura = useMemo(() => construirLeituraContexto(enriquecidas), [enriquecidas])
  const acontecimentos = useMemo(
    () => agruparAcontecimentos(enriquecidas),
    [enriquecidas],
  )

  const buscar = useCallback(async (nome: string, force = false) => {
    const key = nome.trim()
    if (!key) {
      setItens([])
      setErro(null)
      lastFetchedRef.current = null
      return
    }
    if (!force && lastFetchedRef.current === key) return

    const reqId = ++reqIdRef.current
    setLoading(true)
    setErro(null)
    setItens([])
    try {
      const res = await fetch('/api/radar-224/noticias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ municipio: key }),
      })
      const json = (await res.json()) as NoticiasApiPayload
      if (reqId !== reqIdRef.current) return
      if (!res.ok) throw new Error(json.error || 'Falha na busca de notícias')
      setItens(json.itens ?? [])
      lastFetchedRef.current = key
    } catch (e) {
      if (reqId !== reqIdRef.current) return
      setErro(e instanceof Error ? e.message : 'Erro na busca')
      setItens([])
      lastFetchedRef.current = null
    } finally {
      if (reqId === reqIdRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!municipio?.trim()) {
      setItens([])
      setErro(null)
      lastFetchedRef.current = null
      return
    }
    const t = window.setTimeout(() => {
      void buscar(municipio)
    }, 450)
    return () => window.clearTimeout(t)
  }, [municipio, buscar])

  const tituloMunicipio = compact
    ? 'Contexto local · Radar 224'
    : municipio?.trim()
      ? `Contexto local — ${municipio.trim()}`
      : 'Contexto local'

  return (
    <section
      className={cn(
        !compact && 'ipt-bloco',
        'ipt-bloco-noticias',
        compact && 'ipt-bloco-noticias--compact'
      )}
      aria-label="Contexto local do município"
    >
      <div className="ipt-bloco-noticias__head">
        <div className="ipt-bloco-noticias__intro">
          <h2 className={compact ? 'ipt-painel-cidade__section-label' : 'ipt-bloco__title'}>
            {!compact ? <Newspaper className="ipt-bloco-noticias__ico" aria-hidden /> : null}
            {tituloMunicipio}
          </h2>
          <p className="ipt-bloco__sub">
            {municipio && enriquecidas.length > 0
              ? compact
                ? `${leitura.acontecimentos} acontecimento${leitura.acontecimentos === 1 ? '' : 's'} · ${leitura.materias} matéria${leitura.materias === 1 ? '' : 's'}`
                : `Notícias e temas que ajudam a compreender o ambiente atual · Radar 224 · ${leitura.acontecimentos} acontecimento${leitura.acontecimentos === 1 ? '' : 's'} · ${leitura.materias} matéria${leitura.materias === 1 ? '' : 's'}`
              : municipio
                ? 'Notícias e temas do município'
                : 'Selecione um município na lista ou no mapa'}
          </p>
        </div>
        <button
          type="button"
          className="ipt-bloco-noticias__refresh"
          disabled={!municipio || loading}
          onClick={() => municipio && void buscar(municipio, true)}
          title="Atualizar notícias"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          Atualizar
        </button>
      </div>

      {erro ? (
        <div className="ipt-bloco-noticias__erro" role="alert">
          {erro}
        </div>
      ) : null}

      <div className="ipt-bloco-noticias__body">
        {!municipio ? (
          <p className="ipt-bloco-noticias__empty">
            Clique em um município nas prioridades para ver a leitura de contexto e as matérias.
          </p>
        ) : loading && itens.length === 0 ? (
          <div className="ipt-bloco-noticias__loading">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Consultando Google News…
          </div>
        ) : itens.length === 0 ? (
          <p className="ipt-bloco-noticias__empty">
            Nenhuma notícia relevante nos últimos 30 dias para {municipio}.
          </p>
        ) : (
          <>
            <div className="ipt-bloco-noticias__leitura">
              <h3 className="ipt-bloco-noticias__leitura-title">Leitura de contexto</h3>
              <ul className="ipt-bloco-noticias__leitura-list">
                <li>
                  Oportunidade:{' '}
                  <strong>{leitura.oportunidade ?? 'Sem sinal claro'}</strong>
                </li>
                <li>
                  Assunto dominante:{' '}
                  <strong>{leitura.assuntoDominante ?? 'Diversos'}</strong>
                </li>
                <li>{leitura.movimentacaoLabel}</li>
              </ul>
            </div>

            <ul className="ipt-bloco-noticias__list">
              {acontecimentos.map((a) => (
                <AcontecimentoLinha
                  key={a.key}
                  item={a}
                  entregasMandato={entregasMandato}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

function AcontecimentoLinha({
  item,
  entregasMandato,
}: {
  item: RadarAcontecimento
  entregasMandato: number
}) {
  const mostrarMandato =
    item.papel === 'oportunidade' &&
    entregasMandato > 0 &&
    (item.assunto === 'Saúde' ||
      item.assunto === 'Educação' ||
      item.assunto === 'Saúde/Educação' ||
      item.assunto === 'Infraestrutura')

  return (
    <li
      className={cn(
        'ipt-bloco-noticias__item',
        `ipt-bloco-noticias__item--${item.papel}`,
      )}
    >
      <div className="ipt-bloco-noticias__papel-row">
        <span
          className={cn(
            'ipt-bloco-noticias__papel',
            `ipt-bloco-noticias__papel--${item.papel}`,
          )}
        >
          {item.papelLabel}
        </span>
        <h3 className="ipt-bloco-noticias__title">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.titulo}
              <ExternalLink className="ipt-bloco-noticias__ext" aria-hidden />
            </a>
          ) : (
            item.titulo
          )}
        </h3>
      </div>
      <p className="ipt-bloco-noticias__meta-line">
        {item.fontesLabel}
        {' · '}
        {item.assunto}
        {' · '}
        <time dateTime={item.publishedAt ?? undefined}>{item.dataCurta}</time>
      </p>
      {mostrarMandato ? (
        <p className="ipt-bloco-noticias__mandato">
          Relacionado ao mandato: {entregasMandato} entrega
          {entregasMandato === 1 ? '' : 's'}
        </p>
      ) : null}
    </li>
  )
}
