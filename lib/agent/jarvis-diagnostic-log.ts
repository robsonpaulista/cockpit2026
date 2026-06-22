import type { JarvisLogLine } from '@/components/jarvis/jarvis-hud-widgets'
import { formatJarvisLogTime } from '@/components/jarvis/jarvis-hud-widgets'

export function jarvisDiagnosticLine(
  tag: string,
  message: string,
  tone: JarvisLogLine['tone'] = 'default'
): JarvisLogLine {
  return { tag, message, tone, at: formatJarvisLogTime() }
}

/** Chave de status — mesma tag+mensagem = mesmo aviso (ex.: WEBCAM bloqueada). */
export function jarvisLogStatusKey(line: JarvisLogLine): string {
  const tag = line.tag.trim().toUpperCase()
  const message = line.message.trim().toUpperCase()
  if (tag === 'USER' || tag === 'IA COCKPIT') {
    return `${tag}::${message}::${line.at ?? ''}`
  }
  return `${tag}::${message}`
}

/** Mantém só a última linha de cada status, preservando a ordem cronológica. */
export function dedupeJarvisLogLines(lines: JarvisLogLine[]): JarvisLogLine[] {
  const lastIndexByKey = new Map<string, number>()
  lines.forEach((line, index) => {
    lastIndexByKey.set(jarvisLogStatusKey(line), index)
  })
  return lines.filter((line, index) => lastIndexByKey.get(jarvisLogStatusKey(line)) === index)
}
