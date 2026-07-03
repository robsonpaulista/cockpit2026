import {
  OBRA_FASE_COLOR,
  OBRA_FASE_LABEL,
  type MunicipioObrasResumo,
  type ObraFaseMapa,
  type ObraMapaTema,
} from '@/lib/obras-mapa'
import { googleDriveImagePreviewUrl } from '@/lib/google-drive-image-url'

export type ObraMapAppearance = 'light' | 'dark'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Ícones SVG por fase — pavimentação ou quadras esportivas. */
export function obraFaseSvgIcon(fase: ObraFaseMapa, tema: ObraMapaTema = 'pavimentacao'): string {
  if (tema === 'quadras-esportivas') {
    switch (fase) {
      case 'em_andamento':
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="4" y="6" width="16" height="12" rx="1.5" />
          <path d="M12 6v12" />
          <circle cx="12" cy="12" r="2.2" />
          <path d="M4 10h3" />
          <path d="M17 14h3" />
        </svg>`
      case 'finalizada':
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="4" y="8" width="12" height="10" rx="1.5" />
          <path d="M10 8V6.5a1.5 1.5 0 0 1 1.5-1.5H14" />
          <circle cx="17.5" cy="7" r="4" fill="currentColor" fill-opacity="0.18" />
          <path d="M16 7l1 1 2-2" />
        </svg>`
      case 'a_iniciar':
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="4" y="9" width="16" height="9" rx="1.5" stroke-dasharray="3 2" />
          <path d="M12 9v9" stroke-dasharray="3 2" />
          <circle cx="17.5" cy="6.5" r="3.5" />
          <path d="M17.5 4.8v2.2" />
        </svg>`
      default:
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="5" y="7" width="14" height="11" rx="1.5" />
          <path d="M12 7v11" />
          <circle cx="12" cy="12.5" r="1.5" />
        </svg>`
    }
  }

  switch (fase) {
    case 'em_andamento':
      return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M2 17h20" />
        <path d="M4 17v-2.5c0-.8.6-1.5 1.4-1.5h1.2" />
        <path d="M20 17v-2.5c0-.8-.6-1.5-1.4-1.5h-1.2" />
        <rect x="7" y="8" width="10" height="5.5" rx="1" />
        <path d="M9 8V6.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6.5V8" />
        <circle cx="6.5" cy="17.5" r="2" />
        <circle cx="17.5" cy="17.5" r="2" />
        <path d="M10 13.5h4" stroke-dasharray="2 1.5" />
      </svg>`
    case 'finalizada':
      return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 18h18" />
        <path d="M5 15h14" opacity="0.55" />
        <path d="M7 12h10" opacity="0.35" />
        <circle cx="17" cy="7" r="4.5" fill="currentColor" fill-opacity="0.18" />
        <path d="M15.2 7l1.2 1.2 2.6-2.6" />
      </svg>`
    case 'a_iniciar':
      return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 18h18" stroke-dasharray="4 3" />
        <circle cx="12" cy="8.5" r="5.5" />
        <path d="M12 6.2v3.1" />
        <path d="M12 11.8v.1" />
      </svg>`
    default:
      return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 17h18" />
        <path d="M6 14h12" />
        <path d="M9 11h6" />
        <path d="M12 4v3" />
        <circle cx="12" cy="4" r="1.2" fill="currentColor" />
      </svg>`
  }
}

export function createObraMarkerHtml(options: {
  fase: ObraFaseMapa
  tema?: ObraMapaTema
  selected: boolean
  total: number
  animDelayMs?: number
  photoUrl?: string | null
  entradaSequencial?: boolean
}): string {
  const { fase, tema = 'pavimentacao', selected, total, animDelayMs = 0, photoUrl, entradaSequencial = false } = options
  const color = OBRA_FASE_COLOR[fase]
  const badge = total > 1 ? `<span class="obra-marker-badge">${total}</span>` : ''
  const pulse = selected ? '<span class="obra-marker-pulse"></span>' : ''
  const wrapClass = entradaSequencial ? 'obra-marker-wrap obra-marker-wrap--sequential' : 'obra-marker-wrap'

  if (photoUrl) {
    const size = selected ? 52 : 46
    return `<div class="${wrapClass} obra-marker-wrap--photo" style="width:${size}px;height:${size + 10}px;animation-delay:${animDelayMs}ms;--obra-color:${color}">
      ${pulse}
      <div class="obra-marker-photo${selected ? ' obra-marker-photo--selected' : ''}" style="width:${size}px;height:${size}px">
        <img src="${photoUrl.replace(/"/g, '&quot;')}" alt="" class="obra-marker-photo-img" loading="eager" referrerpolicy="no-referrer" />
        ${badge}
      </div>
      <span class="obra-marker-tail obra-marker-tail--photo"></span>
    </div>`
  }

  const size = selected ? 44 : 38

  return `<div class="${wrapClass}" style="width:${size}px;height:${size + 8}px;animation-delay:${animDelayMs}ms">
    ${pulse}
    <div class="obra-marker-pin${selected ? ' obra-marker-pin--selected' : ''}" style="--obra-color:${color}">
      <span class="obra-marker-icon">${obraFaseSvgIcon(fase, tema)}</span>
      ${badge}
    </div>
    <span class="obra-marker-tail" style="border-top-color:${color}"></span>
  </div>`
}

export function createObraTooltipHtml(
  m: MunicipioObrasResumo,
  fase: ObraFaseMapa,
  tema: ObraMapaTema = 'pavimentacao'
): string {
  const temaLabel = tema === 'pavimentacao' ? 'Pavimentação' : 'Quadras e areninhas'
  return `<div class="obra-marker-tooltip">
    <strong>${escapeHtml(m.municipio)}</strong>
    <span style="color:${OBRA_FASE_COLOR[fase]}">${OBRA_FASE_LABEL[fase]}</span>
    <span style="display:block;font-size:10px;color:#6b7280;margin-top:1px">${temaLabel}</span>
    <em>${m.total} obra${m.total === 1 ? '' : 's'}</em>
  </div>`
}

export function createObraPopupHtml(
  m: MunicipioObrasResumo,
  fase: ObraFaseMapa,
  appearance: ObraMapAppearance,
  tema: ObraMapaTema = 'pavimentacao'
): string {
  const isDark = appearance === 'dark'
  const text = isDark ? '#f1f5f9' : '#1e293b'
  const muted = isDark ? '#94a3b8' : '#64748b'
  const soft = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(15,23,42,0.04)'
  const faseColor = OBRA_FASE_COLOR[fase]

  const temaLabel = tema === 'pavimentacao' ? 'Pavimentação' : 'Quadras e areninhas'

  const stats = [
    { label: 'andamento', value: m.emAndamento, color: OBRA_FASE_COLOR.em_andamento },
    { label: 'finalizadas', value: m.finalizadas, color: OBRA_FASE_COLOR.finalizada },
    { label: 'a iniciar', value: m.aIniciar, color: OBRA_FASE_COLOR.a_iniciar },
  ]
    .filter((s) => s.value > 0)
    .map(
      (s) =>
        `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:${muted}">
          <span style="width:6px;height:6px;border-radius:50%;background:${s.color};opacity:0.85"></span>
          <strong style="color:${text};font-weight:600">${s.value}</strong> ${s.label}
        </span>`
    )
    .join('<span style="color:rgba(148,163,184,0.5);margin:0 2px">·</span>')

  const obrasList = m.obras
    .slice(0, 4)
    .map((o) => {
      const previewSrc = googleDriveImagePreviewUrl(o.imagem_url, 480)
      const fotoHtml = previewSrc
        ? `<div style="margin-top:8px;overflow:hidden;border-radius:10px">
            <img src="${escapeHtml(previewSrc)}" alt="" style="display:block;width:100%;max-height:108px;object-fit:cover" loading="lazy" />
          </div>`
        : ''
      return `<li style="margin:0;padding:10px 0;border-bottom:1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.06)'}">
        <div style="font-weight:500;color:${text};font-size:12px;line-height:1.4;letter-spacing:-0.01em">${escapeHtml(o.obra ?? 'Obra')}</div>
        <div style="margin-top:3px;font-size:11px;color:${muted};line-height:1.35">${escapeHtml(o.orgao ?? 'Órgão não informado')} · ${escapeHtml(o.status ?? 'Sem status')}</div>
        ${fotoHtml}
      </li>`
    })
    .join('')

  const mais =
    m.obras.length > 4
      ? `<p style="margin:8px 0 0;font-size:11px;color:${muted}">+${m.obras.length - 4} obra(s)</p>`
      : ''

  return `<div class="obra-popup-soft" style="min-width:220px;max-width:268px;font-family:system-ui,-apple-system,sans-serif;padding:14px 16px 12px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
      <div style="min-width:0">
        <div style="font-weight:600;color:${text};font-size:14px;letter-spacing:-0.02em;line-height:1.2">${escapeHtml(m.municipio)}</div>
        <div style="margin-top:3px;font-size:11px;color:${muted}">${temaLabel} · ${m.total} obra${m.total === 1 ? '' : 's'}</div>
      </div>
      <span style="flex-shrink:0;padding:3px 9px;border-radius:999px;font-size:10px;font-weight:500;color:${faseColor};background:${soft};letter-spacing:0.01em">${OBRA_FASE_LABEL[fase]}</span>
    </div>
    ${stats ? `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:10px">${stats}</div>` : ''}
    <ul style="margin:10px 0 0;padding:0;list-style:none">${obrasList}</ul>
    ${mais}
  </div>`
}

export function getObraMapLeafletStyles(appearance: ObraMapAppearance): string {
  const darkChrome =
    appearance === 'dark'
      ? `
  .mapa-obras-host--dark .leaflet-container { background: #0f1419 !important; }
  .mapa-obras-host--dark .leaflet-popup-content-wrapper {
    background: rgba(15,23,42,0.92) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border: 1px solid rgba(148,163,184,0.12) !important;
    box-shadow: 0 12px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2) !important;
  }
  .mapa-obras-host--dark .leaflet-popup-tip { background: rgba(15,23,42,0.92) !important; }
  .mapa-obras-host--dark .leaflet-popup-close-button { color: #94a3b8 !important; }
  .mapa-obras-host--dark .leaflet-control-zoom a {
    background: #1e293b !important;
    color: #e2e8f0 !important;
    border-color: #334155 !important;
  }
  .mapa-obras-host--dark .obra-marker-tooltip {
    background: rgba(15,23,42,0.88) !important;
    backdrop-filter: blur(8px) !important;
    border-color: rgba(148,163,184,0.15) !important;
    color: #e2e8f0 !important;
  }
  .mapa-obras-host--dark .obra-marker-tooltip em { color: #94a3b8 !important; }
`
      : ''

  return `
  .mapa-obras-host .leaflet-container {
    width: 100% !important;
    height: 100% !important;
    background: #e8ecef;
  }
  .mapa-obras-host .leaflet-tile-pane {
    opacity: 1;
  }
  .mapa-obras-host .leaflet-popup-content-wrapper {
    border-radius: 16px !important;
    padding: 0 !important;
    overflow: hidden;
    background: rgba(255,255,255,0.96) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border: 1px solid rgba(15,23,42,0.06) !important;
    box-shadow: 0 8px 32px rgba(15,23,42,0.1), 0 2px 8px rgba(15,23,42,0.04) !important;
  }
  .mapa-obras-host .leaflet-popup-tip {
    box-shadow: none !important;
  }
  .mapa-obras-host .leaflet-popup-close-button {
    top: 6px !important;
    right: 6px !important;
    width: 24px !important;
    height: 24px !important;
    font-size: 18px !important;
    font-weight: 400 !important;
    color: #94a3b8 !important;
    opacity: 0.7 !important;
  }
  .mapa-obras-host .leaflet-popup-close-button:hover { opacity: 1 !important; color: #64748b !important; }
  .mapa-obras-host .leaflet-popup-content { margin: 0 !important; line-height: 1.45 !important; }
  .obra-popup-soft li:last-child { border-bottom: none !important; padding-bottom: 0 !important; }
  .mapa-obras-host .leaflet-tooltip.obra-marker-tooltip-shell {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
  .mapa-obras-host .leaflet-tooltip.obra-marker-tooltip-shell::before { display: none !important; }

  @keyframes obra-marker-enter {
    from { opacity: 0; transform: translateY(8px) scale(0.7); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes obra-marker-pulse {
    0% { transform: translate(-50%, -50%) scale(0.85); opacity: 0.7; }
    70% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
    100% { opacity: 0; }
  }

  .obra-marker-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    animation: obra-marker-enter 0.45s ease-out forwards;
    opacity: 0;
  }
  .obra-marker-wrap--sequential {
    animation: obra-marker-enter 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  .obra-marker-pin {
    position: relative;
    z-index: 2;
    width: 34px;
    height: 34px;
    border-radius: 50% 50% 50% 12%;
    transform: rotate(-45deg);
    background: var(--obra-color);
    border: 2px solid rgba(255,255,255,0.92);
    box-shadow: 0 4px 14px rgba(15,23,42,0.28);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .obra-marker-pin--selected {
    transform: rotate(-45deg) scale(1.12);
    box-shadow: 0 6px 20px rgba(15,23,42,0.35);
  }
  .obra-marker-wrap:hover .obra-marker-pin {
    transform: rotate(-45deg) scale(1.14);
    box-shadow: 0 8px 22px rgba(15,23,42,0.32);
    z-index: 50;
  }
  .obra-marker-wrap:hover .obra-marker-pin--selected {
    transform: rotate(-45deg) scale(1.18);
  }
  .obra-marker-icon {
    transform: rotate(45deg);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
  }
  .obra-marker-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    transform: rotate(45deg);
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: #0f172a;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid #fff;
    z-index: 3;
  }
  .obra-marker-tail {
    width: 0;
    height: 0;
    margin-top: -3px;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 7px solid var(--obra-color);
    filter: drop-shadow(0 2px 2px rgba(15,23,42,0.2));
    z-index: 1;
  }
  .obra-marker-pulse {
    position: absolute;
    top: 17px;
    left: 50%;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--obra-color);
    opacity: 0.35;
    animation: obra-marker-pulse 1.8s ease-out infinite;
    pointer-events: none;
    z-index: 0;
  }
  .obra-marker-wrap--photo .obra-marker-pulse {
    top: 23px;
    width: 46px;
    height: 46px;
  }
  .obra-marker-wrap--photo .obra-marker-badge {
    transform: none;
    top: -2px;
    right: -2px;
  }
  .obra-marker-photo {
    position: relative;
    z-index: 2;
    border-radius: 50%;
    overflow: hidden;
    border: 3px solid var(--obra-color);
    box-shadow: 0 4px 16px rgba(15,23,42,0.32), 0 0 0 2px rgba(255,255,255,0.95);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .obra-marker-photo--selected {
    transform: scale(1.08);
    box-shadow: 0 6px 22px rgba(15,23,42,0.38), 0 0 0 2px rgba(255,255,255,0.95);
  }
  .obra-marker-wrap--photo:hover .obra-marker-photo {
    transform: scale(1.1);
    box-shadow: 0 8px 24px rgba(15,23,42,0.36), 0 0 0 2px rgba(255,255,255,0.95);
    z-index: 50;
  }
  .obra-marker-wrap--photo:hover .obra-marker-photo--selected {
    transform: scale(1.12);
  }
  .obra-marker-photo-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .obra-marker-tail--photo {
    border-top-color: var(--obra-color);
  }
  .obra-marker-tooltip {
    font-family: system-ui, sans-serif;
    font-size: 11px;
    line-height: 1.35;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgba(255,255,255,0.94);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(15,23,42,0.06);
    box-shadow: 0 4px 20px rgba(15,23,42,0.08);
    color: #1e293b;
    white-space: nowrap;
  }
  .obra-marker-tooltip strong { display: block; font-size: 12px; margin-bottom: 2px; }
  .obra-marker-tooltip em {
    display: block;
    font-style: normal;
    font-size: 10px;
    color: #6b7280;
    margin-top: 2px;
  }
  ${darkChrome}
`
}

export const OBRA_MAPA_LEGENDA: { fase: ObraFaseMapa; label: string }[] = [
  { fase: 'em_andamento', label: 'Em andamento' },
  { fase: 'finalizada', label: 'Finalizada' },
  { fase: 'a_iniciar', label: 'A iniciar' },
]
