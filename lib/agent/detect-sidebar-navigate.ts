import {
  findSidebarNavTargetByHref,
  normalizeSidebarNavText,
  SIDEBAR_NAV_TARGETS,
  type SidebarNavTarget,
} from '@/lib/sidebar-nav-routes'

export type SidebarNavigateResult =
  | { kind: 'navigate'; target: SidebarNavTarget }
  | { kind: 'home'; target: SidebarNavTarget }
  | { kind: 'ambiguous'; candidates: SidebarNavTarget[] }
  | { kind: 'already_there'; target: SidebarNavTarget }

const NAV_VERB =
  /\b(abrir|abra|abre|ir para|vá para|va para|vai para|ir ao|vá ao|va ao|vai ao|ir na|vá na|va na|vai na|ir em|vá em|va em|vai em|navegue|navegar|mostrar|mostre|acessar|acesse|entrar|entre em|mudar para|trocar para|me leve|leve me|leva me|quero ver|quero ir|preciso ir|preciso abrir)\b/

const CLOSE_VERB =
  /\b(fechar|feche|fecha|sair|saia|voltar|volte|volta|retornar|retorne)\b/

const HOME_PHRASE =
  /\b(inicio|home|cockpit|visao geral|tela inicial|pagina inicial|dashboard|painel principal)\b/

const DATA_QUERY =
  /\b(hoje|amanha|ontem|expectativa|votos|demandas em|pesquisa em|intencao|visitas em|viagens em|compromissos de|agenda de|agenda do|noticias em destaque|envia|envie|mande|quantos|quantas|qual a|quais os|quais as|detalhe|detalhar|buscar|liste|listar)\b/

const FILLER =
  /\b(jarvis|jaques|cockpit|pagina|página|modulo|modulo|tela|aba|secao|seção|do|da|de|o|a|os|as|um|uma|por favor|pfv|pra|pro|para|ao|a|em|na|no|me|minha|minhas|meus)\b/g

function stripNavFluff(text: string): string {
  return normalizeSidebarNavText(text).replace(FILLER, ' ').replace(/\s+/g, ' ').trim()
}

function isDataQueryNotNavigation(query: string): boolean {
  const q = normalizeSidebarNavText(query)
  if (!NAV_VERB.test(q) && !CLOSE_VERB.test(q)) return true
  return DATA_QUERY.test(q)
}

function scoreTarget(query: string, target: SidebarNavTarget): number {
  let best = 0
  for (const alias of target.aliases) {
    if (!alias) continue
    if (query === alias) best = Math.max(best, alias.length + 100)
    else if (query.includes(alias)) best = Math.max(best, alias.length)
  }
  if (query.includes(normalizeSidebarNavText(target.label))) {
    best = Math.max(best, normalizeSidebarNavText(target.label).length + 10)
  }
  return best
}

function resolveTargetFromPhrase(phrase: string): SidebarNavTarget[] {
  const q = stripNavFluff(phrase)
  if (!q) return []

  const scored = SIDEBAR_NAV_TARGETS.map((target) => ({
    target,
    score: scoreTarget(q, target),
  }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return []

  const top = scored[0]!.score
  return scored.filter((row) => row.score >= top - 2 && row.score >= top * 0.85).map((row) => row.target)
}

function isSameRoute(currentPath: string | undefined, href: string): boolean {
  if (!currentPath) return false
  if (currentPath === href) return true
  if (href === '/dashboard') return currentPath === '/dashboard'
  return currentPath.startsWith(`${href}/`) || currentPath === href
}

export function buildSidebarNavigateReply(
  result: Exclude<SidebarNavigateResult, { kind: 'ambiguous' }>
): string {
  if (result.kind === 'already_there') {
    return `Você já está em **${result.target.label}**.`
  }
  if (result.kind === 'home') {
    return 'Voltando para **Visão Geral**.'
  }
  return `Abrindo **${result.target.label}**.`
}

export function detectSidebarNavigate(
  message: string,
  currentPath?: string
): SidebarNavigateResult | null {
  const raw = message.trim()
  if (!raw) return null

  const q = normalizeSidebarNavText(raw)
  if (isDataQueryNotNavigation(q)) return null

  const homeTarget = findSidebarNavTargetByHref('/dashboard')
  if (!homeTarget) return null

  const wantsCloseOrBack = CLOSE_VERB.test(q)
  const wantsHome = HOME_PHRASE.test(q)

  if (wantsCloseOrBack || wantsHome) {
    const phraseAfterClose = stripNavFluff(
      q.replace(CLOSE_VERB, ' ').replace(/\b(pagina|tela|modulo|aba)\b/g, ' ')
    )

    if (wantsHome || !phraseAfterClose || phraseAfterClose === 'pagina' || phraseAfterClose === 'tela') {
      if (isSameRoute(currentPath, '/dashboard')) {
        return { kind: 'already_there', target: homeTarget }
      }
      return { kind: 'home', target: homeTarget }
    }

    const closeTargets = resolveTargetFromPhrase(phraseAfterClose)
    if (closeTargets.length === 1) {
      if (isSameRoute(currentPath, '/dashboard')) {
        return { kind: 'already_there', target: homeTarget }
      }
      return { kind: 'home', target: homeTarget }
    }
  }

  if (!NAV_VERB.test(q)) return null

  const phrase = stripNavFluff(q.replace(NAV_VERB, ' '))
  const candidates = resolveTargetFromPhrase(phrase)
  if (candidates.length === 0) return null
  if (candidates.length > 1) {
    return { kind: 'ambiguous', candidates: candidates.slice(0, 4) }
  }

  const target = candidates[0]!
  if (isSameRoute(currentPath, target.href)) {
    return { kind: 'already_there', target }
  }
  return { kind: 'navigate', target }
}

export function resolveSidebarNavigateFromGroqArgs(
  message: string,
  args: Record<string, string>
): SidebarNavigateResult | null {
  const fromArgs = args.label?.trim() || args.termo?.trim() || args.url?.trim() || ''
  const phrase = fromArgs || message
  const candidates = resolveTargetFromPhrase(stripNavFluff(phrase))
  if (candidates.length === 1) {
    return { kind: 'navigate', target: candidates[0]! }
  }
  if (candidates.length > 1) {
    return { kind: 'ambiguous', candidates: candidates.slice(0, 4) }
  }
  const href = args.url?.trim()
  if (href?.startsWith('/')) {
    const target = findSidebarNavTargetByHref(href)
    if (target) return { kind: 'navigate', target }
  }
  return null
}
