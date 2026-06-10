'use client'

/**
 * Entry point para lazy load do Jarvis na home (/dashboard).
 * Export default evita ChunkLoadError com URL `/_next/undefined` no dynamic() com export nomeado.
 */
export { AIAgent as default } from '@/components/ai-agent'
