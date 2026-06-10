'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Loader2, RefreshCw, Send } from 'lucide-react'
import { WhatsAppSendModal } from '@/components/whatsapp-send-modal'
import { fetchResumoOperacional } from '@/lib/services/resumo-operacional'
import type { ResumoOperacionalResponse } from '@/lib/resumo-operacional'
import type { ResumoNoticiaDestaque } from '@/lib/resumo-operacional-noticias'
import { buildResumoOperacionalWhatsAppText } from '@/lib/resumo-operacional-whatsapp'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import { cn, formatDateShort } from '@/lib/utils'

const PERIODOS = [7, 14, 30] as const

type PeriodoDias = (typeof PERIODOS)[number]

function formatPeriodoLabel(inicio: string, fim: string): string {
  return `${formatDateShort(inicio)} — ${formatDateShort(fim)}`
}

function ResumoNoticiaItem({ noticia }: { noticia: ResumoNoticiaDestaque }) {
  const cabecalho = [noticia.dataFmt, noticia.source].filter(Boolean).join(' · ')
  const titulo = noticia.url ? (
    <a
      href={noticia.url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-accent-gold underline decoration-accent-gold/40 underline-offset-2 hover:decoration-accent-gold"
    >
      {noticia.title}
    </a>
  ) : (
    <span className="font-medium">{noticia.title}</span>
  )

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm text-text-secondary">
        {cabecalho}
        {noticia.meta ? <span className="text-text-secondary/80"> ({noticia.meta})</span> : null}
      </p>
      <p className="text-base leading-relaxed text-text-primary sm:text-lg">{titulo}</p>
    </div>
  )
}

function ResumoSecaoItens({
  titulo,
  itens,
  noticiasLinks,
}: {
  titulo: string
  itens: string[]
  noticiasLinks?: ResumoNoticiaDestaque[]
}) {
  if (titulo === 'Notícias' && noticiasLinks && noticiasLinks.length > 0) {
    const intro = itens[0]
    return (
      <ul className="space-y-4">
        {intro ? (
          <li className="flex gap-3 text-base leading-relaxed text-text-primary sm:text-lg">
            <span className="shrink-0 select-none text-text-secondary" aria-hidden>
              •
            </span>
            <span>{intro}</span>
          </li>
        ) : null}
        {noticiasLinks.map((noticia, idx) => (
          <li key={`${noticia.url ?? noticia.title}-${idx}`} className="flex gap-3">
            <span className="shrink-0 select-none text-text-secondary pt-1" aria-hidden>
              •
            </span>
            <ResumoNoticiaItem noticia={noticia} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="space-y-3">
      {itens.map((item, idx) => (
        <li
          key={`${titulo}-${idx}`}
          className="flex gap-3 text-base leading-relaxed text-text-primary sm:text-lg sm:leading-relaxed"
        >
          <span className="shrink-0 select-none text-text-secondary" aria-hidden>
            •
          </span>
          <span className="whitespace-pre-line">{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function ResumoOperacionalPage() {
  const isCockpit = false

  const [days, setDays] = useState<PeriodoDias>(7)
  const [data, setData] = useState<ResumoOperacionalResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<boolean>(false)
  const [whatsappSendOpen, setWhatsappSendOpen] = useState<boolean>(false)

  const carregar = useCallback(async (periodoDias: PeriodoDias) => {
    setLoading(true)
    setError(null)
    try {
      const resumo = await fetchResumoOperacional(periodoDias)
      setData(resumo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar(days)
  }, [days, carregar])

  const textoWhatsApp = useMemo(() => {
    if (!data) return ''
    return data.textoWhatsApp || buildResumoOperacionalWhatsAppText(data)
  }, [data])

  const copiarTexto = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    }
  }

  const copiar = async () => {
    if (!textoWhatsApp) return
    await copiarTexto(textoWhatsApp)
  }

  return (
    <div className="flex min-h-full w-full flex-1 flex-col">
      <div className="flex w-full flex-1 flex-col gap-4 p-4 sm:p-6 lg:p-8 xl:p-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="grid w-full grid-cols-3 gap-1 rounded-lg border border-border-card bg-bg-surface p-1 sm:inline-flex sm:w-auto sm:grid-cols-none">
              {PERIODOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDays(p)}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors sm:py-1.5',
                    days === p
                      ? 'bg-accent-gold text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  {p}d
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void carregar(days)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-card px-3 py-2 text-sm text-text-secondary transition hover:text-text-primary disabled:opacity-60"
              title="Atualizar"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>

          {data ? (
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => void copiar()}
                disabled={loading}
                className={cn(
                  sidebarPrimaryCTAButtonClass(isCockpit),
                  copiado && 'ring-2 ring-status-success/40 ring-offset-2 ring-offset-background'
                )}
                title="Copiar resumo formatado para WhatsApp"
              >
                {copiado ? (
                  <Check className={cn('h-4 w-4 shrink-0', isCockpit ? 'text-white' : 'text-accent-gold')} />
                ) : (
                  <Copy className={cn('h-4 w-4 shrink-0', isCockpit ? 'text-white' : 'text-accent-gold')} />
                )}
                {copiado ? 'Copiado!' : 'Copiar'}
              </button>
              <button
                type="button"
                onClick={() => setWhatsappSendOpen(true)}
                disabled={loading}
                className={sidebarPrimaryCTAButtonClass(isCockpit)}
                title="Enviar resumo pelo WhatsApp"
              >
                <Send className={cn('h-4 w-4 shrink-0', isCockpit ? 'text-white' : 'text-accent-gold')} />
                Enviar
              </button>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <div className="flex min-h-[50vh] flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent-gold" />
          </div>
        ) : null}

        {data ? (
          <article className="w-full flex-1 rounded-2xl border border-border-card bg-bg-surface px-5 py-6 shadow-card sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <header className="mb-8 flex flex-col gap-3 border-b border-border-card/80 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-text-primary sm:text-base">
                  {data.cabecalho}
                </h1>
                <p className="mt-2 text-xs text-text-secondary sm:text-sm">
                  {formatPeriodoLabel(data.periodo.inicio, data.periodo.fim)}
                  <span className="mx-2 hidden sm:inline">·</span>
                  <span className="block sm:inline">
                    vs {formatPeriodoLabel(data.periodo.inicioAnterior, data.periodo.fimAnterior)}
                  </span>
                </p>
              </div>
            </header>

            {data.alertas.length > 0 ? (
              <div className="mb-8 space-y-1 border-l-2 border-amber-500/60 pl-4 text-sm text-amber-900 dark:text-amber-200">
                {data.alertas.map((alerta) => (
                  <p key={alerta}>{alerta}</p>
                ))}
              </div>
            ) : null}

            <div className="space-y-10 lg:space-y-12">
              {data.secoes.map((secao) => (
                <section key={secao.titulo} className="min-w-0">
                  <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.22em] text-text-primary sm:text-sm">
                    {secao.titulo}
                  </h2>
                  <ResumoSecaoItens
                    titulo={secao.titulo}
                    itens={secao.itens}
                    noticiasLinks={secao.noticiasLinks}
                  />
                </section>
              ))}
            </div>

            <footer className="mt-10 border-t border-border-card/80 pt-4 text-xs text-text-secondary">
              Gerado em {formatDateShort(data.geradoEm)}
            </footer>
          </article>
        ) : null}
      </div>

      <WhatsAppSendModal
        isOpen={whatsappSendOpen}
        onClose={() => setWhatsappSendOpen(false)}
        text={textoWhatsApp}
        source="resumo-operacional"
        title="Enviar resumo operacional"
        description="Selecione um ou mais contatos para enviar em fila. As notícias em destaque saem com link clicável."
        contactCategory="executivo"
        allowMultipleRecipients
      />
    </div>
  )
}
