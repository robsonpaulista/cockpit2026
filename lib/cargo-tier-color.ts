/** Cor do indicador de cargo (7px) na lista expandida de lideranças. */
export function cargoTierDotClass(cargo: string): string {
  const c = cargo.toLowerCase().trim()
  if (!c) return 'bg-text-muted'

  if (/prefeito|vice[\s-]?prefeito|governador|deputado federal|senador/i.test(c)) {
    return 'bg-[rgb(var(--color-primary))]'
  }
  if (/vereador|dep\.?\s*estadual|deputado estadual|deputado/i.test(c)) {
    return 'bg-[rgb(var(--info))]'
  }
  if (/lider|coord|secret|presidente|diretor/i.test(c)) {
    return 'bg-[rgb(var(--warning))]'
  }
  return 'bg-text-muted'
}
