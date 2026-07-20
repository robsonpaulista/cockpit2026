import { redirect } from 'next/navigation'

/** Rota antiga — redireciona para Fluxo Digital. */
export default function CoberturaRedirectPage() {
  redirect('/dashboard/fluxo-digital')
}
