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

/**
 * Notícias de segurança pública / acidente a excluir do Atendimento
 * (Portal SRN e demais listagens municipais).
 */
const TERMOS_POLICIAL_ACIDENTE: Array<{ termo: string; palavraInteira?: boolean }> = [
  { termo: 'policia' },
  { termo: 'policial' },
  { termo: 'delegacia' },
  { termo: 'delegado' },
  { termo: 'delegada' },
  { termo: 'prf', palavraInteira: true },
  { termo: 'bombeiro' },
  { termo: 'samu', palavraInteira: true },
  { termo: 'acidente' },
  { termo: 'capotamento' },
  { termo: 'colisao' },
  { termo: 'atropel' },
  { termo: 'atingido por caminhao' },
  { termo: 'homicidio' },
  { termo: 'assassinato' },
  { termo: 'assassinada' },
  { termo: 'assassinado' },
  { termo: 'morta a tiros' },
  { termo: 'morto a tiros' },
  { termo: 'morta em supermercado' },
  { termo: 'tiroteio' },
  { termo: 'execucao' },
  { termo: 'latrocinio' },
  { termo: 'feminicidio' },
  { termo: 'estupro' },
  { termo: 'sequestro' },
  { termo: 'trafico de drogas' },
  { termo: 'trafico' },
  { termo: 'entorpecente' },
  { termo: 'operacao contra o trafico' },
  { termo: 'preso' },
  { termo: 'presa' },
  { termo: 'presos' },
  { termo: 'prisao' },
  { termo: 'prende' },
  { termo: 'apreendido' },
  { termo: 'apreendida' },
  { termo: 'apreensao' },
  { termo: 'roubo' },
  { termo: 'assalto' },
  { termo: 'furto' },
  { termo: 'arma de fogo' },
  { termo: 'corpo encontrado' },
  { termo: 'corpo de homem' },
  { termo: 'corpo de mulher' },
  { termo: 'morre apos' },
  { termo: 'morreu apos' },
  { termo: 'homem morre' },
  { termo: 'mulher morre' },
  { termo: 'jovem e morta' },
  { termo: 'jovem e morto' },
  { termo: 'encontrado morto' },
  { termo: 'encontrada morta' },
  { termo: 'suspeito e encontrado morto' },
]

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

/** True se o texto parece notícia policial, criminosa ou de acidente. */
export function textoEhNoticiaPolicialOuAcidente(texto: string): boolean {
  const t = normalize(texto)
  if (!t) return false
  // “pm ” no normalizado vira “pm” — trata fronteira à parte
  if (/(?:^|\s)pm(?:\s|$)/.test(t)) return true
  return TERMOS_POLICIAL_ACIDENTE.some(({ termo, palavraInteira }) => {
    if (termo === 'pm ') return false
    return contemTermo(t, termo, palavraInteira)
  })
}
