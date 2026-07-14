'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Building2, MapPin, Megaphone, Smartphone, Target, X } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import {
  enrichMissaoCard,
  IPT_MISSOES,
  IPT_TOTAL_MUNICIPIOS_PI,
  iptMissaoConfig,
  type IptMissaoFiltro,
  type IptMissaoId,
  type IptMissaoMudancaItem,
  type IptMissaoVariacao,
} from '@/lib/ipt-missoes'
import type { IptMunicipio } from '@/lib/ipt'
import { cn } from '@/lib/utils'

const MISSAO_ICONE = {
  expectativa: Target,
  campo: MapPin,
  pesquisa: Megaphone,
  digital: Smartphone,
  obras: Building2,
} as const

const SPARK: Record<IptMissaoId, number[]> = {
  expectativa: [48, 55, 60, 68, 72, 80, 88],
  campo: [28, 48, 36, 62, 44, 78, 55],
  pesquisa: [40, 32, 58, 46, 70, 52, 64],
  digital: [22, 38, 30, 55, 42, 68, 50],
  obras: [35, 50, 42, 60, 48, 72, 58],
}

type Props = {
  municipios: IptMunicipio[]
  contagem: Record<IptMissaoId, number>
  variacoes: Record<IptMissaoId, IptMissaoVariacao>
  missaoAtiva: IptMissaoFiltro
  /** Missões em que a cidade do filtro do header entra — destaque visual nos cards. */
  missoesDoMunicipio?: IptMissaoId[]
  municipioFiltro?: string | null
  loading?: boolean
  onSelect: (missao: IptMissaoId) => void
}

export function IptMissoesStrip({
  municipios,
  contagem,
  variacoes,
  missaoAtiva,
  missoesDoMunicipio = [],
  municipioFiltro = null,
  loading,
  onSelect,
}: Props) {
  const temFiltro = missaoAtiva !== 'todas'
  const temMuni = Boolean(municipioFiltro)
  const [modalMissao, setModalMissao] = useState<IptMissaoId | null>(null)

  const mudancasModal = modalMissao ? variacoes[modalMissao]?.mudancas ?? [] : []

  return (
    <section className="ipt-missoes" aria-label="Missões estratégicas">
      <div
        className={cn(
          'ipt-missoes__grid',
          temFiltro && 'ipt-missoes__grid--filtrado',
          temMuni && 'ipt-missoes__grid--muni'
        )}
      >
        {IPT_MISSOES.map((missao) => {
          const Icon = MISSAO_ICONE[missao.id]
          const qtd = contagem[missao.id]
          const ativo = missaoAtiva === missao.id
          const cidadeNesta = temMuni && missoesDoMunicipio.includes(missao.id)
          const spark = SPARK[missao.id]
          const sparkMax = Math.max(...spark)
          const vazia = qtd === 0
          const variacao = variacoes[missao.id]
          const enrich = enrichMissaoCard(missao.id, municipios, qtd, variacao)
          return (
            <button
              key={missao.id}
              type="button"
              disabled={loading}
              onClick={() => onSelect(missao.id)}
              className={cn(
                'ipt-missao-card',
                ativo && 'ipt-missao-card--active',
                temFiltro && !ativo && 'ipt-missao-card--muted',
                temMuni && !cidadeNesta && 'ipt-missao-card--fora-muni',
                cidadeNesta && 'ipt-missao-card--na-muni',
                vazia && 'ipt-missao-card--empty'
              )}
              style={
                {
                  '--missao-cor': missao.cor,
                  '--missao-suave': missao.corSuave,
                  '--missao-texto': missao.corTexto,
                  '--missao-tint': missao.corTint,
                } as CSSProperties
              }
              title={
                temMuni
                  ? cidadeNesta
                    ? `${municipioFiltro} está nesta missão`
                    : `${municipioFiltro} não está nesta missão`
                  : undefined
              }
            >
              <div className="ipt-missao-card__spark" aria-hidden>
                {spark.map((v, i) => (
                  <span
                    key={`${missao.id}-${i}`}
                    style={{ height: `${Math.max(22, (v / sparkMax) * 100)}%` }}
                  />
                ))}
              </div>

              <div className="ipt-missao-card__top">
                <span className="ipt-missao-card__icon" aria-hidden>
                  <CockpitIcon icon={Icon} size="sm" />
                </span>
                <span className="ipt-missao-card__badge">{missao.label}</span>
                {cidadeNesta ? (
                  <span className="ipt-missao-card__muni-tag">Nesta cidade</span>
                ) : null}
              </div>

              <p className="ipt-missao-card__titulo">{missao.titulo}</p>

              <p className="ipt-missao-card__desc">
                {temMuni && cidadeNesta ? (
                  <>
                    <strong>{municipioFiltro}</strong> entra nesta missão
                  </>
                ) : temMuni && !cidadeNesta ? (
                  <>Fora do recorte de {municipioFiltro}</>
                ) : vazia ? (
                  enrich.descricaoAtiva
                ) : (
                  <>
                    <strong>{qtd}</strong> municípios {enrich.descricaoAtiva}
                  </>
                )}
              </p>

              {!vazia ? (
                <ul className="ipt-missao-card__bullets">
                  <li>{enrich.tensao}</li>
                  <li>
                    {missao.id === 'expectativa'
                      ? `Universo Piauí: ${IPT_TOTAL_MUNICIPIOS_PI} municípios`
                      : enrich.epicentros}
                  </li>
                  <li className="ipt-missao-card__mudanca">
                    <MissaoMudancaLinha
                      rotulo={variacao.rotulo}
                      mudancas={variacao.mudancas}
                      onVerMais={() => setModalMissao(missao.id)}
                    />
                  </li>
                </ul>
              ) : null}

              <span className="ipt-missao-card__cta">
                Ver prioridades
                <span aria-hidden>→</span>
              </span>
            </button>
          )
        })}
      </div>

      {modalMissao && mudancasModal.length > 0 ? (
        <MudancasRecentesModal
          missao={modalMissao}
          mudancas={mudancasModal}
          onClose={() => setModalMissao(null)}
        />
      ) : null}
    </section>
  )
}

function MissaoMudancaLinha({
  rotulo,
  mudancas,
  onVerMais,
}: {
  rotulo: string
  mudancas: IptMissaoMudancaItem[]
  onVerMais: () => void
}) {
  const extras = Math.max(0, mudancas.length - 1)

  return (
    <span className="ipt-missao-card__mudanca-row">
      <span className="ipt-missao-card__mudanca-text" title={`Mudança recente: ${rotulo}`}>
        Mudança recente: {rotulo}
      </span>
      {extras > 0 ? (
        <button
          type="button"
          className="ipt-missao-card__ver-mais"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onVerMais()
          }}
        >
          ver mais
        </button>
      ) : null}
    </span>
  )
}

function MudancasRecentesModal({
  missao,
  mudancas,
  onClose,
}: {
  missao: IptMissaoId
  mudancas: IptMissaoMudancaItem[]
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const cfg = iptMissaoConfig(missao)
  const tituloId = `ipt-mudancas-${missao}`

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
        className="ipt-foco-modal__panel"
      >
        <div className="ipt-foco-modal__head">
          <div>
            <p className="ipt-foco-modal__eyebrow">Mudanças recentes</p>
            <h2 id={tituloId} className="ipt-foco-modal__title">
              {cfg.titulo} · {cfg.label}
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
        <p className="ipt-foco-modal__lead">
          {mudancas.length} município{mudancas.length === 1 ? '' : 's'} alteraram o
          recorte desde a última atualização.
        </p>
        <ul className="ipt-foco-modal__list ipt-mudancas-modal__list">
          {mudancas.map((item) => (
            <li key={`${item.sentido}-${item.municipio}`}>
              <div className="ipt-mudancas-modal__item">
                <span
                  className={cn(
                    'ipt-mudancas-modal__sentido',
                    item.sentido === 'entrou'
                      ? 'ipt-mudancas-modal__sentido--entrou'
                      : 'ipt-mudancas-modal__sentido--saiu'
                  )}
                >
                  {item.sentido === 'entrou' ? 'Entrou' : 'Saiu'}
                </span>
                <strong>{item.municipio}</strong>
                <em>{item.resumo}</em>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  )
}
