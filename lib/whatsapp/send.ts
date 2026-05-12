/**
 * Cliente leve para o endpoint local `/api/whatsapp/send`.
 *
 * O servidor é quem detém a `x-api-key` do provedor — este módulo apenas
 * normaliza o número informado pelo usuário em um JID válido e dispara a
 * chamada autenticada para a rota interna.
 */

const STORAGE_KEY_LAST_PHONE = 'whatsapp:lastDestinatarioPhone'

export interface SendWhatsAppParams {
  /** JID já no formato final (`5586...@s.whatsapp.net`). Tem precedência sobre `phone`. */
  jid?: string
  /** Telefone livre digitado pelo usuário; será normalizado para JID. */
  phone?: string
  text: string
  /** Origem funcional do envio (ex.: `briefing-executivo`). */
  source?: string
  /** Município/contexto principal do envio, quando houver. */
  cidade?: string
}

export interface SendWhatsAppResult {
  ok: boolean
  status: number
  providerResponse?: unknown
  error?: string
}

/**
 * Converte um telefone livre em JID do WhatsApp.
 *
 * - Remove todos os caracteres não-numéricos e zeros à esquerda.
 * - Quando o número tem 10 (fixo BR) ou 11 (celular BR) dígitos, prepende `55`.
 * - Quando já vem com código de país (12–15 dígitos), mantém como está.
 * - Retorna `null` quando o formato não bater (impede chamadas inúteis).
 */
export function normalizePhoneToJid(rawPhone: string): string | null {
  const onlyDigits = String(rawPhone || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '')
  if (!onlyDigits) return null

  let withCountry = onlyDigits
  if (onlyDigits.length === 10 || onlyDigits.length === 11) {
    withCountry = `55${onlyDigits}`
  }

  if (withCountry.length < 12 || withCountry.length > 15) return null
  return `${withCountry}@s.whatsapp.net`
}

/** Formato amigável do telefone BR para exibição no UI. */
export function formatPhoneDisplay(rawPhone: string): string {
  const digits = String(rawPhone || '').replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return rawPhone
}

/** Lê o último telefone usado (localStorage) — não obrigatório. */
export function getLastUsedPhone(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(STORAGE_KEY_LAST_PHONE) || ''
  } catch {
    return ''
  }
}

export function rememberLastUsedPhone(phone: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY_LAST_PHONE, phone)
  } catch {
    // ignora quotas/privacidade
  }
}

/** Envia a mensagem via rota local autenticada. */
export async function sendWhatsAppMessage(
  params: SendWhatsAppParams,
): Promise<SendWhatsAppResult> {
  const jid = params.jid || (params.phone ? normalizePhoneToJid(params.phone) : null)
  if (!jid) {
    return {
      ok: false,
      status: 0,
      error: 'Telefone inválido. Informe um número com DDD (ex.: 86 99810-7492).',
    }
  }
  if (!params.text || !params.text.trim()) {
    return { ok: false, status: 0, error: 'Mensagem vazia.' }
  }

  let response: Response
  try {
    response = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jid,
        text: params.text,
        recipientPhone: params.phone,
        source: params.source,
        cidade: params.cidade,
      }),
    })
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Falha de rede ao contatar o servidor.',
    }
  }

  const data = (await response.json().catch(() => null)) as
    | { error?: string; providerResponse?: unknown }
    | null

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      providerResponse: data?.providerResponse,
      error: data?.error || `Erro ${response.status} ao enviar mensagem.`,
    }
  }

  return {
    ok: true,
    status: response.status,
    providerResponse: data?.providerResponse,
  }
}
