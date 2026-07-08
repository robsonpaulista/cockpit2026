import {
  OBRA_FASE_COLOR,
  type ObraFaseMapa,
  type ObraMapaTema,
} from '@/lib/obras-mapa'
import {
  OBRA_TEMA_MARKER_COLOR,
  obraTema3dIconUrl,
  type ObraMaquinario3dVariant,
  type ObraPavimentacao3dVariant,
} from '@/lib/obras-mapa-tema-icons'
import { cn } from '@/lib/utils'

interface ObraTemaMarkerPreviewProps {
  tema: ObraMapaTema
  fase: ObraFaseMapa
  size?: number
  className?: string
  usarIcone3d?: boolean
  pavimentacao3dVariant?: ObraPavimentacao3dVariant
  maquinario3dVariant?: ObraMaquinario3dVariant
}

function PavimentacaoGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden>
      <rect x="6.5" y="1.5" width="11" height="21" rx="1.2" fill="#171717" />
      <line x1="7.4" y1="2" x2="7.4" y2="22" stroke="#f8fafc" strokeWidth="0.75" strokeLinecap="round" opacity={0.9} />
      <line x1="16.6" y1="2" x2="16.6" y2="22" stroke="#f8fafc" strokeWidth="0.75" strokeLinecap="round" opacity={0.9} />
      <line x1="12" y1="2" x2="12" y2="22" stroke="#fbbf24" strokeWidth="1.8" strokeDasharray="2.6 2.2" strokeLinecap="round" />
      <g transform="translate(12, 12)">
        <rect x="-1.65" y="-3.1" width="3.3" height="6.2" rx="0.75" fill="#f8fafc" />
        <rect x="-1.25" y="-2.75" width="2.5" height="2.15" rx="0.38" fill="#334155" />
        <circle cx="-1.05" cy="-2.15" r="0.46" fill="#0f172a" />
        <circle cx="1.05" cy="-2.15" r="0.46" fill="#0f172a" />
        <circle cx="-1.05" cy="2.15" r="0.46" fill="#0f172a" />
        <circle cx="1.05" cy="2.15" r="0.46" fill="#0f172a" />
      </g>
    </svg>
  )
}

function QuadraGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="1.5" stroke="#fff" strokeWidth="2.2" fill="none" />
      <line x1="12" y1="5" x2="12" y2="19" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.2" stroke="#fff" strokeWidth="1.6" fill="none" />
    </svg>
  )
}

function TratorGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden>
      <rect x="4" y="10" width="9" height="6.5" rx="1.2" fill="#fff" />
      <rect x="13" y="8.5" width="7" height="5" rx="1" fill="#fff" />
      <circle cx="8" cy="18" r="3.2" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="17" cy="18" r="2.4" fill="none" stroke="#fff" strokeWidth="1.8" />
      <rect x="15" y="6.5" width="4.5" height="2.2" rx="0.6" fill="#fff" />
    </svg>
  )
}

function EscavadeiraGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden>
      <rect x="4" y="13" width="10" height="5.5" rx="1" fill="#fff" />
      <circle cx="7.5" cy="19.5" r="2.2" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="13" cy="19.5" r="2.2" fill="none" stroke="#fff" strokeWidth="1.8" />
      <path d="M14 13V8.5L19 5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 5.5L21.5 8.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function AradoGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden>
      <path d="M5 16H19" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 16V11" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 16V10.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 16V11" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M6.5 11L8 8.5H11L12.5 11" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
      <circle cx="18.5" cy="13.5" r="2" fill="none" stroke="#fff" strokeWidth="1.8" />
    </svg>
  )
}

function MaquinarioGlyph({ variant, size }: { variant: ObraMaquinario3dVariant; size: number }) {
  if (variant === 'escavadeira') return <EscavadeiraGlyph size={size} />
  if (variant === 'arado') return <AradoGlyph size={size} />
  return <TratorGlyph size={size} />
}

function ParalelepipedoGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden>
      <rect x="3" y="14" width="18" height="7" rx="1" fill="#fff" opacity="0.25" />
      <rect x="4" y="5" width="4" height="3" rx="0.4" fill="#fff" />
      <rect x="9" y="5" width="4" height="3" rx="0.4" fill="#fff" />
      <rect x="14" y="5" width="4" height="3" rx="0.4" fill="#fff" />
      <rect x="6.5" y="9" width="4" height="3" rx="0.4" fill="#fff" />
      <rect x="11.5" y="9" width="4" height="3" rx="0.4" fill="#fff" />
      <rect x="16.5" y="9" width="4" height="3" rx="0.4" fill="#fff" />
    </svg>
  )
}

function previewBackground(tema: ObraMapaTema, usarIcone3d: boolean): string {
  if (!usarIcone3d) return OBRA_TEMA_MARKER_COLOR[tema]
  if (tema === 'quadras-esportivas') return 'linear-gradient(180deg, #22c55e 0%, #15803d 100%)'
  if (tema === 'maquinario-agricola') return 'linear-gradient(180deg, #fbbf24 0%, #b45309 100%)'
  if (tema === 'passagens-cisternas') return 'linear-gradient(180deg, #22d3ee 0%, #0891b2 100%)'
  if (tema === 'paralelepipedo') return 'linear-gradient(180deg, #a8a29e 0%, #78716c 100%)'
  return 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
}

function previewRing(tema: ObraMapaTema, faseColor: string): string {
  if (tema === 'asfalto') return `0 0 0 1.5px #cbd5e1, 0 0 0 3.5px ${faseColor}`
  if (tema === 'maquinario-agricola') return `0 0 0 2px #fef3c7, 0 0 0 4px ${faseColor}`
  return `0 0 0 2px #fff, 0 0 0 4px ${faseColor}`
}

/** Prévia do marcador para legenda — círculo + cor do tema, anel da fase. */
export function ObraTemaMarkerPreview({
  tema,
  fase,
  size = 28,
  className,
  usarIcone3d = false,
  pavimentacao3dVariant = 'oncoming',
  maquinario3dVariant = 'trator',
}: ObraTemaMarkerPreviewProps) {
  const faseColor = OBRA_FASE_COLOR[fase]
  const glyphSize = Math.round(size * 0.58)

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center rounded-full shadow-sm', className)}
      style={{
        width: size,
        height: size,
        background: previewBackground(tema, usarIcone3d),
        boxShadow: previewRing(tema, faseColor),
      }}
      aria-hidden
    >
      <span style={{ lineHeight: 0, width: glyphSize, height: glyphSize, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {usarIcone3d ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={obraTema3dIconUrl(tema, pavimentacao3dVariant, maquinario3dVariant)}
            alt=""
            width={glyphSize}
            height={glyphSize}
            className="h-full w-full object-contain drop-shadow-sm"
          />
        ) : tema === 'quadras-esportivas' ? (
          <QuadraGlyph size={Math.round(size * 0.52)} />
        ) : tema === 'maquinario-agricola' ? (
          <MaquinarioGlyph variant={maquinario3dVariant} size={Math.round(size * 0.52)} />
        ) : tema === 'paralelepipedo' ? (
          <ParalelepipedoGlyph size={Math.round(size * 0.52)} />
        ) : (
          <PavimentacaoGlyph size={Math.round(size * 0.52)} />
        )}
      </span>
    </span>
  )
}
