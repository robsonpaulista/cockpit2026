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
  createIptChipHtml,
  iptPrioridadeTheme,
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

function sinalIcon(sinal: IptSinal): string {
  if (sinal === 'bem') return '✓'
  if (sinal === 'mal') return '✕'
  if (sinal === 'neutro') return '~'
  return '—'
}

function sinalColor(sinal: IptSinal): string {
  if (sinal === 'bem') return '#059669'
  if (sinal === 'mal') return '#dc2626'
  if (sinal === 'neutro') return '#ca8a04'
  return '#94a3b8'
}

function detalheVisitas(qtd: number): string {
  const n = Math.max(0, qtd)
  return `${n} visita${n === 1 ? '' : 's'} nos últimos ${IPT_VISITAS_JANELA_DIAS} dias`
}

function detalheObras(valor: number): string {
  if (!Number.isFinite(valor) || valor <= 0) return 'Nenhuma obra destinada'
  return formatObrasValorAbreviado(valor)
}

function detalhePesoExpectativa(m: IptMunicipio): string {
  if (m.expectativaVotos <= 0) return 'Sem expectativa cadastrada na planilha'
  return `${formatExpectativaCompact(m.expectativaVotos)} votos · ${formatPesoExpectativaPct(m.pesoExpectativaPct)}% da expectativa total`
}

function labelPesquisa(base: IptPesquisaBase | null): string {
  if (base === 'espontanea') return 'Pesquisa (espontânea)'
  return 'Pesquisa (estimulada)'
}

function detalhePesquisa(
  posicao: number | null,
  top5: IptPesquisaTopItem[],
  base: IptPesquisaBase | null
): string {
  if (top5.length === 0) return 'Sem pesquisa cadastrada'
  const ranking = top5
    .map((c, i) => `${i + 1}º ${c.nome} (${c.mediaPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`)
    .join(' · ')
  const prefix =
    base === 'espontanea' && posicao != null
      ? `${posicao}º lugar (espontânea) · `
      : posicao != null
        ? `${posicao}º lugar · `
        : base === 'espontanea'
          ? 'Fora do top 5 (espontânea) · '
          : 'Fora do top 5 · '
  return `${prefix}${ranking}`
}

function sinalRow(
  label: string,
  sinal: IptSinal,
  detalhe: string,
  muted: string,
  rotulos?: Partial<Record<IptSinal, string>>,
  destaque = false,
  indicador?: IptIndicador,
  overridesAtivos?: IptMunicipio['overridesAtivos']
): string {
  const rotulo = rotulos?.[sinal] ?? IPT_SINAL_LABEL[sinal]
  const destaqueStyle = destaque
    ? `border-left:3px solid ${sinalColor(sinal)};padding-left:10px;margin-left:-2px;border-radius:0 6px 6px 0`
    : ''
  const ajustado =
    indicador && overridesAtivos?.[indicador]
      ? overrideBadgeHtml(indicador, muted)
      : ''
  return `<div style="margin-top:12px;${destaqueStyle}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
      <span style="font-size:13px;font-weight:600;color:inherit;flex:1;min-width:0">${escapeHtml(label)}${ajustado}</span>
      <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:${sinalColor(sinal)};flex-shrink:0">
        <span style="width:18px;height:18px;border-radius:999px;background:${sinalColor(sinal)}18;color:${sinalColor(sinal)};display:inline-flex;align-items:center;justify-content:center;font-size:11px">${sinalIcon(sinal)}</span>
        ${escapeHtml(rotulo)}
      </span>
    </div>
    <div style="margin-top:4px;font-size:11px;line-height:1.45;color:${muted}">${escapeHtml(detalhe)}</div>
  </div>`
}

/** Chip (etiqueta) permanente no mapa — substitui o mini card. */
export function createIptTooltipBasicoHtml(
  m: IptMunicipio,
  _appearance: 'light' | 'dark' = 'light',
  indicador: IptIndicador | null = null,
  opts?: { municipioKey?: string; animDelay?: number }
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
  const line = isDark ? 'rgba(148,163,184,0.25)' : '#e2e8f0'
  const sinalContexto = indicador ? m.sinais[indicador] : null
  const cor =
    indicador && sinalContexto != null
      ? iptSinalCor(sinalContexto)
      : iptPrioridadeCor(m.prioridade)
  const status =
    indicador && sinalContexto != null
      ? iptRotuloSinalIndicador(indicador, sinalContexto)
      : iptPrioridadeLabel(m.prioridade)
  const { detalhes } = m

  const contextoLente =
    indicador != null
      ? `<div style="margin-top:4px;font-size:10px;line-height:1.4;color:${muted}">${escapeHtml(iptLabelIndicador(indicador))} · prioridade geral: ${escapeHtml(iptPrioridadeLabel(m.prioridade))}</div>`
      : ''

  return `<div style="min-width:260px;max-width:340px;font-family:system-ui,-apple-system,sans-serif;padding:14px 16px 12px;color:${text}" class="ipt-popup-root">
    <div style="font-weight:700;font-size:15px;color:${text};letter-spacing:-0.02em">${escapeHtml(m.municipio)}</div>
    <div style="margin-top:8px;display:inline-flex;align-items:center;gap:8px;padding:5px 10px;border-radius:999px;background:${cor}18">
      <span style="width:10px;height:10px;border-radius:999px;background:${cor}"></span>
      <span style="font-size:12px;font-weight:700;color:${cor}">${escapeHtml(status)}</span>
    </div>
    ${contextoLente}
    <div style="margin-top:6px;font-size:11px;line-height:1.45;color:${muted}">${escapeHtml(detalhePesoExpectativa(m))}</div>
    <div style="margin:12px 0 4px;height:1px;background:${line}"></div>
    ${sinalRow('Visitas de campo', m.sinais.visitas, detalheVisitas(detalhes.visitasNoPeriodo), muted, undefined, indicador === 'visitas', 'visitas', m.overridesAtivos)}
    ${sinalRow('Obras destinadas', m.sinais.obras, detalheObras(detalhes.obrasValorTotal), muted, { bem: 'Temos Obras' }, indicador === 'obras', 'obras', m.overridesAtivos)}
    ${sinalRow(labelPesquisa(detalhes.pesquisaBase), m.sinais.pesquisa, detalhePesquisa(detalhes.pesquisaPosicaoTop5, detalhes.pesquisaTop5, detalhes.pesquisaBase), muted, undefined, indicador === 'pesquisa', 'pesquisa', m.overridesAtivos)}
    ${createIptInsightsSectionShell(m, appearance)}
  </div>`
}

export function createIptMarkerHtml(
  m: IptMunicipio,
  size: number,
  animDelay = 0,
  _indicador: IptIndicador | null = null
): string {
  const dot = iptPrioridadeTheme(m.prioridade).dot
  const noVotesClass = m.prioridade === 'sem_expectativa' ? ' mapa-ipt-marker--no-votes' : ''
  return `<div class="mapa-marker-dot mapa-ipt-marker${noVotesClass}" style="
    width:${size}px;height:${size}px;
    background:${dot};
    border:2px solid rgba(255,255,255,0.95);
    box-shadow:0 1px 4px rgba(15,23,42,0.18);
    animation-delay:${animDelay}ms;
  "></div>`
}
