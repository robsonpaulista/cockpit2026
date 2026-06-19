import { execFile } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import type { GoogleTrendsCollectResult } from '@/lib/google-trends-types'

const execFileAsync = promisify(execFile)

export async function collectGoogleTrends(options: {
  geo?: string
  timeframe?: string
}): Promise<GoogleTrendsCollectResult> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'collect-google-trends.py')
  const args = [scriptPath]
  if (options.geo) args.push('--geo', options.geo)
  if (options.timeframe) args.push('--timeframe', options.timeframe)

  const { stdout, stderr } = await execFileAsync('python3', args, {
    cwd: process.cwd(),
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  })

  const lines = stdout.trim().split('\n').filter(Boolean)
  const lastLine = lines.at(-1)
  if (!lastLine) {
    throw new Error(stderr.trim() || 'Coleta Trends sem resposta do script Python.')
  }

  const parsed = JSON.parse(lastLine) as GoogleTrendsCollectResult
  if (!parsed.ok) {
    throw new Error(parsed.error ?? 'Falha na coleta Google Trends.')
  }
  return parsed
}
