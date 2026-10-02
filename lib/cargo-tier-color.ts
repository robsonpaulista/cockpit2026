/** Cor do indicador de cargo (7px) na lista expandida de lideranças. */
export function cargoTierDotClass(cargo: string): string {
  const c = cargo.toLowerCase().trim()
  if (!c) return 'bg-[#969692]'

  if (/prefeito|vice[\s-]?prefeito|governador|deputado federal|senador/i.test(c)) {
    return 'bg-[#14161a]'
  }
  if (/vereador|dep\.?\s*estadual|deputado estadual|deputado/i.test(c)) {
    return 'bg-[#e8a825]'
  }
  if (/lider|coord|secret|presidente|diretor/i.test(c)) {
    return 'bg-[#686865]'
  }
  return 'bg-[#969692]'
}
