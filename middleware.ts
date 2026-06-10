import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Exclui todo /_next (chunks, HMR, static) e assets públicos —
     * evita middleware em arquivos de build que quebram navegação no dev.
     */
    '/((?!_next|favicon.ico|icons|sw\\.js|sw-pesquisador\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}




