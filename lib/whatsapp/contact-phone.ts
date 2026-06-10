/** Normaliza telefone para armazenamento (somente dígitos, com DDI BR quando omitido). */
export function normalizeContactPhone(raw: string): string | null {
  const onlyDigits = String(raw || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '')
  if (!onlyDigits) return null

  let withCountry = onlyDigits
  if (onlyDigits.length === 10 || onlyDigits.length === 11) {
    withCountry = `55${onlyDigits}`
  }

  if (withCountry.length < 12 || withCountry.length > 15) return null
  return withCountry
}
