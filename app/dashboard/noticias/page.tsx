import { redirect } from 'next/navigation'

export default function NoticiasPage() {
  redirect('/dashboard/noticias/monitoramento?tab=google-news')
}
