/** Splash Screen Cockpit — "ligar a máquina" (startup sequence). */

export const SPLASH_SESSION_KEY = 'cockpit_splash_shown'

/**
 * Evento global que abre a splash como "tela de descanso" a partir da sidebar.
 * Ao concluir, apenas fecha o overlay (não redireciona para o login).
 */
export const SPLASH_PREVIEW_EVENT = 'cockpitSplashPreview'

/** Duração total da sequência automática (ms) até a cena "Pronto". */
export const SPLASH_TOTAL_MS = 7800

/** Auto-avanço na cena final se o usuário não clicar (ms). */
export const SPLASH_AUTO_ENTER_MS = 1500

/** Timeout máximo de pré-carga antes de iniciar mesmo assim (ms). */
export const SPLASH_PRELOAD_TIMEOUT_MS = 1200

/** Preview local — não redireciona nem encerra após a animação. */
export const SPLASH_DEV_PREVIEW =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development'

/** Passo do estúdio (ms) — ~20 frames lógicos por segundo. */
export const SPLASH_STUDIO_FRAME_MS = 50

export const SPLASH_COLORS = {
  bg: '#0B0B0D',
  gold: '#ff9800',
  goldGlow: 'rgba(255, 152, 0, 0.55)',
  goldSoft: 'rgba(255, 152, 0, 0.18)',
  graphite: '#3A3D42',
  lightSurface: '#F8F6F0',
  textOnDark: '#FFFFFF',
  textMutedDark: 'rgba(255, 255, 255, 0.55)',
  textOnLight: '#111827',
  textMutedLight: '#6B7280',
} as const

export type SplashSceneId =
  | 'start'
  | 'beep'
  | 'panels'
  | 'modules'
  | 'system'
  | 'ready'

export type SplashSceneDef = {
  id: SplashSceneId
  /** Início da cena na timeline (ms). */
  at: number
  /** Fim da cena (ms) — início da próxima ou fim da sequência. */
  until: number
  label: string
}

/**
 * Timeline configurável — ajuste `at` / `until` para calibrar cortes.
 * Total: 0 → 5200ms (cena 6 permanece até interação).
 */
export const SPLASH_SCENES: SplashSceneDef[] = [
  { id: 'start', at: 0, until: 1200, label: 'Iniciar sistema' },
  { id: 'beep', at: 1200, until: 1650, label: 'Ligando a máquina' },
  { id: 'panels', at: 1650, until: 3300, label: 'Painéis acendem' },
  { id: 'modules', at: 3300, until: 5000, label: 'Módulos inicializando' },
  { id: 'system', at: 5000, until: 6250, label: 'Sistema iniciado' },
  { id: 'ready', at: 6250, until: SPLASH_TOTAL_MS, label: 'Pronto para decolar' },
]

/** Módulos reais do Cockpit — cena 4 (boot com stagger + check). */
export type SplashModule = { icon: SplashModuleIcon; label: string }
export type SplashModuleIcon = 'base' | 'pesquisas' | 'radar' | 'obras' | 'liderancas' | 'diagnostico'

export const SPLASH_MODULES: SplashModule[] = [
  { icon: 'base', label: 'Base eleitoral' },
  { icon: 'pesquisas', label: 'Pesquisas' },
  { icon: 'radar', label: 'Radar' },
  { icon: 'obras', label: 'Obras' },
  { icon: 'liderancas', label: 'Lideranças' },
  { icon: 'diagnostico', label: 'Diagnóstico' },
]

/** Texto de sistema — cena 5 (cascata). */
export const SPLASH_SYSTEM_LINES = [
  'COCKPIT 2026',
  'Sistema operacional iniciado.',
  'Destino: Vitória.',
] as const

export const SPLASH_START = {
  label: 'Iniciar sistema',
  skip: 'Pular',
} as const

export const SPLASH_READY = {
  brand: 'COCKPIT 2026',
  tagline: 'Você no comando.',
  destination: 'Destino: a vitória.',
  cta: 'Entrar no Cockpit',
  skip: 'Pular',
} as const

/** Cena 5–6 — carro na pista noturna (imagem inteira, full-bleed = imagem única). */
export const SPLASH_SUNRISE_ASSET = '/splash/cockpit-track-full.png'

/** Fallback caso a imagem do carro não exista/carregue. */
export const SPLASH_SUNRISE_FALLBACK = '/splash/cockpit-track-night.png'
