/**
 * Telefone padrão do CEO para envios rápidos (WhatsApp).
 * Defina no `.env.local`: NEXT_PUBLIC_WHATSAPP_CEO_PHONE=86998107492
 */
export function getWhatsAppCeoPhone(): string {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_CEO_PHONE ?? ''
  return String(raw).trim()
}
