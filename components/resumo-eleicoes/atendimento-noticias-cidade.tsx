'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import {
  fetchAtendimentoNoticiasMunicipio,
  type AtendimentoNoticiasPayload,
} from '@/lib/services/atendimento-noticias-client'
import { TseModal, tseBotaoNeutroClass, tseLinkAcaoClass } from '@/components/tse/tse-ui'

export function AtendimentoNoticiasModal({
  municipio,
  onClose,
}: {
  municipio: string
  onClose: () => void
}) {
  const [loading, setLoading] = useState<boolean>(true)
  const [erro, setErro] = useState<string | null>(null)
  const [payload, setPayload] = useState<AtendimentoNoticiasPayload | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await fetchAtendimentoNoticiasMunicipio(municipio)
      setPayload(data)
    } catch (error) {
      setPayload(null)
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar as notícias.')
    } finally {
      setLoading(false)
    }
  }, [municipio])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const itens = payload?.itens ?? []
  const fonteLabel =
    itens[0]?.fonteNome ??
    (payload && payload.fontesConsultadas === 0 ? 'Sem fonte regional cadastrada' : 'Fontes regionais')

  return (
    <TseModal
      id="atendimento-noticias-titulo"
      titulo={`Notícias · ${municipio}`}
      subtitulo={
        <>
          {fonteLabel}
          {itens[0]?.fonteUrl ? (
            <>
              {' · '}
              <a
                href={itens[0].fonteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={tseLinkAcaoClass}
              >
                abrir fonte
              </a>
            </>
          ) : null}
        </>
      }
      largura="max-w-2xl"
      onClose={onClose}
      rodape={
        <>
          <button type="button" onClick={() => void carregar()} disabled={loading} className={tseBotaoNeutroClass}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </button>
          <button type="button" onClick={onClose} className={tseBotaoNeutroClass}>
            Fechar
          </button>
        </>
      }
    >
      {loading && itens.length === 0 ? (
        <p className="flex items-center gap-2 text-[13px] text-[var(--tse-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Buscando notícias…
        </p>
      ) : null}

      {erro ? <p className="text-[13px] text-red-700">{erro}</p> : null}

      {!loading && !erro && itens.length === 0 ? (
        <p className="text-[13px] text-[var(--tse-muted)]">
          Nenhuma notícia encontrada para esta cidade nas fontes regionais cadastradas.
        </p>
      ) : null}

      {itens.length > 0 ? (
        <ul className="-mx-1 divide-y divide-[#EEEEEE] rounded-xl bg-white px-3">
          {itens.slice(0, 20).map((n) => (
            <li key={`${n.fonteId}-${n.articleId}`} className="py-2.5 first:pt-2 last:pb-2">
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-snug text-[var(--tse-text)] group-hover:underline">
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--tse-muted)]">
                    {[n.category, n.publishedLabel].filter(Boolean).join(' · ') || n.fonteNome}
                    {n.summary ? ` · ${n.summary}` : ''}
                  </p>
                </div>
                <ExternalLink
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tse-muted)] opacity-0 transition group-hover:opacity-100"
                  aria-hidden
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </TseModal>
  )
}
