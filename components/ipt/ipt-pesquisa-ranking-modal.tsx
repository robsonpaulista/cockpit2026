'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import {
  iptLabelTipoPesquisa,
  type IptMunicipio,
} from '@/lib/ipt'
import { resolveCandidatoIpt } from '@/lib/ipt-pesquisa'

type Props = {
  municipio: IptMunicipio
  onClose: () => void
}

function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function situacaoRanking(m: IptMunicipio, candidato: string): string {
  const pos = m.detalhes.pesquisaPosicaoTop5
  const media = formatPct(m.detalhes.pesquisaMediaPct)
  if (m.detalhes.pesquisaTop5.length === 0 && m.detalhes.pesquisaMediaPct == null) {
    return 'Não há média de pesquisa cadastrada para este município.'
  }
  if (pos != null) {
    return `${candidato} aparece em ${pos}º no Top 5 local (média ${media}).`
  }
  if (m.detalhes.pesquisaMediaPct != null) {
    return `${candidato} está fora do Top 5 em ${m.municipio} (média ${media}). Abaixo, quem lidera a média local.`
  }
  return `Sem posição do candidato no Top 5 de ${m.municipio}. Veja quem compõe o ranking local.`
}

export function IptPesquisaRankingModal({ municipio, onClose }: Props) {
  const tituloId = useId()
  const [mounted, setMounted] = useState(false)
  const candidato = resolveCandidatoIpt()
  const top5 = municipio.detalhes.pesquisaTop5
  const baseLabel = iptLabelTipoPesquisa(municipio.detalhes.pesquisaBase)
  const maxPct = top5.reduce((acc, item) => Math.max(acc, item.mediaPct), 0)

  useEffect(() => {
    setMounted(true)
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
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div className="ipt-foco-modal" role="presentation">
      <button
        type="button"
        className="ipt-foco-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="ipt-pesquisa-modal__panel"
      >
        <div className="ipt-foco-modal__head">
          <div>
            <p className="ipt-foco-modal__eyebrow">Pesquisa · média {baseLabel}</p>
            <h2 id={tituloId} className="ipt-foco-modal__title">
              Top 5 em {municipio.municipio}
            </h2>
          </div>
          <button
            type="button"
            className="ipt-foco-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <CockpitIcon icon={X} size="sm" />
          </button>
        </div>

        <p className="ipt-foco-modal__lead">{situacaoRanking(municipio, candidato)}</p>

        {top5.length === 0 ? (
          <p className="ipt-pesquisa-modal__empty">
            Ainda não há ranking de médias disponível para cruzar neste município.
          </p>
        ) : (
          <ol className="ipt-pesquisa-modal__ranking">
            {top5.map((item, idx) => {
              const largura =
                maxPct > 0 ? Math.max(8, Math.round((item.mediaPct / maxPct) * 100)) : 0
              return (
                <li key={`${item.nome}-${idx}`}>
                  <span className="ipt-pesquisa-modal__pos" aria-hidden>
                    {idx + 1}º
                  </span>
                  <div className="ipt-pesquisa-modal__row">
                    <div className="ipt-pesquisa-modal__nome-linha">
                      <span className="ipt-pesquisa-modal__nome">{item.nome}</span>
                      <span className="ipt-pesquisa-modal__pct">{formatPct(item.mediaPct)}</span>
                    </div>
                    <div className="ipt-pesquisa-modal__bar" aria-hidden>
                      <span style={{ width: `${largura}%` }} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        <div className="ipt-pesquisa-modal__nota">
          <span>Situação de {candidato}</span>
          <em>
            {municipio.detalhes.pesquisaPosicaoTop5 != null
              ? `${municipio.detalhes.pesquisaPosicaoTop5}º · ${formatPct(municipio.detalhes.pesquisaMediaPct)}`
              : municipio.detalhes.pesquisaMediaPct != null
                ? `Fora do Top 5 · ${formatPct(municipio.detalhes.pesquisaMediaPct)}`
                : 'Sem média cadastrada'}
          </em>
        </div>
      </div>
    </div>,
    document.body
  )
}
