/** Tribunais PJe/Projudi não permitem pré-preencher o processo via query string. */

export function tituloAbrirConsultaTribunal(
  numeroFormatado: string | null,
  sistema: string | null
): string {
  const base = sistema ?? 'Consulta pública no tribunal'
  if (!numeroFormatado) return base
  return `${base} — ao clicar, o nº ${numeroFormatado} é copiado; cole no campo Processo (Ctrl+V) e pesquise`
}

export async function copiarNumeroProcesso(numero: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(numero)
    return true
  } catch {
    return false
  }
}

export function abrirConsultaTribunal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}
