export function gerarMensagemWhatsApp(input: { cidade: string | null; imagem_url: string | null }): string {
  const cidade = input.cidade?.trim() || 'nossa região'
  const url = input.imagem_url?.trim() || ''
  return `Pessoal, saiu conteúdo novo sobre uma entrega importante em ${cidade}.

Entrem, curtam, comentem e compartilhem.

${url}`
}
