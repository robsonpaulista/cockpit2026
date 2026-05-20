/** Normalização de nomes de município (alinhado ao jadyelapp / consultar-tetos). */
export function normalizeMunicipioNome(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const MAPEAMENTO_NOMES: Record<string, string> = {
  PARNAÍBA: 'PARNAIBA',
  Parnaíba: 'PARNAIBA',
  parnaíba: 'PARNAIBA',
  'ÁGUA BRANCA': 'AGUA BRANCA',
  'Água Branca': 'AGUA BRANCA',
  'água branca': 'AGUA BRANCA',
  'SÃO PEDRO DO PIAUÍ': 'SAO PEDRO DO PIAUI',
  'São Pedro do Piauí': 'SAO PEDRO DO PIAUI',
  'são pedro do piauí': 'SAO PEDRO DO PIAUI',
  'CAPITÃO DE CAMPOS': 'CAPITAO DE CAMPOS',
  'Capitão de Campos': 'CAPITAO DE CAMPOS',
  'capitão de campos': 'CAPITAO DE CAMPOS',
  'CAPITÃO GERVÁSIO OLIVEIRA': 'CAPITAO GERVASIO OLIVEIRA',
  'Capitão Gervásio Oliveira': 'CAPITAO GERVASIO OLIVEIRA',
  'capitão gervásio oliveira': 'CAPITAO GERVASIO OLIVEIRA',
  'LUÍS CORREIA': 'LUIS CORREIA',
  'Luís Correia': 'LUIS CORREIA',
  'luís correia': 'LUIS CORREIA',
  'CASTELO DO PIAUÍ': 'CASTELO DO PIAUI',
  'Castelo do Piauí': 'CASTELO DO PIAUI',
  'castelo do piauí': 'CASTELO DO PIAUI',
}

export function mapearNomeMunicipio(nomeOriginal: string): string {
  return MAPEAMENTO_NOMES[nomeOriginal] ?? nomeOriginal
}

export function formatarNomeMunicipioLista(nomePlanilha: string): string {
  return nomePlanilha
    .toLowerCase()
    .split(' ')
    .map((palavra) => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ')
    .replace(/\bDo\b/g, 'do')
    .replace(/\bDa\b/g, 'da')
    .replace(/\bDe\b/g, 'de')
    .replace(/\bDos\b/g, 'dos')
    .replace(/\bDas\b/g, 'das')
}
