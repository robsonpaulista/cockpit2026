import type { JarvisLogLine } from '@/components/jarvis/jarvis-hud-widgets'
import { formatJarvisLogTime } from '@/components/jarvis/jarvis-hud-widgets'

export function jarvisDiagnosticLine(
  tag: string,
  message: string,
  tone: JarvisLogLine['tone'] = 'default'
): JarvisLogLine {
  return { tag, message, tone, at: formatJarvisLogTime() }
}
