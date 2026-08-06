import { redirect } from 'next/navigation'

/** Rota legada — redireciona para Conteúdo. */
export default function CoberturaPage() {
  redirect('/dashboard/conteudo')
}
