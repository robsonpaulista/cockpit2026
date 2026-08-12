'use client'

import { GoogleAlertsPanel } from '@/components/monitoramento/google-alerts-panel'
import { GoogleNewsRadarPanel } from '@/components/monitoramento/google-news-radar-panel'

/**
 * Aba Notícias unificada: inbox de Alertas (RSS/feeds) + radar Google News por candidato.
 * As duas coletas rodam nos respectivos painéis ao abrir.
 */
export function NoticiasUnificadasPanel() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="noticias-inbox-heading">
        <div className="px-0.5">
          <h2
            id="noticias-inbox-heading"
            className="text-[13px] font-semibold tracking-wide text-[var(--wr-text-primary,#20201e)]"
          >
            Inbox · Alertas e feeds
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--wr-text-muted,#777773)]">
            Google Alerts e feeds cadastrados — coleta automática ao abrir.
          </p>
        </div>
        <GoogleAlertsPanel />
      </section>

      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="noticias-radar-heading">
        <div className="px-0.5">
          <h2
            id="noticias-radar-heading"
            className="text-[13px] font-semibold tracking-wide text-[var(--wr-text-primary,#20201e)]"
          >
            Radar · Por candidato
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--wr-text-muted,#777773)]">
            Google News e busca web por ator político.
          </p>
        </div>
        <GoogleNewsRadarPanel />
      </section>
    </div>
  )
}
