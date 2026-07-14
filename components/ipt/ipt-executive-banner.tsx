'use client'

import type { ReactNode } from 'react'

type Props = {
  texto: string
  janela?: string
  atualizadoEm?: string
  actions?: ReactNode
}

export function IptExecutiveBanner({
  texto,
  janela = '30 / 31–60 dias',
  atualizadoEm,
  actions,
}: Props) {
  return (
    <aside className="ipt-exec-banner" aria-label="Leitura executiva de hoje">
      <div className="ipt-exec-banner__row">
        <span className="ipt-exec-banner__label">Leitura executiva de hoje</span>
        <p className="ipt-exec-banner__text">{texto}</p>
        <div
          className="ipt-exec-banner__meta"
          title="Janela de campo e referência de atualização"
        >
          <span>{janela}</span>
          <span>{atualizadoEm ?? '—'}</span>
        </div>
        {actions ? <div className="ipt-exec-banner__actions">{actions}</div> : null}
      </div>
    </aside>
  )
}
