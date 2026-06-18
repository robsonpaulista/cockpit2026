'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconAlertCircle,
  IconCheck,
  IconCopy,
  IconLoader2,
  IconRefresh,
  IconSend,
} from '@tabler/icons-react'
import { WhatsAppSendModal } from '@/components/whatsapp-send-modal'
import { PremiumSectionHeader } from '@/components/conteudo-redes/premium-section-header'
import { fetchResumoOperacional } from '@/lib/services/resumo-operacional'
import type { ResumoOperacionalResponse } from '@/lib/resumo-operacional'
import type { ResumoNoticiaDestaque } from '@/lib/resumo-operacional-noticias'
import { buildResumoOperacionalWhatsAppText } from '@/lib/resumo-operacional-whatsapp'
import {
  ghostButtonClass,
  pillFilterActiveClass,
  pillFilterIdleClass,
} from '@/lib/premium-ui-classes'
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
      className="font-medium text-[rgb(var(--color-primary))] underline decoration-[rgb(var(--color-primary)/0.35)] underline-offset-2 hover:decoration-[rgb(var(--color-primary))]"
    >
      {noticia.title}
    </a>
  ) : (
    <span className="font-medium text-text-primary">{noticia.title}</span>
  )

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[11px] text-text-muted">
        {cabecalho}
        {noticia.meta ? <span className="text-text-muted/80"> ({noticia.meta})</span> : null}
      </p>
      <p className="text-sm leading-relaxed text-text-primary">{titulo}</p>
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
      <ul className="space-y-3">
        {intro ? (
          <li className="flex gap-2.5 text-sm leading-relaxed text-text-primary">
            <span className="shrink-0 select-none text-text-muted" aria-hidden>
              •
            </span>
            <span>{intro}</span>
          </li>
        ) : null}
        {noticiasLinks.map((noticia, idx) => (
          <li key={`${noticia.url ?? noticia.title}-${idx}`} className="flex gap-2.5">
            <span className="shrink-0 select-none pt-0.5 text-text-muted" aria-hidden>
              •
            </span>
            <ResumoNoticiaItem noticia={noticia} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="space-y-2.5">
      {itens.map((item, idx) => (
        <li key={`${titulo}-${idx}`} className="flex gap-2.5 text-sm leading-relaxed text-text-primary">
          <span className="shrink-0 select-none text-text-muted" aria-hidden>
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
  const sectionShellClass = isCockpit
    ? 'border-white/12 bg-[linear-gradient(165deg,rgba(22,34,44,0.82)_0%,rgba(18,30,38,0.86)_100%)] shadow-[0_10px_32px_rgba(3,12,20,0.28)]'
    : 'border-card bg-surface shadow-card'
  const sectionWrapClass = cn('rounded-2xl border p-4 sm:p-5', sectionShellClass)

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

  const pageSubtitle = useMemo(() => {
    if (!data) return 'Briefing consolidado da campanha'
    return `${formatPeriodoLabel(data.periodo.inicio, data.periodo.fim)} · vs ${formatPeriodoLabel(
      data.periodo.inicioAnterior,
      data.periodo.fimAnterior
    )}`
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
    <div className={cn('min-h-screen', isCockpit ? 'sidebar-cockpit-shell' : 'bg-bg-surface')}>
      <div className="px-4 py-4 lg:px-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-sm font-medium text-text-primary">Resumo operacional</h1>
            <p className="mt-0.5 text-xs text-text-muted">{pageSubtitle}</p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {PERIODOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDays(p)}
                  className={cn(days === p ? pillFilterActiveClass : pillFilterIdleClass)}
                >
                  {p}d
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void carregar(days)}
              disabled={loading}
              className={cn(ghostButtonClass, 'disabled:opacity-50')}
              title="Atualizar"
            >
              <IconRefresh
                className={cn('h-[14px] w-[14px] opacity-70', loading && 'animate-spin')}
                stroke={1.5}
                aria-hidden
              />
              Atualizar
            </button>
            {data ? (
              <>
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
                    <IconCheck className="h-[14px] w-[14px] shrink-0 text-white" stroke={1.5} aria-hidden />
                  ) : (
                    <IconCopy className="h-[14px] w-[14px] shrink-0 text-white" stroke={1.5} aria-hidden />
                  )}
                  {copiado ? 'Copiado!' : 'Copiar'}
                </button>
                <button
                  type="button"
                  onClick={() => setWhatsappSendOpen(true)}
                  disabled={loading}
                  className={ghostButtonClass}
                  title="Enviar resumo pelo WhatsApp"
                >
                  <IconSend className="h-[14px] w-[14px] opacity-70" stroke={1.5} aria-hidden />
                  Enviar
                </button>
              </>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-status-error/30 bg-status-error/10 p-4">
            <IconAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-error" stroke={1.5} />
            <p className="text-sm text-status-error">{error}</p>
          </div>
        ) : null}

        {loading && !data ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <IconLoader2
              className="h-8 w-8 animate-spin text-[rgb(var(--color-primary))]"
              stroke={1.5}
              aria-hidden
            />
          </div>
        ) : null}

        {data ? (
          <section className={sectionWrapClass}>
            <PremiumSectionHeader
              title={data.cabecalho}
              description={pageSubtitle}
              className="mb-4 border-b border-[rgb(var(--color-border-tertiary)/0.85)] pb-4"
            />

            {data.alertas.length > 0 ? (
              <div className="mb-5 rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-status-warning">
                  Alertas
                </p>
                <div className="space-y-1">
                  {data.alertas.map((alerta) => (
                    <p key={alerta} className="text-sm text-text-primary">
                      {alerta}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-6">
              {data.secoes.map((secao) => (
                <section
                  key={secao.titulo}
                  className="min-w-0 rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app/40 p-4"
                >
                  <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
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

            <footer className="mt-5 border-t border-[rgb(var(--color-border-tertiary)/0.85)] pt-3 text-[11px] text-text-muted">
              Gerado em {formatDateShort(data.geradoEm)}
            </footer>
          </section>
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
