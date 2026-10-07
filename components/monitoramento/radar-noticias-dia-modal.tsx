'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { TseCarregando, TseErro, TseVazio, tseBotaoContornoClass, TseModal } from '@/components/tse/tse-ui'
import { plural } from '@/components/monitoramento/radar-ui'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import { fetchNoticiasDoDia } from '@/lib/services/radar-eleitoral-client'

export type RadarNoticiasDia = {
  slug: string
  nome: string
  data: string
  qtd: number
}

const fmtDiaLongo = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

const fmtHora = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'

export function RadarNoticiasDiaModal({ selecao, onClose }: { selecao: RadarNoticiasDia; onClose: () => void }) {
  const [materias, setMaterias] = useState<GoogleNewsMentionWithActor[]>([])
  const [carregando, setCarregando] = useState<boolean>(true)
  const [erro, setErro] = useState<string>('')

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro('')
    fetchNoticiasDoDia(selecao.slug, selecao.data)
      .then((dados) => {
        if (ativo) setMaterias(dados)
      })
      .catch((e: unknown) => {
        if (!ativo) return
        setMaterias([])
        setErro(e instanceof Error ? e.message : 'Erro ao carregar matérias.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [selecao.slug, selecao.data])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <TseModal
      id="radar-noticias-dia-titulo"
      titulo={selecao.nome}
      subtitulo={<span className="capitalize">{fmtDiaLongo(selecao.data)}</span>}
      largura="max-w-2xl"
      onClose={onClose}
      rodape={
        <>
          <span className="text-[12px] text-[var(--tse-muted)]">
            {carregando ? 'Carregando…' : plural(materias.length, 'matéria', 'matérias')}
          </span>
          <button type="button" onClick={onClose} className={tseBotaoContornoClass}>
            Fechar
          </button>
        </>
      }
    >
      {carregando ? (
        <TseCarregando texto="Carregando matérias…" className="min-h-[160px]" />
      ) : erro ? (
        <TseErro>{erro}</TseErro>
      ) : materias.length === 0 ? (
        <TseVazio>
          Nenhuma matéria encontrada para este dia.
          {selecao.qtd > 0 ? ' O mapa pode estar desatualizado; recarregue o panorama.' : ''}
        </TseVazio>
      ) : (
        <ul className="divide-y divide-[#EEEEEE] overflow-hidden rounded-xl bg-white shadow-sm">
          {materias.map((m) => (
            <li key={m.id} className="px-4 py-3">
              <a
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2 text-[14px] font-semibold leading-snug hover:text-[var(--tse-olive)]"
              >
                <span className="min-w-0 flex-1">{m.title}</span>
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tse-olive)] opacity-60 group-hover:opacity-100" />
              </a>
              <p className="mt-1 text-[11px] text-[var(--tse-muted)]">
                {m.source_name ?? 'Fonte desconhecida'} · {fmtHora(m.published_at ?? m.collected_at)}
              </p>
              {m.summary ? <p className="mt-1 line-clamp-2 text-[12px] text-[var(--tse-muted)]">{m.summary}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </TseModal>
  )
}
