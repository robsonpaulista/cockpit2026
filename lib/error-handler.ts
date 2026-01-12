/**
 * Tratamento de Erros Melhorado
 * Garante que erros não exponham informações sensíveis em produção
 */

import { z } from 'zod'
import { logger, logError } from './logger'

const isDev = process.env.NODE_ENV === 'development'
const isProd = process.env.NODE_ENV === 'production'

export interface ApiErrorResponse {
  error: string
  details?: unknown
  code?: string
}

/**
 * Tratar erros de API de forma segura
 */
export function handleApiError(
  error: unknown,
  context?: Record<string, any>
): ApiErrorResponse {
  // Erros de validação Zod
  if (error instanceof z.ZodError) {
    return {
      error: 'Dados inválidos',
      details: isDev ? error.errors : undefined,
      code: 'VALIDATION_ERROR',
    }
  }

  // Erros do Supabase
  if (error && typeof error === 'object' && 'message' in error) {
    const supabaseError = error as { message: string; code?: string }
    
    // Em produção, não expor mensagens detalhadas do Supabase
    if (isProd) {
      return {
        error: 'Erro ao processar requisição',
        code: supabaseError.code || 'DATABASE_ERROR',
      }
    }

    return {
      error: supabaseError.message,
      code: supabaseError.code || 'DATABASE_ERROR',
    }
  }

  // Erros genéricos
  if (error instanceof Error) {
    // Logar erro completo (com stack) apenas em dev
    if (isDev) {
      logError('Erro na API', error, context)
      return {
        error: error.message,
        details: error.stack,
        code: 'INTERNAL_ERROR',
      }
    }

    // Em produção, logar mas não expor
    logError('Erro na API', error, context)
    return {
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR',
    }
  }

  // Erro desconhecido
  logError('Erro desconhecido na API', error, context)
  return {
    error: isDev ? String(error) : 'Erro interno do servidor',
    code: 'UNKNOWN_ERROR',
  }
}

/**
 * Wrapper para handlers de API
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args)
    } catch (error) {
      const errorResponse = handleApiError(error, {
        handler: handler.name,
      })

      // Se já é uma Response, retornar
      if (errorResponse instanceof Response) {
        return errorResponse
      }

      // Criar Response de erro
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }
  }) as T
}
