import fs from 'fs'
import path from 'path'

let envLocalLoaded = false

/** Fallback quando o processo Next foi iniciado antes de editar .env.local */
export function ensureEnvLocalLoaded(): void {
  if (envLocalLoaded || typeof window !== 'undefined') return
  envLocalLoaded = true

  const root = process.cwd()
  for (const name of ['.env.local', '.env']) {
    const filePath = path.join(root, name)
    if (!fs.existsSync(filePath)) continue
    for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const key = t.slice(0, eq).trim()
      let val = t.slice(eq + 1).trim()
      const inlineComment = val.indexOf(' #')
      if (inlineComment > 0 && !val.startsWith('"') && !val.startsWith("'")) {
        val = val.slice(0, inlineComment).trim()
      }
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]?.trim()) process.env[key] = val
    }
  }
}
