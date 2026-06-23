import { redirect } from 'next/navigation'
import { territorioCampoHref, TERRITORIO_CAMPO_TAB_VISITAS } from '@/lib/territorio-campo-route'

export default function CampoRedirectPage() {
  redirect(territorioCampoHref(TERRITORIO_CAMPO_TAB_VISITAS))
}
