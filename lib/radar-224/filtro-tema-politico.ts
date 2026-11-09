/**
 * Heurística leve para listagens municipais mistas (ex.: GP1 por cidade):
 * mantém política/gestão pública e deixa de fora policial/acidente genérico.
 */

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Termos curtos exigem fronteira de palavra (evita “tre” em “entre”). */
const TERMOS_POLITICOS: Array<{ termo: string; palavraInteira?: boolean }> = [
  { termo: 'prefeito' },
  { termo: 'prefeita' },
  { termo: 'prefeitura' },
  { termo: 'vice prefeito' },
  { termo: 'vereador' },
  { termo: 'vereadora' },
  { termo: 'camara' },
  { termo: 'deputado' },
  { termo: 'deputada' },
  { termo: 'senador' },
  { termo: 'senadora' },
  { termo: 'governador' },
  { termo: 'governadora' },
  { termo: 'eleicao' },
  { termo: 'eleicoes' },
  { termo: 'eleitoral' },
  { termo: 'candidato' },
  { termo: 'candidata' },
  { termo: 'campanha' },
  { termo: 'partido' },
  { termo: 'coligacao' },
  { termo: 'chapa' },
  { termo: 'mandato' },
  { termo: 'alianca' },
  { termo: 'abuso de poder' },
  { termo: 'nepotismo' },
  { termo: 'tse', palavraInteira: true },
  { termo: 'tre', palavraInteira: true },
  { termo: 'tce', palavraInteira: true },
  { termo: 'mpf', palavraInteira: true },
  { termo: 'ministerio publico' },
  { termo: 'promotor' },
  { termo: 'corregedoria' },
  { termo: 'urna' },
  { termo: 'votacao' },
  { termo: 'legislativo' },
  { termo: 'emenda' },
  { termo: 'secretaria municipal' },
  { termo: 'gestao municipal' },
  { termo: 'licitacao' },
  { termo: 'multada pelo tce' },
  { termo: 'multado pelo tce' },
  { termo: 'irregularidades em contratos' },
  { termo: 'contratos da prefeitura' },
  { termo: 'inquerito' },
  { termo: 'solenidade' },
]

function contemTermo(texto: string, termo: string, palavraInteira?: boolean): boolean {
  const n = normalize(termo)
  if (!n) return false
  if (palavraInteira || n.length <= 3) {
    return new RegExp(`(?:^|\\s)${n}(?:\\s|$)`).test(texto)
  }
  return texto.includes(n)
}

export function textoEhTemaPolitico(texto: string): boolean {
  const t = normalize(texto)
  if (!t) return false
  return TERMOS_POLITICOS.some(({ termo, palavraInteira }) => contemTermo(t, termo, palavraInteira))
}
