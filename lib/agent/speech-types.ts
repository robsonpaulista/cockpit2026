export interface SpeakTextOptions {
  lang?: string
  rate?: number
  preferNeural?: boolean
  /** Um segmento por compromisso — fala com pausa entre cada item. */
  segments?: string[]
  onStart?: () => void
  onEnd?: () => void
  onError?: (message?: string) => void
}
