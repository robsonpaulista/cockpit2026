/**
 * Sistema de Logging Melhorado
 * - Logs estruturados (JSON)
 * - Níveis de log (debug, info, warn, error)
 * - Logs condicionais (dev vs prod)
 * - Mascaramento de dados sensíveis
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  data?: Record<string, any>
  timestamp: string
  environment: string
}

const isDev = process.env.NODE_ENV === 'development'
const isProd = process.env.NODE_ENV === 'production'

/**
 * Mascarar dados sensíveis
 */
function maskSensitiveData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'api_key',
    'apiKey',
    'access_token',
    'refresh_token',
    'authorization',
    'private_key',
    'privateKey',
  ]

  const masked = { ...data }

  for (const key of sensitiveKeys) {
    if (key in masked) {
      const value = String(masked[key])
      if (value.length > 10) {
        masked[key] = value.substring(0, 10) + '...'
      } else {
        masked[key] = '***'
      }
    }
  }

  return masked
}

/**
 * Formatar log para saída
 */
function formatLog(entry: LogEntry): string {
  const dataStr = entry.data ? JSON.stringify(maskSensitiveData(entry.data)) : ''
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message} ${dataStr}`
}

/**
 * Logger principal
 */
class Logger {
  private log(level: LogLevel, message: string, data?: Record<string, any>) {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    }

    // Em produção, só logar info, warn e error
    if (isProd && level === 'debug') {
      return
    }

    const formatted = formatLog(entry)

    // Usar console apropriado
    switch (level) {
      case 'debug':
        console.debug(formatted)
        break
      case 'info':
        console.info(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
        console.error(formatted)
        break
    }
  }

  debug(message: string, data?: Record<string, any>) {
    if (isDev) {
      this.log('debug', message, data)
    }
  }

  info(message: string, data?: Record<string, any>) {
    this.log('info', message, data)
  }

  warn(message: string, data?: Record<string, any>) {
    this.log('warn', message, data)
  }

  error(message: string, data?: Record<string, any>) {
    this.log('error', message, data)
  }
}

// Exportar instância única
export const logger = new Logger()

// Exportar função helper para contexto de requisição
export function logRequest(
  method: string,
  path: string,
  userId?: string,
  ip?: string
) {
  logger.info('Request', {
    method,
    path,
    userId: userId || 'anonymous',
    ip: ip || 'unknown',
  })
}

export function logError(
  message: string,
  error: Error | unknown,
  context?: Record<string, any>
) {
  const errorData: Record<string, any> = {
    ...context,
    error: error instanceof Error ? error.message : String(error),
  }

  if (error instanceof Error && error.stack && isDev) {
    errorData.stack = error.stack
  }

  logger.error(message, errorData)
}
