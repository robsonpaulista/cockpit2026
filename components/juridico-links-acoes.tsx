'use client'

import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Check, ExternalLink, FileText } from 'lucide-react'
import { fetchJuridicoComunicacoes } from '@/lib/services/juridico-processos'
import {
  buildProcessoLinksConsulta,
  mergeUltimaComunicacaoDjen,
  type ProcessoLinksConsulta,
} from '@/lib/juridico-links-consulta'
import {
  abrirConsultaTribunal,
  copiarNumeroProcesso,
  tituloAbrirConsultaTribunal,
} from '@/lib/juridico-tribunal-abrir'
import type { ProcessoDimensao } from '@/lib/juridico-processos-dimensao'
import { cn } from '@/lib/utils'

function formatDataDjen(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  return iso
}

function LinkChip({
  href,
  label,
  title,
  icon: Icon,
  destaque,
}: {
  href: string
  label: string
  title?: string
  icon?: typeof ExternalLink
  destaque?: boolean
}) {
  const I = Icon ?? ExternalLink
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? label}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition',
        destaque
          ? 'border-accent-gold/50 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20'
          : 'border-border-card text-text-secondary hover:border-border-card hover:bg-bg-app hover:text-text-primary'
      )}
    >
      <I className="h-3 w-3 shrink-0" />
      {label}
    </a>
  )
}

function TribunalLinkChip({
  href,
  label,
  title,
  numeroFormatado,
}: {
  href: string
  label: string
  title?: string
  numeroFormatado: string | null
}) {
  const [copiado, setCopiado] = useState(false)

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!numeroFormatado) return
    e.preventDefault()
    void copiarNumeroProcesso(numeroFormatado).then((ok) => {
      if (ok) {
        setCopiado(true)
        window.setTimeout(() => setCopiado(false), 2500)
      }
      abrirConsultaTribunal(href)
    })
  }

  const chipTitle =
    title ??
    tituloAbrirConsultaTribunal(numeroFormatado, label === 'Tribunal' ? null : label)

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={chipTitle}
      onClick={numeroFormatado ? handleClick : undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition',
        copiado
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'border-border-card text-text-secondary hover:border-border-card hover:bg-bg-app hover:text-text-primary'
      )}
    >
      {copiado ? (
        <Check className="h-3 w-3 shrink-0" aria-hidden />
      ) : (
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
      )}
      {copiado ? 'Nº copiado' : label}
    </a>
  )
}

type Props = {
  processo: ProcessoDimensao
  /** Na linha da tabela: só links fixos. No modal: busca última intimação DJEN. */
  buscarUltimaDjen?: boolean
  className?: string
}

export function JuridicoLinksAcoes({ processo, buscarUltimaDjen = false, className }: Props) {
  const base = useMemo(
    () => processo.linksConsulta ?? buildProcessoLinksConsulta(processo),
    [processo]
  )
  const [links, setLinks] = useState<ProcessoLinksConsulta>(base)

  useEffect(() => {
    setLinks(base)
  }, [base])

  useEffect(() => {
    if (!buscarUltimaDjen) return
    let cancel = false
    void fetchJuridicoComunicacoes(processo.id).then((res) => {
      if (cancel || res.comunicacoes.length === 0) return
      const u = res.comunicacoes[0]
      const data = formatDataDjen(u.dataDisponibilizacao)
      setLinks((prev) =>
        mergeUltimaComunicacaoDjen(prev, u.hash, u.tipoComunicacao, data)
      )
    })
    return () => {
      cancel = true
    }
  }, [buscarUltimaDjen, processo.id])

  const temAlgumLink =
    links.djenUltimaCertidaoUrl || links.djenConsultaUrl || links.tribunalConsultaUrl

  if (!temAlgumLink) {
    return <span className="text-xs text-text-secondary">—</span>
  }

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-1', className)}>
      {links.djenUltimaCertidaoUrl ? (
        <LinkChip
          href={links.djenUltimaCertidaoUrl}
          label="DJEN"
          icon={FileText}
          destaque
          title={
            links.djenUltimaRotulo
              ? `${links.djenUltimaRotulo} — certidão PDF (última comunicação)`
              : 'Certidão PDF da última comunicação DJEN'
          }
        />
      ) : links.djenConsultaUrl ? (
        <LinkChip
          href={links.djenConsultaUrl}
          label="DJEN"
          title="Buscar comunicações no Diário de Justiça Eletrônico"
        />
      ) : null}
      {links.tribunalConsultaUrl ? (
        <TribunalLinkChip
          href={links.tribunalConsultaUrl}
          label="Tribunal"
          numeroFormatado={links.tribunalNumeroFormatado}
          title={tituloAbrirConsultaTribunal(
            links.tribunalNumeroFormatado,
            links.tribunalRotulo
          )}
        />
      ) : null}
    </div>
  )
}
