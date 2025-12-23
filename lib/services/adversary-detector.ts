// Serviço para detectar menções de adversários em notícias

export interface Adversary {
  id: string
  name: string
  themes?: string[]
}

/**
 * Detecta se uma notícia menciona algum adversário
 * @param newsTitle Título da notícia
 * @param newsContent Conteúdo da notícia
 * @param adversaries Lista de adversários cadastrados
 * @returns ID do adversário detectado ou null
 */
export function detectAdversaryInNews(
  newsTitle: string,
  newsContent: string,
  adversaries: Adversary[]
): { adversaryId: string; attackType: 'direct' | 'indirect' | 'false_claim' | 'omission' } | null {
  const fullText = `${newsTitle} ${newsContent || ''}`.toLowerCase()

  for (const adversary of adversaries) {
    const adversaryName = adversary.name.toLowerCase()
    
    // Verificar menção direta do nome
    if (fullText.includes(adversaryName)) {
      // Detectar tipo de ataque baseado em palavras-chave
      const attackType = detectAttackType(fullText, adversaryName)
      
      return {
        adversaryId: adversary.id,
        attackType,
      }
    }

    // Verificar variações comuns do nome (primeiro nome, sobrenome, etc.)
    const nameParts = adversary.name.split(' ')
    if (nameParts.length > 1) {
      // Verificar se menciona pelo menos 2 partes do nome
      const partsFound = nameParts.filter(part => 
        fullText.includes(part.toLowerCase())
      )
      
      if (partsFound.length >= 2) {
        const attackType = detectAttackType(fullText, adversaryName)
        return {
          adversaryId: adversary.id,
          attackType,
        }
      }
    }
  }

  return null
}

/**
 * Detecta o tipo de ataque baseado em palavras-chave no texto
 */
function detectAttackType(text: string, adversaryName: string): 'direct' | 'indirect' | 'false_claim' | 'omission' {
  const lowerText = text.toLowerCase()
  
  // Palavras que indicam ataque direto
  const directAttackWords = [
    'acusou', 'criticou', 'atacou', 'denunciou', 'condenou',
    'acusação', 'crítica', 'ataque', 'denúncia', 'condenação',
    'contra', 'versus', 'vs', 'opõe', 'oposição'
  ]
  
  // Palavras que indicam falsa afirmação
  const falseClaimWords = [
    'falso', 'mentira', 'fake', 'notícia falsa', 'desinformação',
    'alega', 'afirma sem provas', 'sem fundamento'
  ]
  
  // Palavras que indicam omissão
  const omissionWords = [
    'ignorou', 'não mencionou', 'esqueceu', 'deixou de lado',
    'omitiu', 'não falou sobre'
  ]

  // Verificar contexto próximo ao nome do adversário
  const nameIndex = lowerText.indexOf(adversaryName)
  if (nameIndex === -1) return 'indirect'

  const contextStart = Math.max(0, nameIndex - 100)
  const contextEnd = Math.min(lowerText.length, nameIndex + adversaryName.length + 100)
  const context = lowerText.substring(contextStart, contextEnd)

  // Verificar falsa afirmação
  if (falseClaimWords.some(word => context.includes(word))) {
    return 'false_claim'
  }

  // Verificar omissão
  if (omissionWords.some(word => context.includes(word))) {
    return 'omission'
  }

  // Verificar ataque direto
  if (directAttackWords.some(word => context.includes(word))) {
    return 'direct'
  }

  // Se mencionou mas não tem palavras de ataque claro, é indireto
  return 'indirect'
}

/**
 * Calcula Share of Voice de um adversário baseado em menções
 */
export async function calculateShareOfVoice(
  adversaryId: string,
  totalMentions: number,
  allAdversariesMentions: Record<string, number>
): Promise<number> {
  if (totalMentions === 0) return 0

  const adversaryMentions = allAdversariesMentions[adversaryId] || 0
  const totalAllMentions = Object.values(allAdversariesMentions).reduce((a, b) => a + b, 0)

  if (totalAllMentions === 0) return 0

  // Share of Voice = (menções do adversário / total de menções) * 100
  return Math.round((adversaryMentions / totalAllMentions) * 100)
}




