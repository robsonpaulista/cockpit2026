import { shouldShowJadyelBlock } from '@/lib/field-survey-jadyel'
import type { SurveyConfigLists } from '@/services/field-survey-sync'

export type SurveyStep =
  | {
      id: string
      block: string
      kind: 'single'
      title: string
      subtitle?: string
      field: string
      options: { value: string; label: string }[]
    }
  | {
      id: string
      block: string
      kind: 'text'
      title: string
      field: string
      placeholder?: string
    }
  | {
      id: string
      block: string
      kind: 'number'
      title: string
      subtitle?: string
      field: string
      min: number
      max: number
    }
  | {
      id: string
      block: string
      kind: 'scale'
      title: string
      subtitle?: string
      field: string
      min: number
      max: number
    }
  | {
      id: string
      block: string
      kind: 'dual_attr'
      title: string
      subtitle?: string
      field: string
      labelA: string
      labelB: string
      optionsA: { value: string; label: string }[]
      optionsB: { value: string; label: string }[]
    }
  | {
      id: string
      block: string
      kind: 'matrix_rejection'
      title: string
      subtitle?: string
      field: string
      list: 'depFederal' | 'senado' | 'depEstadual'
    }
  | {
      id: string
      block: string
      kind: 'multi_nao_votaria'
      title: string
      field: string
      list: 'senado'
    }
  | {
      id: string
      block: string
      kind: 'readonly_datetime'
      title: string
      field: string
    }

const SIM_NAO_NS = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
  { value: 'ns', label: 'NS / NR' },
]

const AUMENTA_VOTO = [
  { value: 'aumenta_muito', label: 'Aumenta muito' },
  { value: 'aumenta', label: 'Aumenta' },
  { value: 'neutro', label: 'Neutro' },
  { value: 'diminui', label: 'Diminui' },
  { value: 'ns', label: 'NS / NR' },
]

export interface BuildSurveyStepsOptions {
  questionOrder?: string[]
  disabledQuestionIds?: string[]
}

/** Reordena passos já montados (só IDs que existem em `steps` entram; o resto mantém ordem residual). */
export function applyQuestionOrder(steps: SurveyStep[], order: string[]): SurveyStep[] {
  if (!order.length) return steps
  const byId = new Map(steps.map((s) => [s.id, s]))
  const out: SurveyStep[] = []
  const seen = new Set<string>()
  for (const id of order) {
    const st = byId.get(id)
    if (st && !seen.has(id)) {
      out.push(st)
      seen.add(id)
    }
  }
  for (const st of steps) {
    if (!seen.has(st.id)) {
      out.push(st)
      seen.add(st.id)
    }
  }
  return out
}

export function buildSurveySteps(
  answers: Record<string, unknown>,
  lists: SurveyConfigLists,
  options?: BuildSurveyStepsOptions
): SurveyStep[] {
  const steps: SurveyStep[] = []

  const push = (s: SurveyStep): void => {
    steps.push(s)
  }

  // BLOCO 1
  push({
    id: 'p01',
    block: '1',
    kind: 'single',
    title: 'P01. O(a) sr(a) é eleitor(a) do estado do Piauí?',
    field: 'p01',
    options: [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' },
      { value: 'ns', label: 'NS / NR' },
    ],
  })
  push({
    id: 'p02',
    block: '1',
    kind: 'single',
    title: 'P02. O(a) sr(a) mora neste domicílio?',
    field: 'p02',
    options: [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' },
      { value: 'ns', label: 'NS / NR' },
    ],
  })
  push({
    id: 'p03',
    block: '1',
    kind: 'single',
    title: 'P03. Sexo',
    field: 'p03',
    options: [
      { value: 'm', label: 'Masculino' },
      { value: 'f', label: 'Feminino' },
      { value: 'outro', label: 'Outro / prefere não informar' },
    ],
  })
  push({
    id: 'p04',
    block: '1',
    kind: 'number',
    title: 'P04. Idade',
    field: 'p04',
    min: 16,
    max: 120,
  })
  push({
    id: 'p05',
    block: '1',
    kind: 'single',
    title: 'P05. Escolaridade',
    field: 'p05',
    options: [
      { value: 'fund_inc', label: 'Fundamental incompleto' },
      { value: 'fund_comp', label: 'Fundamental completo' },
      { value: 'medio_inc', label: 'Médio incompleto' },
      { value: 'medio_comp', label: 'Médio completo' },
      { value: 'sup_inc', label: 'Superior incompleto' },
      { value: 'sup_comp', label: 'Superior completo' },
      { value: 'pos', label: 'Pós-graduação' },
      { value: 'ns', label: 'NS / NR' },
    ],
  })
  push({
    id: 'p06',
    block: '1',
    kind: 'single',
    title: 'P06. Renda familiar',
    field: 'p06',
    options: [
      { value: 'ate1', label: 'Até 1 salário mínimo' },
      { value: '1a2', label: 'De 1 a 2 salários' },
      { value: '2a5', label: 'De 2 a 5 salários' },
      { value: '5mais', label: 'Mais de 5 salários' },
      { value: 'ns', label: 'NS / NR' },
    ],
  })
  push({
    id: 'p07',
    block: '1',
    kind: 'single',
    title: 'P07. Religião',
    field: 'p07',
    options: [
      { value: 'catolica', label: 'Católica' },
      { value: 'evangelica', label: 'Evangélica' },
      { value: 'espirita', label: 'Espírita' },
      { value: 'outra', label: 'Outra' },
      { value: 'nenhuma', label: 'Nenhuma' },
      { value: 'ns', label: 'NS / NR' },
    ],
  })

  // BLOCO 2
  push({
    id: 'p08',
    block: '2',
    kind: 'single',
    title: 'P08. Qual o seu nível de interesse pelas eleições?',
    field: 'p08',
    options: [
      { value: 'muito', label: 'Muito interessado' },
      { value: 'medio', label: 'Médio' },
      { value: 'pouco', label: 'Pouco' },
      { value: 'nenhum', label: 'Nenhum' },
    ],
  })
  push({
    id: 'p09',
    block: '2',
    kind: 'single',
    title: 'P09. O(a) sr(a) se considera:',
    field: 'p09',
    options: [
      { value: 'governista', label: 'Mais governista' },
      { value: 'oposicao', label: 'Mais de oposição' },
      { value: 'independente', label: 'Independente' },
    ],
  })
  push({
    id: 'p10',
    block: '2',
    kind: 'single',
    title: 'P10. O Piauí hoje está:',
    field: 'p10',
    options: [
      { value: 'certo', label: 'No caminho certo' },
      { value: 'errado', label: 'No caminho errado' },
      { value: 'ns', label: 'Não sabe' },
    ],
  })
  push({
    id: 'p11',
    block: '2',
    kind: 'text',
    title: 'P11. Na sua opinião, qual é hoje o principal problema do Piauí?',
    field: 'p11',
    placeholder: 'Resposta aberta',
  })

  // BLOCO 3
  push({
    id: 'p12',
    block: '3',
    kind: 'text',
    title: 'P12. Se a eleição para Presidente fosse hoje, em quem votaria? (espontânea)',
    field: 'p12',
    placeholder: 'Nome ou partido',
  })
  push({
    id: 'p13',
    block: '3',
    kind: 'single',
    title: 'P13. O(a) sr(a) aprova ou desaprova o atual Presidente?',
    field: 'p13',
    options: [
      { value: 'aprova', label: 'Aprova' },
      { value: 'desaprova', label: 'Desaprova' },
      { value: 'neutro', label: 'Nem aprova nem desaprova' },
      { value: 'ns', label: 'NS / NR' },
    ],
  })
  push({
    id: 'p14',
    block: '3',
    kind: 'text',
    title: 'P14. Se a eleição para Governador fosse hoje, em quem votaria? (espontânea)',
    field: 'p14',
    placeholder: 'Nome',
  })
  push({
    id: 'p15',
    block: '3',
    kind: 'single',
    title: 'P15. Se os candidatos fossem estes, em quem votaria para Governador? (estimulada)',
    subtitle: 'Lista configurável pelo instituto',
    field: 'p15',
    options: lists.governador.map((c) => ({ value: c.id, label: c.label })),
  })

  // BLOCO 4 — Deputado Federal
  push({
    id: 'p16',
    block: '4',
    kind: 'text',
    title: 'P16. Se a eleição para Deputado Federal fosse hoje, em quem votaria? (espontânea)',
    field: 'p16',
    placeholder: 'Nome / número',
  })
  push({
    id: 'p17',
    block: '4',
    kind: 'text',
    title: 'P17. E em quem mais poderia votar? (segunda opção)',
    field: 'p17',
    placeholder: 'Nome / número',
  })
  push({
    id: 'p18',
    block: '4',
    kind: 'single',
    title: 'P18. Vou ler alguns nomes de possíveis candidatos. Em qual votaria? (estimulada)',
    field: 'p18',
    options: lists.depFederal.map((c) => ({ value: c.id, label: c.label })),
  })
  push({
    id: 'p19',
    block: '4',
    kind: 'scale',
    title: 'P19. De 0 a 10, qual a chance de votar nesse candidato?',
    subtitle: 'Considere o candidato da P18 (ou o da P16 se P18 for NS/NR).',
    field: 'p19',
    min: 0,
    max: 10,
  })
  push({
    id: 'p20',
    block: '4',
    kind: 'single',
    title: 'P20. Seu voto está:',
    field: 'p20',
    options: [
      { value: 'decidido', label: 'Totalmente decidido' },
      { value: 'pode_mudar', label: 'Pode mudar' },
      { value: 'nao_decidiu', label: 'Ainda não decidiu' },
    ],
  })
  push({
    id: 'p21',
    block: '4',
    kind: 'matrix_rejection',
    title: 'P21. Em relação a esses nomes, o(a) sr(a):',
    subtitle: 'Para cada nome, marque uma opção.',
    field: 'p21_dep_fed',
    list: 'depFederal',
  })

  // BLOCO 5 — Jadyel (condicional)
  if (shouldShowJadyelBlock(answers, lists)) {
    push({
      id: 'p22',
      block: '5',
      kind: 'single',
      title: 'P22. O(a) sr(a) conhece o deputado federal Jadyel Alencar?',
      field: 'p22',
      options: [
        { value: 'bem', label: 'Conhece bem' },
        { value: 'pouco', label: 'Conhece pouco' },
        { value: 'ouviu', label: 'Só ouviu falar' },
        { value: 'nao', label: 'Não conhece' },
      ],
    })
    push({
      id: 'p23',
      block: '5',
      kind: 'single',
      title: 'P23. A imagem que o(a) sr(a) tem dele é:',
      field: 'p23',
      options: [
        { value: 'muito_pos', label: 'Muito positiva' },
        { value: 'pos', label: 'Positiva' },
        { value: 'neutra', label: 'Neutra' },
        { value: 'neg', label: 'Negativa' },
        { value: 'muito_neg', label: 'Muito negativa' },
        { value: 'ns', label: 'NS / NR' },
      ],
    })
    const attr = (
      id: string,
      field: string,
      title: string
    ): void =>
      push({
        id,
        block: '5',
        kind: 'dual_attr',
        title,
        field,
        labelA: 'Conhece?',
        labelB: 'Isso aumenta o voto?',
        optionsA: SIM_NAO_NS,
        optionsB: AUMENTA_VOTO,
      })
    attr('p24', 'p24', 'P24. Atuação na chegada do Hospital de Amor')
    attr('p25', 'p25', 'P25. Atuação na causa animal')
    attr('p26', 'p26', 'P26. Associação a trazer recursos para o estado')
    attr('p27', 'p27', 'P27. Associação a obras (asfalto, calçamento)')
    attr('p28', 'p28', 'P28. Conhecimento do ECA Digital')
    attr('p29', 'p29', 'P29. Saber que ele foi relator do ECA Digital')
    push({
      id: 'p30',
      block: '5',
      kind: 'single',
      title: 'P30. Leis que protegem crianças na internet são:',
      field: 'p30',
      options: [
        { value: 'muito', label: 'Muito importantes' },
        { value: 'importantes', label: 'Importantes' },
        { value: 'pouco', label: 'Pouco importantes' },
        { value: 'nada', label: 'Nada importantes' },
        { value: 'ns', label: 'NS / NR' },
      ],
    })
    push({
      id: 'p31',
      block: '5',
      kind: 'single',
      title: 'P31. O(a) sr(a) acha que Jadyel Alencar:',
      field: 'p31',
      options: [
        { value: 'muito', label: 'Trabalha muito' },
        { value: 'pouco', label: 'Trabalha pouco' },
        { value: 'nao_conhece', label: 'Não conhece' },
      ],
    })
  }

  // BLOCO 6
  push({
    id: 'p32',
    block: '6',
    kind: 'single',
    title:
      'P32. Um candidato que: trouxe hospital, protege crianças na internet, investe na causa animal. O(a) sr(a):',
    field: 'p32',
    options: [
      { value: 'certeza', label: 'Votaria com certeza' },
      { value: 'poderia', label: 'Poderia votar' },
      { value: 'nao', label: 'Não votaria' },
    ],
  })

  // BLOCO 7
  push({
    id: 'p33',
    block: '7',
    kind: 'single',
    title:
      'P33. Se um deputado federal em quem confia fosse candidato a senador, o(a) sr(a) votaria nele?',
    field: 'p33',
    options: [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' },
      { value: 'ns', label: 'NS / NR' },
    ],
  })
  push({
    id: 'p34',
    block: '7',
    kind: 'single',
    title: 'P34. E se esse candidato fosse Jadyel Alencar, o(a) sr(a) votaria nele para senador?',
    field: 'p34',
    options: [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' },
      { value: 'ns', label: 'NS / NR' },
    ],
  })

  // BLOCO 8
  push({
    id: 'p35',
    block: '8',
    kind: 'single',
    title: 'P35. O(a) sr(a) lembra em quem votou para senador na última eleição?',
    field: 'p35',
    options: [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' },
      { value: 'ns', label: 'NS / NR' },
    ],
  })
  push({
    id: 'p36',
    block: '8',
    kind: 'text',
    title: 'P36. Em quem votou?',
    field: 'p36',
    placeholder: 'Aberta',
  })
  push({
    id: 'p37',
    block: '8',
    kind: 'text',
    title: 'P37. O(a) sr(a) sabe dizer quem são hoje os senadores do Piauí?',
    field: 'p37',
    placeholder: 'Aberta',
  })
  push({
    id: 'p38',
    block: '8',
    kind: 'text',
    title: 'P38. Se a eleição fosse hoje, em quem votaria para senador? (espontânea)',
    field: 'p38',
    placeholder: 'Nome',
  })
  push({
    id: 'p39',
    block: '8',
    kind: 'text',
    title: 'P39. E em quem mais poderia votar? (segunda opção)',
    field: 'p39',
    placeholder: 'Nome',
  })
  push({
    id: 'p40',
    block: '8',
    kind: 'single',
    title: 'P40. Se os candidatos fossem estes, em quem votaria? (estimulada)',
    field: 'p40',
    options: lists.senado.map((c) => ({ value: c.id, label: c.label })),
  })
  push({
    id: 'p41',
    block: '8',
    kind: 'multi_nao_votaria',
    title: 'P41. Em qual desses nomes não votaria de jeito nenhum?',
    field: 'p41_nao_senado',
    list: 'senado',
  })
  push({
    id: 'p42',
    block: '8',
    kind: 'scale',
    title: 'P42. De 0 a 10, qual a chance de votar nesse candidato?',
    subtitle: 'Considere o candidato da P40 (ou P38).',
    field: 'p42',
    min: 0,
    max: 10,
  })

  // BLOCO 9
  push({
    id: 'p43',
    block: '9',
    kind: 'text',
    title: 'P43. Deputado estadual — voto espontâneo',
    field: 'p43',
    placeholder: 'Nome / número',
  })
  push({
    id: 'p44',
    block: '9',
    kind: 'single',
    title: 'P44. Deputado estadual — voto estimulado',
    field: 'p44',
    options: lists.depEstadual.map((c) => ({ value: c.id, label: c.label })),
  })
  push({
    id: 'p45',
    block: '9',
    kind: 'matrix_rejection',
    title: 'P45. Rejeição — deputado estadual',
    subtitle: 'Para cada nome, marque uma opção.',
    field: 'p45_dep_est',
    list: 'depEstadual',
  })

  // BLOCO 10
  push({
    id: 'p46',
    block: '10',
    kind: 'single',
    title: 'P46. O(a) sr(a) lembra em quem votou para vereador na última eleição?',
    field: 'p46',
    options: [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' },
      { value: 'ns', label: 'NS / NR' },
    ],
  })
  push({
    id: 'p47',
    block: '10',
    kind: 'text',
    title: 'P47. Em quem votou?',
    field: 'p47',
    placeholder: 'Aberta',
  })
  push({
    id: 'p48',
    block: '10',
    kind: 'text',
    title: 'P48. Qual vereador considera mais atuante?',
    field: 'p48',
    placeholder: 'Aberta',
  })

  // BLOCO 11
  push({
    id: 'p49',
    block: '11',
    kind: 'text',
    title: 'P49. Município',
    field: 'p49',
    placeholder: 'Nome do município',
  })
  push({
    id: 'p50',
    block: '11',
    kind: 'text',
    title: 'P50. Bairro / Localidade',
    field: 'p50',
    placeholder: '',
  })
  push({
    id: 'p51',
    block: '11',
    kind: 'single',
    title: 'P51. Zona',
    field: 'p51',
    options: [
      { value: 'urbana', label: 'Urbana' },
      { value: 'rural', label: 'Rural' },
    ],
  })
  push({
    id: 'p52',
    block: '11',
    kind: 'readonly_datetime',
    title: 'P52. Data e hora do registro',
    field: 'p52',
  })
  push({
    id: 'p53',
    block: '11',
    kind: 'text',
    title: 'P53. Código do entrevistador',
    field: 'p53',
    placeholder: 'Código ou identificação interna',
  })

  let result = steps
  if (options?.disabledQuestionIds?.length) {
    const d = new Set(options.disabledQuestionIds)
    result = result.filter((s) => !d.has(s.id))
  }
  if (options?.questionOrder?.length) {
    result = applyQuestionOrder(result, options.questionOrder)
  }
  return result
}

export function getCandidatesForMatrix(
  list: 'depFederal' | 'senado' | 'depEstadual',
  lists: SurveyConfigLists
): { id: string; label: string }[] {
  if (list === 'depFederal') return lists.depFederal
  if (list === 'senado') return lists.senado
  return lists.depEstadual
}
