export const COMUNICAR_LIDERES_TEMPLATE_TOKENS = {
  cidade: '{{cidade}}',
  data: '{{data}}',
  hora: '{{hora}}',
} as const

export const COMUNICAR_LIDERES_TEMPLATE_DEFAULT =
  'Meus Líderes de {{cidade}}, no dia {{data}} às {{hora}}, estaremos aí com vocês, para comunicarmos e estarmos perto do povo da nossa querida {{cidade}}! Conto com a presença de todos! Vamos juntos!'

export type ComunicarLideresMensagemFile = {
  template: string
  updatedAt: string | null
}

export type ComunicarLideresVisitaCampos = {
  municipio: string
  dataLabel: string
  horario: string
}

export function applyComunicarLideresTemplate(
  template: string,
  visita: ComunicarLideresVisitaCampos,
): string {
  const cidade = visita.municipio.trim() || '—'
  const data = visita.dataLabel.trim() || '—'
  const hora = visita.horario.trim() || '—'
  return template
    .replaceAll(COMUNICAR_LIDERES_TEMPLATE_TOKENS.cidade, cidade)
    .replaceAll(COMUNICAR_LIDERES_TEMPLATE_TOKENS.data, data)
    .replaceAll(COMUNICAR_LIDERES_TEMPLATE_TOKENS.hora, hora)
}

/**
 * Reconstrói o modelo a partir do texto editado, trocando cidade/data/hora
 * atuais pelos tokens reutilizáveis.
 */
export function mensagemToComunicarLideresTemplate(
  mensagem: string,
  visita: ComunicarLideresVisitaCampos,
): string {
  const cidade = visita.municipio.trim()
  const data = visita.dataLabel.trim()
  const hora = visita.horario.trim()
  let template = mensagem

  const replacements: Array<[string, string]> = []
  if (cidade) replacements.push([cidade, COMUNICAR_LIDERES_TEMPLATE_TOKENS.cidade])
  if (data) replacements.push([data, COMUNICAR_LIDERES_TEMPLATE_TOKENS.data])
  if (hora) replacements.push([hora, COMUNICAR_LIDERES_TEMPLATE_TOKENS.hora])
  replacements.sort((a, b) => b[0].length - a[0].length)

  for (const [value, token] of replacements) {
    if (!value) continue
    template = template.split(value).join(token)
  }

  return template.trim() || COMUNICAR_LIDERES_TEMPLATE_DEFAULT
}
