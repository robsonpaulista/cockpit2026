'use client'

import { motion, useTransform, type MotionValue } from 'framer-motion'
import { SPLASH_MODULES, SPLASH_SCENES, type SplashModuleIcon } from '@/lib/splash-screen-config'

const PANELS = SPLASH_SCENES.find((s) => s.id === 'panels')!
const MODULES = SPLASH_SCENES.find((s) => s.id === 'modules')!
const SYSTEM = SPLASH_SCENES.find((s) => s.id === 'system')!

type ClockProps = { clock: MotionValue<number> }

/* ─────────────────────────── Cena 3 — Painéis (HUD) ─────────────────────────── */

function Speedometer({ clock, appearAt }: ClockProps & { appearAt: number }) {
  const opacity = useTransform(clock, [appearAt, appearAt + 340], [0, 1])
  const scale = useTransform(clock, [appearAt, appearAt + 420], [0.82, 1])
  const arc = useTransform(clock, [appearAt + 200, appearAt + 1050], [0, 0.72])
  const needle = useTransform(clock, [appearAt + 200, appearAt + 1050], [-84, 46])

  return (
    <motion.div className="ss-hud__gauge" style={{ opacity, scale }}>
      <svg viewBox="0 0 200 150" className="ss-hud__svg">
        <path d="M22 128 A82 82 0 0 1 178 128" className="ss-hud__track" />
        <motion.path
          d="M22 128 A82 82 0 0 1 178 128"
          className="ss-hud__value"
          style={{ pathLength: arc }}
        />
        {Array.from({ length: 9 }, (_, i) => {
          const a = Math.PI - (i / 8) * Math.PI
          const x1 = 100 + Math.cos(a) * 82
          const y1 = 128 - Math.sin(a) * 82
          const x2 = 100 + Math.cos(a) * 70
          const y2 = 128 - Math.sin(a) * 70
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="ss-hud__tick" />
        })}
        <motion.g style={{ rotate: needle, transformOrigin: '100px 128px' }}>
          <line x1="100" y1="128" x2="100" y2="58" className="ss-hud__needle" />
        </motion.g>
        <circle cx="100" cy="128" r="6" className="ss-hud__hub" />
      </svg>
      <span className="ss-hud__label">Velocidade</span>
    </motion.div>
  )
}

function RpmBar({ clock, appearAt, index }: ClockProps & { appearAt: number; index: number }) {
  const x = 14 + index * 18
  const h = 20 + index * 18
  const y = 132 - h
  const on = useTransform(clock, [appearAt + 220 + index * 130, appearAt + 420 + index * 130], [0.14, 1])
  return (
    <g>
      <rect x={x} y={y} width="12" height={h} rx="2" className="ss-hud__bar-bg" />
      <motion.rect x={x} y={y} width="12" height={h} rx="2" className="ss-hud__bar" style={{ opacity: on }} />
    </g>
  )
}

function RpmBars({ clock, appearAt }: ClockProps & { appearAt: number }) {
  const opacity = useTransform(clock, [appearAt, appearAt + 340], [0, 1])
  const scale = useTransform(clock, [appearAt, appearAt + 420], [0.82, 1])

  return (
    <motion.div className="ss-hud__gauge ss-hud__gauge--rpm" style={{ opacity, scale }}>
      <svg viewBox="0 0 120 150" className="ss-hud__svg">
        {Array.from({ length: 6 }, (_, i) => (
          <RpmBar key={i} clock={clock} appearAt={appearAt} index={i} />
        ))}
      </svg>
      <span className="ss-hud__label">RPM</span>
    </motion.div>
  )
}

function Radar({ clock, appearAt }: ClockProps & { appearAt: number }) {
  const opacity = useTransform(clock, [appearAt, appearAt + 340], [0, 1])
  const scale = useTransform(clock, [appearAt, appearAt + 420], [0.82, 1])

  return (
    <motion.div className="ss-hud__gauge" style={{ opacity, scale }}>
      <svg viewBox="0 0 150 150" className="ss-hud__svg">
        <circle cx="75" cy="75" r="62" className="ss-hud__ring" />
        <circle cx="75" cy="75" r="42" className="ss-hud__ring" />
        <circle cx="75" cy="75" r="22" className="ss-hud__ring" />
        <line x1="13" y1="75" x2="137" y2="75" className="ss-hud__ring ss-hud__ring--cross" />
        <line x1="75" y1="13" x2="75" y2="137" className="ss-hud__ring ss-hud__ring--cross" />
        <g className="ss-hud__radar-sweep" style={{ transformOrigin: '75px 75px' }}>
          <path d="M75 75 L75 13 A62 62 0 0 1 128 47 Z" className="ss-hud__sweep-wedge" />
        </g>
        <circle cx="102" cy="52" r="3.5" className="ss-hud__blip" />
        <circle cx="54" cy="96" r="3" className="ss-hud__blip" />
        <circle cx="92" cy="104" r="2.5" className="ss-hud__blip" />
      </svg>
      <span className="ss-hud__label">Radar</span>
    </motion.div>
  )
}

function GpsBadge({ clock, appearAt }: ClockProps & { appearAt: number }) {
  const opacity = useTransform(clock, [appearAt, appearAt + 340], [0, 1])
  const scale = useTransform(clock, [appearAt, appearAt + 420], [0.82, 1])

  return (
    <motion.div className="ss-hud__gauge ss-hud__gauge--gps" style={{ opacity, scale }}>
      <svg viewBox="0 0 120 150" className="ss-hud__svg">
        <circle cx="60" cy="66" r="46" className="ss-hud__ring" />
        <path d="M60 34 L82 96 L60 82 L38 96 Z" className="ss-hud__nav" />
      </svg>
      <span className="ss-hud__label">Navegação</span>
    </motion.div>
  )
}

export function SplashHudPanels({ clock }: ClockProps) {
  // Painéis acendem (cena 3), recolhem para o topo (cena 4) e só somem no texto (cena 5).
  const layerOpacity = useTransform(
    clock,
    [PANELS.at, PANELS.at + 340, MODULES.until - 240, MODULES.until + 140],
    [0, 1, 1, 0],
  )
  const y = useTransform(clock, [PANELS.until - 300, MODULES.at + 260], [0, -150])
  const scale = useTransform(clock, [PANELS.until - 300, MODULES.at + 260], [1, 0.8])
  const base = PANELS.at + 120
  const stagger = 200

  return (
    <motion.div className="ss-hud" style={{ opacity: layerOpacity, y, scale }} aria-hidden>
      <Speedometer clock={clock} appearAt={base} />
      <RpmBars clock={clock} appearAt={base + stagger} />
      <Radar clock={clock} appearAt={base + stagger * 2} />
      <GpsBadge clock={clock} appearAt={base + stagger * 3} />
    </motion.div>
  )
}

/* ─────────────────────────── Cena 4 — Módulos ─────────────────────────── */

function ModuleIcon({ icon }: { icon: SplashModuleIcon }) {
  switch (icon) {
    case 'base':
      return <path d="M4 20v-8l8-6 8 6v8h-6v-6h-4v6z" className="ss-mod__glyph" />
    case 'pesquisas':
      return <path d="M5 19V9m5 10V5m5 14v-7m5 7V8" className="ss-mod__glyph ss-mod__glyph--line" />
    case 'radar':
      return (
        <g className="ss-mod__glyph ss-mod__glyph--line">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 12L20 6" />
          <circle cx="16" cy="8" r="1.4" className="ss-mod__glyph" />
        </g>
      )
    case 'obras':
      return <path d="M4 20l6-10 4 6 3-4 3 8z M13 6l3-2 2 3" className="ss-mod__glyph ss-mod__glyph--line" />
    case 'liderancas':
      return (
        <g className="ss-mod__glyph ss-mod__glyph--line">
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 20c0-4 3-6 7-6s7 2 7 6" />
        </g>
      )
    case 'diagnostico':
      return <path d="M3 13h4l2 5 4-12 2 7h6" className="ss-mod__glyph ss-mod__glyph--line" />
    default:
      return null
  }
}

function ModuleBootItem({
  clock,
  appearAt,
  icon,
  label,
}: ClockProps & { appearAt: number; icon: SplashModuleIcon; label: string }) {
  const opacity = useTransform(clock, [appearAt, appearAt + 260], [0, 1])
  const y = useTransform(clock, [appearAt, appearAt + 320], [12, 0])
  const checkOpacity = useTransform(clock, [appearAt + 340, appearAt + 520], [0, 1])
  const checkScale = useTransform(clock, [appearAt + 340, appearAt + 560], [0.5, 1])

  return (
    <motion.div className="ss-mod" style={{ opacity, y }}>
      <span className="ss-mod__icon">
        <svg viewBox="0 0 24 24">
          <ModuleIcon icon={icon} />
        </svg>
      </span>
      <span className="ss-mod__label">{label}</span>
      <motion.span className="ss-mod__check" style={{ opacity: checkOpacity, scale: checkScale }}>
        <svg viewBox="0 0 24 24">
          <path d="M5 13l4 4 10-11" className="ss-mod__glyph ss-mod__glyph--line" />
        </svg>
      </motion.span>
    </motion.div>
  )
}

export function SplashModuleBoot({ clock }: ClockProps) {
  const layerOpacity = useTransform(
    clock,
    [MODULES.at, MODULES.at + 320, MODULES.until - 360, MODULES.until + 160],
    [0, 1, 1, 0],
  )
  const base = MODULES.at + 60
  const stagger = 130

  return (
    <motion.div className="ss-mod-grid" style={{ opacity: layerOpacity }} aria-hidden>
      {SPLASH_MODULES.map((m, i) => (
        <ModuleBootItem key={m.icon} clock={clock} appearAt={base + i * stagger} icon={m.icon} label={m.label} />
      ))}
    </motion.div>
  )
}

/* ─────────────────────────── Cena 5 — Texto de sistema ─────────────────────────── */

function SystemLine({ clock, appearAt, text, variant }: ClockProps & { appearAt: number; text: string; variant: string }) {
  const opacity = useTransform(clock, [appearAt, appearAt + 320], [0, 1])
  const y = useTransform(clock, [appearAt, appearAt + 380], [16, 0])
  return (
    <motion.p className={`ss-sys__line ${variant}`} style={{ opacity, y }}>
      {text}
    </motion.p>
  )
}

export function SplashSystemLines({ clock, lines }: ClockProps & { lines: readonly string[] }) {
  const layerOpacity = useTransform(
    clock,
    [SYSTEM.at, SYSTEM.at + 320, SYSTEM.until - 300, SYSTEM.until + 160],
    [0, 1, 1, 0],
  )
  const base = SYSTEM.at + 80
  const variants = ['ss-sys__line--brand', 'ss-sys__line--status', 'ss-sys__line--dest']

  return (
    <motion.div className="ss-sys" style={{ opacity: layerOpacity }} aria-hidden>
      <div className="ss-sys__glass">
        {lines.map((line, i) => (
          <SystemLine
            key={line}
            clock={clock}
            appearAt={base + i * 260}
            text={line}
            variant={variants[i] ?? ''}
          />
        ))}
      </div>
    </motion.div>
  )
}
