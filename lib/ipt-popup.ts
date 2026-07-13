import {
  IPT_VISITAS_JANELA_DIAS,
  IPT_SINAL_LABEL,
  iptLabelIndicador,
  iptPrioridadeCor,
  iptPrioridadeLabel,
  iptRotuloSinalIndicador,
  iptSinalCor,
  formatObrasValorAbreviado,
  type IptIndicador,
  type IptMunicipio,
  type IptPesquisaBase,
  type IptPesquisaTopItem,
  type IptSinal,
} from '@/lib/ipt'
import {
  iptEvolucaoCor,
  iptEvolucaoLabel,
  type IptEvolucao,
} from '@/lib/ipt-evolucao'
import {
  createIptChipHtml,
  iptChipTheme,
} from '@/lib/ipt-chip'
import { createIptInsightsSectionShell, overrideBadgeHtml } from '@/lib/ipt-popup-insights'
import {
  formatExpectativaCompact,
  formatPesoExpectativaPct,
} from '@/lib/territorio-expectativa-visitas-cobertura'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sinalColor(sinal: IptSinal): string {
  if (sinal === 'bem') return '#059669'
  if (sinal === 'mal') return '#dc2626'
  if (sinal === 'neutro') return '#ca8a04'
  return '#94a3b8'
}

function formatPp(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} p.p.`
}

function formatPctNum(n: number): string {
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`
}

function formatPctSeguidores(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return '—'
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`
}

const ICON = {
  mapPin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  building: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 20h20"/><path d="M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/></svg>`,
  chart: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>`,
  phone: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`,
  check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`,
  x: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  minus: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>`,
  trendUp: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/></svg>`,
  trendDown: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/></svg>`,
  trendFlat: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>`,
} as const

function sinalGlyph(sinal: IptSinal): string {
  if (sinal === 'bem') return ICON.check
  if (sinal === 'mal') return ICON.x
  return ICON.minus
}

function evoGlyph(e: IptEvolucao): string {
  if (e === 'cresceu') return ICON.trendUp
  if (e === 'diminuiu') return ICON.trendDown
  if (e === 'estavel') return ICON.trendFlat
  return ICON.minus
}

function statusChip(sinal: IptSinal, rotulo: string): string {
  const cor = sinalColor(sinal)
  return `<span style="display:inline-flex;align-items:center;gap:5px;max-width:100%;font-size:11px;font-weight:600;color:${cor};line-height:1.25">
    <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:999px;background:${cor}14;color:${cor};flex-shrink:0">${sinalGlyph(sinal)}</span>
    <span style="min-width:0;overflow-wrap:anywhere">${escapeHtml(rotulo)}</span>
  </span>`
}

function evoChip(e: IptEvolucao): string {
  if (e === 'sem_dado') {
    return `<span style="font-size:11px;font-weight:500;color:#94a3b8">Sem dado</span>`
  }
  const cor = iptEvolucaoCor(e)
  return `<span style="display:inline-flex;align-items:center;gap:5px;max-width:100%;font-size:11px;font-weight:600;color:${cor}">
    <span style="display:inline-flex;flex-shrink:0">${evoGlyph(e)}</span>
    <span style="min-width:0">${escapeHtml(iptEvolucaoLabel(e))}</span>
  </span>`
}

function labelPesquisa(base: IptPesquisaBase | null): string {
  if (base === 'espontanea') return 'Pesquisa · espontânea'
  return 'Pesquisa · estimulada'
}

function metricPair(
  leftLabel: string,
  leftValue: string,
  rightLabel: string,
  rightValue: string,
  muted: string,
  text: string
): string {
  return `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px;margin-top:8px">
    <div style="min-width:0">
      <div style="font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${muted}">${escapeHtml(leftLabel)}</div>
      <div style="margin-top:2px;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;color:${text};overflow-wrap:anywhere">${escapeHtml(leftValue)}</div>
    </div>
    <div style="min-width:0">
      <div style="font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${muted}">${escapeHtml(rightLabel)}</div>
      <div style="margin-top:2px;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;color:${text};overflow-wrap:anywhere">${escapeHtml(rightValue)}</div>
    </div>
  </div>`
}

function indicadorHeader(opts: {
  icon: string
  title: string
  sinal: IptSinal
  rotulo: string
  muted: string
  destaque?: boolean
  destaqueCor?: string
  ajustado?: string
  compact?: boolean
}): string {
  const accent = opts.destaque
    ? `border-left:3px solid ${opts.destaqueCor ?? sinalColor(opts.sinal)};padding-left:8px`
    : ''
  return `<div style="min-width:0;overflow:hidden;${accent}">
    <div style="display:flex;align-items:center;gap:6px;min-width:0">
      <span style="display:inline-flex;flex-shrink:0;color:${opts.muted}">${opts.icon}</span>
      <span style="font-size:12px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(opts.title)}${opts.ajustado ?? ''}</span>
    </div>
    <div style="margin-top:4px;min-width:0">${statusChip(opts.sinal, opts.rotulo)}</div>
  </div>`
}

function cell(
  content: string,
  line: string,
  last = false,
  soUma = false
): string {
  const pad = soUma ? '14px 16px' : '10px 10px'
  const border = !last && !soUma ? `border-right:1px solid ${line};` : ''
  return `<div style="min-width:0;overflow:hidden;box-sizing:border-box;padding:${pad};display:flex;flex-direction:column;${border}">${content}</div>`
}

function rankingList(
  top5: IptPesquisaTopItem[],
  muted: string,
  text: string
): string {
  if (top5.length === 0) return ''
  const rows = top5
    .map((c, i) => {
      const pct = c.mediaPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
      const strong = i === 0
      return `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:3px 0${i > 0 ? `;border-top:1px solid ${muted}18` : ''}">
        <span style="font-size:11px;line-height:1.3;color:${text};min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${strong ? 'font-weight:600' : 'font-weight:400'}">
          <span style="display:inline-block;width:1.4em;color:${muted};font-variant-numeric:tabular-nums">${i + 1}º</span>${escapeHtml(c.nome)}
        </span>
        <span style="flex-shrink:0;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;color:${text}">${escapeHtml(pct)}%</span>
      </div>`
    })
    .join('')
  return `<div style="margin-top:6px">${rows}</div>`
}

function detalhePesoExpectativa(m: IptMunicipio): string {
  if (m.expectativaVotos <= 0) return 'Sem expectativa cadastrada'
  return `${formatExpectativaCompact(m.expectativaVotos)} votos · ${formatPesoExpectativaPct(m.pesoExpectativaPct)}% da expectativa`
}

/** Separador + bloco de evolução dentro da coluna. */
function evoDentroColuna(
  evolucao: IptEvolucao | null,
  detalhe: string,
  muted: string,
  line: string,
  opts?: { semSerie?: boolean }
): string {
  if (opts?.semSerie) {
    return `<div style="margin-top:auto;padding-top:10px;border-top:1px solid ${line}">
      <div style="font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${muted}">Evolução</div>
      <div style="margin-top:5px;font-size:11px;line-height:1.35;color:${muted}">Sem série eleitoral</div>
    </div>`
  }
  return `<div style="margin-top:auto;padding-top:10px;border-top:1px solid ${line}">
    <div style="font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${muted}">Evolução</div>
    ${evolucao != null ? `<div style="margin-top:4px">${evoChip(evolucao)}</div>` : ''}
    <div style="margin-top:5px;font-size:11px;line-height:1.35;color:${muted};overflow-wrap:anywhere">${detalhe}</div>
  </div>`
}

/** Colunas: atual em cima, evolução embaixo (separados). */
function quadroIndicadores(
  m: IptMunicipio,
  muted: string,
  text: string,
  line: string,
  indicador: IptIndicador | null
): string {
  const { detalhes } = m
  const visitasAjustado = m.overridesAtivos?.visitas ? overrideBadgeHtml('visitas', muted) : ''
  const obrasAjustado = m.overridesAtivos?.obras ? overrideBadgeHtml('obras', muted) : ''
  const pesquisaAjustado = m.overridesAtivos?.pesquisa ? overrideBadgeHtml('pesquisa', muted) : ''

  const visitasAtual = Math.max(0, detalhes.visitasNoPeriodo)
  const visitasAnt = Math.max(0, detalhes.visitasPeriodoAnterior)
  const obrasTxt =
    !Number.isFinite(detalhes.obrasValorTotal) || detalhes.obrasValorTotal <= 0
      ? 'Sem obras'
      : formatObrasValorAbreviado(detalhes.obrasValorTotal)

  const pos =
    detalhes.pesquisaPosicaoTop5 != null
      ? `${detalhes.pesquisaPosicaoTop5}º`
      : detalhes.pesquisaTop5.length > 0
        ? 'Fora top 5'
        : '—'
  const media =
    detalhes.pesquisaMediaPct != null ? formatPctNum(detalhes.pesquisaMediaPct) : '—'

  const temSeg = detalhes.digitalSeguidores != null && detalhes.digitalSeguidores > 0
  const temEng = detalhes.digitalContasEngajadas != null && detalhes.digitalContasEngajadas > 0
  const segTxt = temSeg ? detalhes.digitalSeguidores!.toLocaleString('pt-BR') : '—'
  const engTxt = temEng ? detalhes.digitalContasEngajadas!.toLocaleString('pt-BR') : '—'

  let pesquisaEvoDetalhe = 'Sem pesquisa para classificar'
  if (detalhes.pesquisaRecentePct != null && detalhes.pesquisaAnteriorPct != null && detalhes.pesquisaDeltaPp != null) {
    const deltaCor =
      detalhes.pesquisaDeltaPp > 0 ? '#059669' : detalhes.pesquisaDeltaPp < 0 ? '#dc2626' : muted
    pesquisaEvoDetalhe = `<div><strong style="color:${text};font-variant-numeric:tabular-nums">${escapeHtml(formatPctNum(detalhes.pesquisaRecentePct))}</strong>
      <span> vs </span>
      <strong style="color:${text};font-variant-numeric:tabular-nums">${escapeHtml(formatPctNum(detalhes.pesquisaAnteriorPct))}</strong></div>
      <div style="margin-top:2px;font-weight:700;font-variant-numeric:tabular-nums;color:${deltaCor}">${escapeHtml(formatPp(detalhes.pesquisaDeltaPp))}</div>`
  } else if (detalhes.pesquisaRecentePct != null || detalhes.pesquisaMediaPct != null) {
    const pct = detalhes.pesquisaRecentePct ?? detalhes.pesquisaMediaPct
    pesquisaEvoDetalhe = `Uma onda · ${escapeHtml(formatPctNum(pct!))} (sem anterior → estável)`
  }

  const deltaSeg =
    detalhes.digitalSeguidores != null && detalhes.digitalSeguidoresAnterior != null
      ? (() => {
          const d = detalhes.digitalSeguidores - detalhes.digitalSeguidoresAnterior
          return `${d > 0 ? '+' : ''}${d.toLocaleString('pt-BR')}`
        })()
      : null
  const deltaEng =
    detalhes.digitalContasEngajadas != null && detalhes.digitalContasEngajadasAnterior != null
      ? (() => {
          const d = detalhes.digitalContasEngajadas - detalhes.digitalContasEngajadasAnterior
          return `${d > 0 ? '+' : ''}${d.toLocaleString('pt-BR')}`
        })()
      : null

  let digitalEvoDetalhe = 'Sem histórico ainda'
  if (deltaSeg != null || deltaEng != null) {
    const parts: string[] = []
    if (deltaSeg != null) parts.push(`Seg. <strong style="color:${text}">${escapeHtml(deltaSeg)}</strong>`)
    if (deltaEng != null) parts.push(`Eng. <strong style="color:${text}">${escapeHtml(deltaEng)}</strong>`)
    digitalEvoDetalhe = parts.join(' · ')
  }

  const visitasEvoDetalhe =
    m.evolucao.visitas === 'sem_dado'
      ? 'Sem visitas nos períodos'
      : `${visitasAtual} (0–${IPT_VISITAS_JANELA_DIAS}d) vs ${visitasAnt} (31–60d)`

  const colVisitas = `
    ${indicadorHeader({
      icon: ICON.mapPin,
      title: 'Visitas',
      sinal: m.sinais.visitas,
      rotulo: IPT_SINAL_LABEL[m.sinais.visitas],
      muted,
      destaque: indicador === 'visitas',
      destaqueCor: sinalColor(m.sinais.visitas),
      ajustado: visitasAjustado,
      compact: true,
    })}
    <div style="margin-top:8px;font-size:18px;font-weight:700;font-variant-numeric:tabular-nums;color:${text};line-height:1.1">${visitasAtual}</div>
    <div style="margin-top:3px;font-size:11px;color:${muted}">últimos ${IPT_VISITAS_JANELA_DIAS} dias</div>
    ${evoDentroColuna(m.evolucao.visitas, visitasEvoDetalhe, muted, line)}`

  const colObras = `
    ${indicadorHeader({
      icon: ICON.building,
      title: 'Obras',
      sinal: m.sinais.obras,
      rotulo: iptRotuloSinalIndicador('obras', m.sinais.obras),
      muted,
      destaque: indicador === 'obras',
      destaqueCor: sinalColor(m.sinais.obras),
      ajustado: obrasAjustado,
      compact: true,
    })}
    <div style="margin-top:8px;font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;color:${text};line-height:1.2">${escapeHtml(obrasTxt)}</div>
    ${evoDentroColuna(null, '', muted, line, { semSerie: true })}`

  const colDigital = `
    ${indicadorHeader({
      icon: ICON.phone,
      title: 'Digital',
      sinal: m.sinais.digital,
      rotulo: iptRotuloSinalIndicador('digital', m.sinais.digital),
      muted,
      destaque: indicador === 'digital',
      destaqueCor: '#C8900A',
      compact: true,
    })}
    ${
      !temSeg && !temEng
        ? `<div style="margin-top:8px;font-size:11px;color:${muted}">Sem dado no top IG</div>`
        : `<div style="margin-top:8px">
            <div style="font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${muted}">Seguidores</div>
            <div style="font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;color:${text}">${escapeHtml(segTxt)}</div>
            <div style="font-size:10px;color:${muted}">${escapeHtml(formatPctSeguidores(detalhes.digitalSeguidoresPct))} do total</div>
            <div style="margin-top:6px;font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${muted}">Engajaram</div>
            <div style="font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;color:${text}">${escapeHtml(engTxt)}</div>
            <div style="font-size:10px;color:${muted}">~30 dias</div>
          </div>`
    }
    ${evoDentroColuna(m.evolucao.digitalSeguidores, digitalEvoDetalhe, muted, line)}`

  const colPesquisa = `
    ${indicadorHeader({
      icon: ICON.chart,
      title: labelPesquisa(detalhes.pesquisaBase),
      sinal: m.sinais.pesquisa,
      rotulo: IPT_SINAL_LABEL[m.sinais.pesquisa],
      muted,
      destaque: indicador === 'pesquisa',
      destaqueCor: sinalColor(m.sinais.pesquisa),
      ajustado: pesquisaAjustado,
      compact: true,
    })}
    ${
      detalhes.pesquisaTop5.length === 0
        ? `<div style="margin-top:8px;font-size:11px;color:${muted}">Sem pesquisa</div>`
        : `${metricPair('Média', media, 'Posição', pos, muted, text)}
          <div style="margin-top:8px">
            <div style="font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${muted}">Ranking</div>
            ${rankingList(detalhes.pesquisaTop5, muted, text)}
          </div>`
    }
    ${evoDentroColuna(m.evolucao.pesquisa, pesquisaEvoDetalhe, muted, line)}`

  type ColId = 'visitas' | 'obras' | 'digital' | 'pesquisa'
  const cols: Array<{ id: ColId; html: string }> = [
    { id: 'visitas', html: colVisitas },
    { id: 'obras', html: colObras },
    { id: 'digital', html: colDigital },
    { id: 'pesquisa', html: colPesquisa },
  ]

  const visiveis =
    indicador == null ? cols : cols.filter((c) => c.id === indicador)

  if (visiveis.length === 0) return ''

  const soUma = visiveis.length === 1
  const gridCols = soUma
    ? 'minmax(0,1fr)'
    : 'minmax(0,1fr) minmax(0,1fr) minmax(0,1.15fr) minmax(0,1.55fr)'

  const cellsHtml = visiveis
    .map((c, i) => cell(c.html, line, i === visiveis.length - 1, soUma))
    .join('')

  return `<div style="margin-top:12px;border:1px solid ${line};border-radius:12px;background:rgba(148,163,184,0.04);overflow:hidden">
    <div style="display:grid;grid-template-columns:${gridCols}">
      ${cellsHtml}
    </div>
  </div>`
}

/** Chip (etiqueta) permanente no mapa — substitui o mini card. */
export function createIptTooltipBasicoHtml(
  m: IptMunicipio,
  _appearance: 'light' | 'dark' = 'light',
  indicador: IptIndicador | null = null,
  opts?: { municipioKey?: string; animDelay?: number; evolucaoFiltro?: import('@/lib/ipt-evolucao').IptEvolucaoFiltro }
): string {
  return createIptChipHtml(m, indicador, opts)
}

export function createIptPopupHtml(
  m: IptMunicipio,
  appearance: 'light' | 'dark' = 'light',
  indicador: IptIndicador | null = null
): string {
  const isDark = appearance === 'dark'
  const text = isDark ? '#f1f5f9' : '#0f172a'
  const muted = isDark ? '#94a3b8' : '#64748b'
  const line = isDark ? 'rgba(148,163,184,0.22)' : '#e8edf3'
  const sinalContexto = indicador ? m.sinais[indicador] : null
  const cor =
    indicador && sinalContexto != null
      ? iptSinalCor(sinalContexto)
      : iptPrioridadeCor(m.prioridade)
  const status =
    indicador && sinalContexto != null
      ? iptRotuloSinalIndicador(indicador, sinalContexto)
      : iptPrioridadeLabel(m.prioridade)

  const contextoLente =
    indicador != null
      ? `<div style="margin-top:4px;font-size:11px;color:${muted}">${escapeHtml(iptLabelIndicador(indicador))} · prioridade geral: ${escapeHtml(iptPrioridadeLabel(m.prioridade))}</div>`
      : ''

  const popupSize =
    indicador != null
      ? 'min-width:280px;max-width:380px;width:min(380px,92vw)'
      : 'min-width:560px;max-width:640px;width:min(640px,92vw)'

  return `<div style="${popupSize};font-family:system-ui,-apple-system,sans-serif;padding:14px 16px 10px;color:${text};box-sizing:border-box" class="ipt-popup-root">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div style="min-width:0">
        <div style="font-weight:700;font-size:16px;letter-spacing:-0.02em;color:${text}">${escapeHtml(m.municipio)}</div>
        ${contextoLente}
        <div style="margin-top:4px;font-size:12px;line-height:1.35;color:${muted}">${escapeHtml(detalhePesoExpectativa(m))}</div>
      </div>
      <div style="display:inline-flex;align-items:center;gap:7px;padding:5px 10px;border-radius:999px;background:${cor}14;flex-shrink:0">
        <span style="width:8px;height:8px;border-radius:999px;background:${cor}"></span>
        <span style="font-size:12px;font-weight:700;color:${cor}">${escapeHtml(status)}</span>
      </div>
    </div>

    ${quadroIndicadores(m, muted, text, line, indicador)}

    ${createIptInsightsSectionShell(m, appearance)}
  </div>`
}

export function createIptMarkerHtml(
  m: IptMunicipio,
  size: number,
  animDelay = 0,
  indicador: IptIndicador | null = null,
  evolucaoFiltro: import('@/lib/ipt-evolucao').IptEvolucaoFiltro = 'todos'
): string {
  const theme = iptChipTheme(m, indicador, evolucaoFiltro)
  const noVotesClass =
    indicador != null
      ? m.sinais[indicador] === 'sem_dado'
        ? ' mapa-ipt-marker--no-votes'
        : ''
      : m.prioridade === 'sem_expectativa'
        ? ' mapa-ipt-marker--no-votes'
        : ''
  return `<div class="mapa-marker-dot mapa-ipt-marker${noVotesClass}" style="
    width:${size}px;height:${size}px;
    background:${theme.dot};
    border:2px solid rgba(255,255,255,0.95);
    box-shadow:0 1px 4px rgba(15,23,42,0.18);
    animation-delay:${animDelay}ms;
  "></div>`
}
