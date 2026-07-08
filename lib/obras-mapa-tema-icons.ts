import { OBRA_FASE_COLOR, type ObraFaseMapa, type ObraMapaTema } from '@/lib/obras-mapa'

/** Cor base do marcador — identifica o TEMA (não a fase). */
export const OBRA_TEMA_MARKER_COLOR: Record<ObraMapaTema, string> = {
  asfalto: '#ffffff',
  paralelepipedo: '#78716c',
  'quadras-esportivas': '#15803d',
  'maquinario-agricola': '#b45309',
  'passagens-cisternas': '#0891b2',
  outros: '#6366f1',
}

export const OBRA_TEMA_MARKER_LABEL: Record<ObraMapaTema, string> = {
  asfalto: 'Asfalto',
  paralelepipedo: 'Paralelepípedo',
  'quadras-esportivas': 'Quadras e areninhas',
  'maquinario-agricola': 'Maquinário agrícola',
  'passagens-cisternas': 'Passagens e cisternas',
  outros: 'Outros',
}

/** Variantes 3D para pavimentação (Microsoft Fluent Emoji, MIT). */
export type ObraPavimentacao3dVariant =
  | 'motorway'
  | 'oncoming'
  | 'construction'
  | 'traffic-light'
  | 'automobile'
  | 'truck'

export const OBRA_PAVIMENTACAO_3D_VARIANTS: {
  id: ObraPavimentacao3dVariant
  label: string
  descricao: string
}[] = [
  { id: 'motorway', label: 'Rodovia', descricao: 'Placa de rodovia (atual)' },
  { id: 'oncoming', label: 'Carro na rua', descricao: 'Automóvel vindo em sua direção' },
  { id: 'construction', label: 'Obra', descricao: 'Placa de construção / intervenção' },
  { id: 'traffic-light', label: 'Semáforo', descricao: 'Semáforo horizontal — contexto urbano' },
  { id: 'automobile', label: 'Carro', descricao: 'Automóvel lateral' },
  { id: 'truck', label: 'Caminhão', descricao: 'Caminhão de entrega' },
]

const OBRA_PAVIMENTACAO_3D_ICON: Record<ObraPavimentacao3dVariant, string> = {
  motorway: '/icons/obras/pavimentacao-3d-motorway.png',
  oncoming: '/icons/obras/pavimentacao-3d-oncoming.png',
  construction: '/icons/obras/pavimentacao-3d-construction.png',
  'traffic-light': '/icons/obras/pavimentacao-3d-traffic-light.png',
  automobile: '/icons/obras/pavimentacao-3d-automobile.png',
  truck: '/icons/obras/pavimentacao-3d-truck.png',
}

/** Variantes 3D para maquinário agrícola. */
export type ObraMaquinario3dVariant = 'trator' | 'escavadeira' | 'arado'

export const OBRA_MAQUINARIO_3D_VARIANTS: {
  id: ObraMaquinario3dVariant
  label: string
  descricao: string
}[] = [
  { id: 'trator', label: 'Trator', descricao: 'Trator agrícola' },
  { id: 'escavadeira', label: 'Escavadeira', descricao: 'Escavadeira / retroescavadeira' },
  { id: 'arado', label: 'Arado', descricao: 'Arado e implementos de preparo de solo' },
]

const OBRA_MAQUINARIO_3D_ICON: Record<ObraMaquinario3dVariant, string> = {
  trator: '/icons/obras/maquinario-3d-trator.png',
  escavadeira: '/icons/obras/maquinario-3d-escavadeira.png',
  arado: '/icons/obras/maquinario-3d-arado.png',
}

/** PNG 3D estático — ver public/icons/obras/ */
export const OBRA_TEMA_3D_ICON: Record<ObraMapaTema, string> = {
  asfalto: OBRA_PAVIMENTACAO_3D_ICON.motorway,
  paralelepipedo: '/icons/obras/pavimentacao-3d-construction.png',
  'quadras-esportivas': '/icons/obras/quadras-3d.png',
  'maquinario-agricola': OBRA_MAQUINARIO_3D_ICON.trator,
  'passagens-cisternas': '/icons/obras/pavimentacao-3d-construction.png',
  outros: '/icons/obras/pavimentacao-3d-construction.png',
}

export function obraTema3dIconUrl(
  tema: ObraMapaTema,
  pavimentacaoVariant: ObraPavimentacao3dVariant = 'oncoming',
  maquinarioVariant: ObraMaquinario3dVariant = 'trator'
): string {
  if (tema === 'asfalto') return OBRA_PAVIMENTACAO_3D_ICON[pavimentacaoVariant]
  if (tema === 'maquinario-agricola') return OBRA_MAQUINARIO_3D_ICON[maquinarioVariant]
  return OBRA_TEMA_3D_ICON[tema]
}

export function obraTemaGlyph3dHtml(
  tema: ObraMapaTema,
  size = 26,
  pavimentacaoVariant: ObraPavimentacao3dVariant = 'oncoming',
  maquinarioVariant: ObraMaquinario3dVariant = 'trator'
): string {
  const src = obraTema3dIconUrl(tema, pavimentacaoVariant, maquinarioVariant).replace(/"/g, '&quot;')
  const alt = OBRA_TEMA_MARKER_LABEL[tema]
  return `<img src="${src}" alt="${alt}" class="obra-marker-glyph-3d-img" width="${size}" height="${size}" loading="eager" decoding="async" />`
}

export function obraTemaGlyphHtml(
  tema: ObraMapaTema,
  size = 24,
  usar3d = false,
  pavimentacaoVariant: ObraPavimentacao3dVariant = 'oncoming',
  maquinarioVariant: ObraMaquinario3dVariant = 'trator'
): string {
  if (usar3d) return obraTemaGlyph3dHtml(tema, size + 2, pavimentacaoVariant, maquinarioVariant)
  return obraTemaGlyphSvgHtml(tema, size, maquinarioVariant)
}

/** Via vertical (vista de cima) — faixa larga, carro visto de cima. */
export const PAVIMENTACAO_GLYPH_SVG = `
  <rect x="6.5" y="1.5" width="11" height="21" rx="1.2" fill="#171717"/>
  <line x1="7.4" y1="2" x2="7.4" y2="22" stroke="#f8fafc" stroke-width="0.75" stroke-linecap="round" opacity="0.9"/>
  <line x1="16.6" y1="2" x2="16.6" y2="22" stroke="#f8fafc" stroke-width="0.75" stroke-linecap="round" opacity="0.9"/>
  <line x1="12" y1="2" x2="12" y2="22" stroke="#fbbf24" stroke-width="1.8" stroke-dasharray="2.6 2.2" stroke-linecap="round"/>
  <g transform="translate(12, 12)">
    <rect x="-1.65" y="-3.1" width="3.3" height="6.2" rx="0.75" fill="#f8fafc"/>
    <rect x="-1.25" y="-2.75" width="2.5" height="2.15" rx="0.38" fill="#334155"/>
    <circle cx="-1.05" cy="-2.15" r="0.46" fill="#0f172a"/>
    <circle cx="1.05" cy="-2.15" r="0.46" fill="#0f172a"/>
    <circle cx="-1.05" cy="2.15" r="0.46" fill="#0f172a"/>
    <circle cx="1.05" cy="2.15" r="0.46" fill="#0f172a"/>
    <rect x="-0.45" y="-2.95" width="0.38" height="0.65" rx="0.1" fill="#fef08a"/>
    <rect x="-0.45" y="2.35" width="0.38" height="0.65" rx="0.1" fill="#fef08a"/>
  </g>
`

export const QUADRA_GLYPH_SVG = `
  <rect x="3" y="5" width="18" height="14" rx="1.5" stroke="#fff" stroke-width="2.2" fill="none"/>
  <line x1="12" y1="5" x2="12" y2="19" stroke="#fff" stroke-width="1.8"/>
  <circle cx="12" cy="12" r="3.2" stroke="#fff" stroke-width="1.6" fill="none"/>
`

export const TRATOR_GLYPH_SVG = `
  <rect x="4" y="10" width="9" height="6.5" rx="1.2" fill="#fff"/>
  <rect x="13" y="8.5" width="7" height="5" rx="1" fill="#fff"/>
  <circle cx="8" cy="18" r="3.2" fill="none" stroke="#fff" stroke-width="2"/>
  <circle cx="17" cy="18" r="2.4" fill="none" stroke="#fff" stroke-width="1.8"/>
  <rect x="15" y="6.5" width="4.5" height="2.2" rx="0.6" fill="#fff"/>
`

export const ESCAVADEIRA_GLYPH_SVG = `
  <rect x="4" y="13" width="10" height="5.5" rx="1" fill="#fff"/>
  <circle cx="7.5" cy="19.5" r="2.2" fill="none" stroke="#fff" stroke-width="1.8"/>
  <circle cx="13" cy="19.5" r="2.2" fill="none" stroke="#fff" stroke-width="1.8"/>
  <path d="M14 13V8.5L19 5.5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M19 5.5L21.5 8.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
`

export const ARADO_GLYPH_SVG = `
  <path d="M5 16H19" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
  <path d="M8 16V11" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
  <path d="M12 16V10.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
  <path d="M16 16V11" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
  <path d="M6.5 11L8 8.5H11L12.5 11" stroke="#fff" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
  <circle cx="18.5" cy="13.5" r="2" fill="none" stroke="#fff" stroke-width="1.8"/>
`

const MAQUINARIO_GLYPH_BY_VARIANT: Record<ObraMaquinario3dVariant, string> = {
  trator: TRATOR_GLYPH_SVG,
  escavadeira: ESCAVADEIRA_GLYPH_SVG,
  arado: ARADO_GLYPH_SVG,
}

const PARALELEPIPEDO_GLYPH_SVG = `
  <rect x="3" y="14" width="18" height="7" rx="1" fill="currentColor" opacity="0.25"/>
  <rect x="4" y="5" width="4" height="3" rx="0.4" fill="currentColor"/>
  <rect x="9" y="5" width="4" height="3" rx="0.4" fill="currentColor"/>
  <rect x="14" y="5" width="4" height="3" rx="0.4" fill="currentColor"/>
  <rect x="6.5" y="9" width="4" height="3" rx="0.4" fill="currentColor"/>
  <rect x="11.5" y="9" width="4" height="3" rx="0.4" fill="currentColor"/>
  <rect x="16.5" y="9" width="4" height="3" rx="0.4" fill="currentColor"/>
`

const OUTROS_GLYPH_SVG = `
  <path d="M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M6 20V9l6-4 6 4v11" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <path d="M10 20v-5h4v5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
`

const PASSAGENS_CISTERNAS_GLYPH_SVG = `
  <path d="M12 3.5c-3.2 4.8-5 8.1-5 10.8a5 5 0 0 0 10 0c0-2.7-1.8-6-5-10.8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>
  <path d="M8.5 18.5h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
`

/** Ícone branco em traço — legível no mapa. */
export function obraTemaGlyphSvgHtml(
  tema: ObraMapaTema,
  size = 22,
  maquinarioVariant: ObraMaquinario3dVariant = 'trator'
): string {
  const inner =
    tema === 'quadras-esportivas'
      ? QUADRA_GLYPH_SVG
      : tema === 'maquinario-agricola'
        ? MAQUINARIO_GLYPH_BY_VARIANT[maquinarioVariant]
        : tema === 'passagens-cisternas'
          ? PASSAGENS_CISTERNAS_GLYPH_SVG
        : tema === 'paralelepipedo'
          ? PARALELEPIPEDO_GLYPH_SVG
        : tema === 'outros'
          ? OUTROS_GLYPH_SVG
          : PAVIMENTACAO_GLYPH_SVG
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true">${inner}</svg>`
}

export function obraFaseDotHtml(fase: ObraFaseMapa): string {
  const color = OBRA_FASE_COLOR[fase]
  const title = fase.replace('_', ' ')
  return `<span class="obra-marker-fase-dot" style="background:${color}" title="${title}"></span>`
}
