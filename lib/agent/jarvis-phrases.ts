/**
 * Frases do Jarvis.
 * Tom: direto, sem cerimônia. Máx. ~6 palavras. Sem "você". Sem "sistema".
 */

const phrases = {
  saudacao: [
    'E aí. O que tem?',
    'Opa. Pode falar.',
    'Fala.',
    'Tô aqui. O que é?',
    'Oi. Por onde começa?',
    'Pronto. Fala.',
  ],

  saudacaoHorario: [
    '{periodo}, meu líder.',
    '{periodo}, fi.',
    '{periodo}, meu líder. O que tem?',
    '{periodo}, fi. Pode falar.',
  ],

  expectativaPiorCenario: [
    'No pior cenário, com o jipe capotando, a expectativa é {total}.',
    'Jipe capotando, no pior cenário: {total} votos.',
  ],

  navegacao: ['É pra já!', 'Claro! É pra já!'],

  buscando: [
    'Buscando {cidade}...',
    'Puxando {cidade}...',
    'Um segundo, {cidade}...',
    'Já vai, {cidade}...',
  ],

  dadosCarregados: [
    '{cidade} na tela.',
    'Aqui, {cidade}.',
    'Puxado. {cidade} carregada.',
    'Pronto. {cidade}.',
  ],

  carregando: [
    'Carregando...',
    'Já vem...',
    'Um segundo...',
    'Quase...',
  ],

  semResultado: [
    'Nada sobre {cidade}.',
    '{cidade} não apareceu nada.',
    'Sem dados pra {cidade}.',
    'Vazio. Tenta outro nome?',
  ],

  erro: [
    'Deu erro. Tenta de novo?',
    'Falhou aqui. De novo?',
    'Eita. Não foi. Tenta mais uma vez.',
    'Não consegui. Tenta de novo.',
  ],

  filtroAplicado: [
    'Filtrado por {filtro}.',
    'Só {filtro} agora.',
    '{filtro} aplicado.',
  ],

  exportando: [
    'Gerando...',
    'Montando o arquivo...',
    'Preparando, já vem.',
  ],

  exportConcluido: [
    'Pronto. Baixa aí.',
    'Arquivo pronto.',
    'Pode baixar.',
  ],

  confirmado: [
    'Feito.',
    'Salvo.',
    'Anotado.',
    'Ok.',
    'Pronto.',
  ],

  aguardando: [
    'O que mais?',
    'Pode falar.',
    'Tô aqui.',
    'Fala.',
  ],

  despedida: [
    'Até.',
    'Qualquer coisa, tô aqui.',
    'Falou.',
  ],

  foraDeEscopo: [
    'Fora do que faço aqui.',
    'Isso não é comigo.',
    'Não puxo isso daqui.',
    'Assunto fora. Outra coisa.',
    'Não faço isso aqui.',
  ],

  whatsappResumoEnviado: ['Resumo operacional enviado.'],

  whatsappBriefingEnviado: ['Briefing de {cidade} enviado.', 'Briefing enviado.'],

  whatsappFalha: [
    'WhatsApp não enviou.',
    'Não foi. Tenta de novo?',
  ],

  whatsappParcial: ['Enviado em parte.', 'WhatsApp parcial.'],
} as const

export type JarvisPhraseCategory = keyof typeof phrases

export type JarvisPhraseVars = Partial<
  Record<'cidade' | 'filtro' | 'destino' | 'nome' | 'total' | 'periodo', string>
>

export type JarvisPeriodoDia = 'Bom dia' | 'Boa tarde' | 'Boa noite'

export function getJarvisPeriodoDoDia(date = new Date()): JarvisPeriodoDia {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function pickJarvisSaudacaoPorHorario(): string {
  return getPhrase('saudacaoHorario', { periodo: getJarvisPeriodoDoDia() })
}

function titleCasePhraseValue(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function normalizePhraseVars(vars: JarvisPhraseVars): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(vars)) {
    if (!raw) continue
    out[key] = key === 'cidade' || key === 'nome' ? titleCasePhraseValue(raw) : raw
  }
  return out
}

/** Frase aleatória da categoria, com interpolação `{cidade}`, `{filtro}`, etc. */
export function getPhrase(
  categoria: JarvisPhraseCategory,
  vars: JarvisPhraseVars = {}
): string {
  const lista = phrases[categoria]
  if (!lista.length) return ''

  const normalized = normalizePhraseVars(vars)
  const elegiveis = lista.filter((frase) => {
    const chaves = [...frase.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
    return chaves.every((chave) => Boolean(normalized[chave]))
  })
  const pool = elegiveis.length > 0 ? elegiveis : lista

  const frase = pool[Math.floor(Math.random() * pool.length)] ?? pool[0]

  return frase.replace(/\{(\w+)\}/g, (_, key: string) => normalized[key] ?? `{${key}}`)
}

export const JARVIS_SAUDACAO_LINES = phrases.saudacao

export function pickJarvisSaudacao(): string {
  if (Math.random() < 0.65) {
    return pickJarvisSaudacaoPorHorario()
  }
  return getPhrase('saudacao')
}

export function pickJarvisExpectativaPiorCenario(total: string | number): string {
  let totalStr =
    typeof total === 'number' ? total.toLocaleString('pt-BR') : String(total).trim()
  if (totalStr && !/\bvotos?\b/i.test(totalStr) && !/não calculada/i.test(totalStr)) {
    totalStr = `${totalStr} votos`
  }
  return getPhrase('expectativaPiorCenario', { total: totalStr })
}

export function formatJarvisExpectativaCidadeReply(options: {
  cidade: string
  totalFormatado: string
  qtdLiderancas: number
  detalhe?: boolean
  liderancasBloco?: string
}): string {
  const intro = pickJarvisExpectativaPiorCenario(options.totalFormatado)
  const linhas = [`**${options.cidade}**`, '', intro]

  if (!options.detalhe) {
    linhas.push('', `Lideranças cadastradas: **${options.qtdLiderancas}**`)
    linhas.push('', 'Quer detalhar por liderança?')
    return linhas.join('\n')
  }

  if (options.liderancasBloco) {
    linhas.push('', options.liderancasBloco)
  }
  return linhas.join('\n')
}

export function pickJarvisNavegacao(pagina?: string): string {
  const abertura = getPhrase('navegacao')
  if (!pagina?.trim()) return abertura
  return `${abertura} **${pagina.trim()}**.`
}

/** Só a frase curta — uma única fala ao abrir página. */
export function pickJarvisNavegacaoFala(): string {
  return getPhrase('navegacao')
}

export function pickJarvisLoadingPhrase(options?: { cidade?: string | null }): string {
  const cidade = options?.cidade?.trim()
  if (cidade) return getPhrase('buscando', { cidade })
  return getPhrase('carregando')
}

/** Enquanto uma busca já está em andamento (ex.: Resumo Eleições). */
export function pickJarvisCarregando(cidade?: string | null): string {
  const nome = cidade?.trim()
  if (nome) return getPhrase('buscando', { cidade: nome })
  return getPhrase('carregando')
}

export function pickJarvisDadosCarregados(cidade: string): string {
  return getPhrase('dadosCarregados', { cidade })
}

export function pickJarvisSemResultado(cidade: string): string {
  return getPhrase('semResultado', { cidade })
}

export function pickJarvisErro(): string {
  return getPhrase('erro')
}

export function pickJarvisConfirmado(): string {
  return getPhrase('confirmado')
}

export function pickJarvisAguardando(): string {
  return getPhrase('aguardando')
}

export function pickJarvisDespedida(): string {
  return getPhrase('despedida')
}

export function pickJarvisForaDeEscopo(): string {
  return getPhrase('foraDeEscopo')
}

export function pickJarvisFiltroAplicado(filtro: string): string {
  return getPhrase('filtroAplicado', { filtro })
}

export function pickJarvisExportando(): string {
  return getPhrase('exportando')
}

export function pickJarvisExportConcluido(): string {
  return getPhrase('exportConcluido')
}

export function pickJarvisWhatsAppEnviado(options: {
  conteudo: 'resumo_operacional' | 'briefing_territorio'
  cidade?: string
}): string {
  if (options.conteudo === 'resumo_operacional') {
    return getPhrase('whatsappResumoEnviado')
  }
  const cidade = options.cidade?.trim()
  return getPhrase('whatsappBriefingEnviado', cidade ? { cidade } : {})
}

export function pickJarvisWhatsAppFalha(): string {
  return getPhrase('whatsappFalha')
}

export function pickJarvisWhatsAppParcial(): string {
  return getPhrase('whatsappParcial')
}

export default phrases
