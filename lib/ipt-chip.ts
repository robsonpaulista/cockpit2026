import {
  formatObrasValorAbreviado,
  iptCorMunicipio,
  iptLabelTipoPesquisa,
  type IptIndicador,
  type IptMunicipio,
  type IptPrioridade,
  type IptSinal,
} from '@/lib/ipt'
import type { IptEvolucao } from '@/lib/ipt-evolucao'

export type IptChipZoom = 'far' | 'mid' | 'near'

export type IptChipTheme = {
  bg: string
  text: string
  sub: string
  border: string
  dot: string
}

/** Ícones stroke minimalistas (estilo Lucide) — sem emoji. */
const ICON = {
  visitas: `<svg class="ipt-chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  obras: `<svg class="ipt-chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 20h20"/><path d="M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/></svg>`,
  pesquisa: `<svg class="ipt-chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>`,
  digital: `<svg class="ipt-chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`,
  ok: `<svg class="ipt-chip-ico ipt-chip-ico--glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`,
  mal: `<svg class="ipt-chip-ico ipt-chip-ico--glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  neutro: `<svg class="ipt-chip-ico ipt-chip-ico--glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>`,
  vazio: `<svg class="ipt-chip-ico ipt-chip-ico--glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 12h8"/></svg>`,
} as const

const PRIORIDADE_THEME: Record<IptPrioridade, IptChipTheme> = {
  forte: { bg: '#ecfdf5', text: '#065f46', sub: '#047857', border: 'rgba(16,185,129,0.22)', dot: '#10b981' },
  estavel: { bg: '#fffbeb', text: '#92400e', sub: '#b45309', border: 'rgba(245,158,11,0.22)', dot: '#f59e0b' },
  atencao: { bg: '#fff7ed', text: '#c2410c', sub: '#ea580c', border: 'rgba(249,115,22,0.22)', dot: '#f97316' },
  critico: { bg: '#fef2f2', text: '#b91c1c', sub: '#dc2626', border: 'rgba(239,68,68,0.2)', dot: '#ef4444' },
  sem_expectativa: { bg: '#f8fafc', text: '#64748b', sub: '#94a3b8', border: 'rgba(148,163,184,0.28)', dot: '#94a3b8' },
}

const SINAL_THEME: Record<IptSinal, IptChipTheme> = {
  bem: { bg: '#ecfdf5', text: '#065f46', sub: '#047857', border: 'rgba(16,185,129,0.22)', dot: '#10b981' },
  neutro: { bg: '#fffbeb', text: '#92400e', sub: '#b45309', border: 'rgba(245,158,11,0.22)', dot: '#f59e0b' },
  mal: { bg: '#fef2f2', text: '#b91c1c', sub: '#dc2626', border: 'rgba(239,68,68,0.2)', dot: '#ef4444' },
  sem_dado: { bg: '#f8fafc', text: '#64748b', sub: '#94a3b8', border: 'rgba(148,163,184,0.28)', dot: '#94a3b8' },
}

export function iptChipTheme(m: IptMunicipio, indicador: IptIndicador | null): IptChipTheme {
  if (indicador) return SINAL_THEME[m.sinais[indicador]]
  return PRIORIDADE_THEME[m.prioridade]
}

/** Tema visual alinhado aos chips do mapa — toolbar de filtros. */
export function iptPrioridadeTheme(prioridade: IptPrioridade): IptChipTheme {
  return PRIORIDADE_THEME[prioridade]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sinalGlyph(sinal: IptSinal): string {
  if (sinal === 'bem') return ICON.ok
  if (sinal === 'mal') return ICON.mal
  if (sinal === 'neutro') return ICON.neutro
  return ICON.vazio
}

function chipItem(icone: string, texto: string): string {
  return `<span class="ipt-chip-item">${icone}<span class="ipt-chip-item__txt">${escapeHtml(texto)}</span></span>`
}

function chipGlyphItem(icone: string, glyph: string): string {
  return `<span class="ipt-chip-item ipt-chip-item--glyph">${icone}${glyph}</span>`
}

function evoMark(e: IptEvolucao): string {
  if (e === 'cresceu') return ' ↑'
  if (e === 'diminuiu') return ' ↓'
  if (e === 'estavel') return ' →'
  return ''
}

function textoVisitasOperacional(n: number, evo?: IptEvolucao): string {
  return `${n} visita${n === 1 ? '' : 's'}${evo ? evoMark(evo) : ''}`
}

function textoObrasOperacional(valor: number): string {
  if (!Number.isFinite(valor) || valor <= 0) return 'Sem obras'
  return formatObrasValorAbreviado(valor).replace(/ obras$/, '')
}

function textoPesquisaOperacional(m: IptMunicipio): string {
  const { detalhes } = m
  if (detalhes.pesquisaTop5.length === 0) return 'Sem pesquisa'
  const media =
    detalhes.pesquisaMediaPct != null
      ? `${detalhes.pesquisaMediaPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
      : null
  const pos = detalhes.pesquisaPosicaoTop5
  const base = pos == null ? 'Fora do Top 5' : `${pos}º ${iptLabelTipoPesquisa(detalhes.pesquisaBase)}`
  const mediaPart = media ? ` · ${media}` : ''
  return `${base}${mediaPart}${evoMark(m.evolucao.pesquisa)}`
}

/** Posição no chip compacto (visão geral) — sem glyph de check. */
function textoPesquisaChipCompacto(m: IptMunicipio): string {
  const { detalhes, sinais } = m
  if (sinais.pesquisa === 'sem_dado' || detalhes.pesquisaTop5.length === 0) return 'Sem pesquisa'
  const pos = detalhes.pesquisaPosicaoTop5
  if (pos == null) return `Fora Top 5${evoMark(m.evolucao.pesquisa)}`
  return `${pos}º${evoMark(m.evolucao.pesquisa)}`
}

function textoDigitalOperacional(m: IptMunicipio): string {
  const seg = m.detalhes.digitalSeguidores
  if (seg == null || seg <= 0) return 'Sem dado'
  const pct = m.detalhes.digitalSeguidoresPct
  const pctTxt =
    pct != null && Number.isFinite(pct)
      ? ` · ${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
      : ''
  return `${seg.toLocaleString('pt-BR')}${pctTxt}${evoMark(m.evolucao.digitalSeguidores)}`
}

/** Linha única quando há filtro por indicador. */
export function iptChipLinhaIndicador(m: IptMunicipio, indicador: IptIndicador): string {
  const { detalhes } = m
  if (indicador === 'visitas') {
    return chipItem(ICON.visitas, textoVisitasOperacional(detalhes.visitasNoPeriodo, m.evolucao.visitas))
  }
  if (indicador === 'obras') {
    return chipItem(ICON.obras, textoObrasOperacional(detalhes.obrasValorTotal))
  }
  if (indicador === 'digital') {
    return chipItem(ICON.digital, textoDigitalOperacional(m))
  }
  return chipItem(ICON.pesquisa, textoPesquisaOperacional(m))
}

/** Visão geral — três indicadores compactos. */
export function iptChipLinhaGeral(m: IptMunicipio): string {
  const { detalhes, sinais } = m
  const visitas = chipItem(
    ICON.visitas,
    textoVisitasOperacional(detalhes.visitasNoPeriodo, m.evolucao.visitas)
  )

  const obras =
    sinais.obras === 'mal'
      ? chipItem(ICON.obras, 'Sem obras')
      : chipGlyphItem(
          ICON.obras,
          detalhes.obrasValorTotal > 0
            ? `<span class="ipt-chip-item__txt">${escapeHtml(textoObrasOperacional(detalhes.obrasValorTotal))}</span>`
            : sinalGlyph(sinais.obras)
        )

  const pesquisa = chipItem(ICON.pesquisa, textoPesquisaChipCompacto(m))

  return `${visitas}<span class="ipt-chip-sep" aria-hidden="true"></span>${obras}<span class="ipt-chip-sep" aria-hidden="true"></span>${pesquisa}`
}

export function iptChipDeveExibir(m: IptMunicipio, indicador: IptIndicador | null = null): boolean {
  if (indicador === 'digital') return m.sinais.digital !== 'sem_dado'
  return m.prioridade !== 'sem_expectativa'
}

/** HTML do chip (etiqueta) permanente no mapa. */
export function createIptChipHtml(
  m: IptMunicipio,
  indicador: IptIndicador | null = null,
  opts?: { municipioKey?: string; animDelay?: number }
): string {
  if (!iptChipDeveExibir(m, indicador)) return ''

  const theme =
    indicador === 'digital' ? SINAL_THEME[m.sinais.digital] : iptPrioridadeTheme(m.prioridade)
  const linha = indicador ? iptChipLinhaIndicador(m, indicador) : iptChipLinhaGeral(m)
  const key = opts?.municipioKey ?? m.municipio
  const delay = opts?.animDelay ?? 0

  return `<div class="ipt-chip ipt-chip--enter" data-ipt-municipio="${escapeHtml(key)}" style="--ipt-chip-delay:${delay}ms;--ipt-chip-bg:${theme.bg};--ipt-chip-text:${theme.text};--ipt-chip-sub:${theme.sub};--ipt-chip-border:${theme.border};--ipt-chip-dot:${theme.dot}">
    <div class="ipt-chip__nome">${escapeHtml(m.municipio)}</div>
    <div class="ipt-chip__linha">${linha}</div>
  </div>`
}

export function iptZoomLevel(zoom: number): IptChipZoom {
  if (zoom >= 10) return 'near'
  if (zoom >= 8) return 'mid'
  return 'far'
}
