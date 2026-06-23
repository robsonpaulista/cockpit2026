import { redirect } from 'next/navigation'
import { MONITORAMENTO_LIDERES_HREF } from '@/lib/monitoramento-lideres-route'

export default function InstagramLideresRedirectPage() {
  redirect(MONITORAMENTO_LIDERES_HREF)
}
