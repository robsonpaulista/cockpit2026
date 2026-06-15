function normalize(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Pedido para fechar modal, painel de resultado ou cancelar fluxo — não é consulta de dados. */
export function isJarvisDismissUiQuery(query: string): boolean {
  const raw = query.trim()
  if (!raw || raw.length > 80) return false

  const q = normalize(raw)
  if (/^(fechar|feche|fecha|sair|cancelar|voltar|desisto)$/i.test(raw)) return true
  if (/\b(fechar|feche|fecha|pode fechar|pode fechar isso)\b/.test(q)) return true
  if (/\bsair\s+(do|da)\s+(modal|janela|painel|resultado)\b/.test(q)) return true
  if (/\b(fechar|feche)\s+(modal|modais|janela|painel|resultado|tela|isso)\b/.test(q)) return true

  return false
}

export function jarvisSilentDismissFields(content = 'Pronto.'): {
  content: string
  skipAnswerSpeech: true
  skipListenResumePhrase: true
} {
  return {
    content,
    skipAnswerSpeech: true,
    skipListenResumePhrase: true,
  }
}

export function pageHasOpenModalForDismiss(pageContext: {
  kind: string
  modalLiderancasAberto?: boolean
  modalPesquisasAberto?: boolean
  modalDemandasCidadeAberto?: boolean
  seletorDemandasAberto?: boolean
  modalObrasAberto?: boolean
} | null | undefined): boolean {
  if (!pageContext) return false
  if (pageContext.kind === 'resumo-eleicoes') {
    return Boolean(
      pageContext.modalLiderancasAberto ||
        pageContext.modalPesquisasAberto ||
        pageContext.modalDemandasCidadeAberto ||
        pageContext.seletorDemandasAberto
    )
  }
  if (pageContext.kind === 'territorio') {
    return Boolean(pageContext.modalObrasAberto)
  }
  return false
}
