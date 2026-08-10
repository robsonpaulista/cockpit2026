/**
 * Limites e custos Apify — Instagram Scraper (apify/instagram-scraper)
 *
 * Fonte oficial (mai/2026): https://apify.com/apify/instagram-scraper
 * - Posts: US$ 1,50 / 1.000 resultados (pay-per-event)
 * - Comentários (lista): US$ 2,30 / 1.000 — usado no radar (contas únicas)
 * - Plano Free: US$ 5/mês em créditos pré-pagos (não acumulam)
 *
 * Coleta padrão: até 10 perfis × 12 posts = 120 posts ≈ US$ 0,18/run
 * + details (1/perfil) ≈ US$ 0,015 — avatar de perfil
 * + comentários (até 8 posts/perfil × 20 cmt) sob teto separado
 *
 * Multi-conta (opcional):
 *   APIFY_TOKEN2..5 → divide posts/comentários (até 4 contas)
 *   (APIFY_TOKEN desativado se limite; cada free ≈ US$ 5/mês).
 * Comentários: no máx. 1× / 7 dias (INSTAGRAM_RADAR_SKIP_COMMENTS_COOLDOWN=1 para forçar).
 */

/** Preço por post (US$ 1,50 / 1000) — documentação Apify mai/2026 */
export const APIFY_INSTAGRAM_POST_USD_PER_1000 = 1.5

/** Preço por comentário listado (US$ 2,30 / 1000) */
export const APIFY_INSTAGRAM_COMMENT_USD_PER_1000 = 2.3

/** Crédito mensal do plano Free Apify */
export const APIFY_FREE_MONTHLY_USD = 5

/** Máximo de candidatos ativos com @ por execução */
export function getInstagramRadarMaxActors(): number {
  const raw = process.env.INSTAGRAM_RADAR_MAX_ACTORS?.trim()
  const n = raw ? Number(raw) : 10
  return Number.isFinite(n) && n > 0 ? Math.min(25, Math.floor(n)) : 10
}

/** Posts por perfil (resultsLimit do Actor) */
export function getInstagramRadarPostsLimit(): number {
  const raw = process.env.INSTAGRAM_RADAR_POSTS_LIMIT?.trim()
  const n = raw ? Number(raw) : 12
  return Number.isFinite(n) && n > 0 ? Math.min(30, Math.floor(n)) : 12
}

/** Comentários máximos por post (resultsLimit comments) */
export function getInstagramRadarCommentsLimit(): number {
  const raw = process.env.INSTAGRAM_RADAR_COMMENTS_LIMIT?.trim()
  const n = raw ? Number(raw) : 20
  return Number.isFinite(n) && n > 0 ? Math.min(100, Math.floor(n)) : 20
}

/** Quantos posts (mais engajados) por perfil entram na coleta de comentários */
export function getInstagramRadarCommentsMaxPostsPerActor(): number {
  const raw = process.env.INSTAGRAM_RADAR_COMMENTS_MAX_POSTS?.trim()
  const n = raw ? Number(raw) : 8
  return Number.isFinite(n) && n > 0 ? Math.min(20, Math.floor(n)) : 8
}

/** Liga/desliga coleta de comentários (default: ligada) */
export function isInstagramRadarCommentsCollectEnabled(): boolean {
  const raw = process.env.INSTAGRAM_RADAR_COLLECT_COMMENTS?.trim().toLowerCase()
  if (!raw) return true
  return !(raw === '0' || raw === 'false' || raw === 'no' || raw === 'off')
}

/** Janela de posts (onlyPostsNewerThan) */
export function getInstagramRadarPostsWindow(): string {
  return process.env.INSTAGRAM_RADAR_POSTS_WINDOW?.trim() || '30 days'
}

/** Cooldown entre coletas completas (ms) — padrão 7 dias */
export const INSTAGRAM_RADAR_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

/** Cooldown só da fase de comentários (ms) — padrão 7 dias */
export const INSTAGRAM_RADAR_COMMENTS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export function isInstagramRadarCooldownEnabled(): boolean {
  const skip = process.env.INSTAGRAM_RADAR_SKIP_COOLDOWN?.trim().toLowerCase()
  return !(skip === '1' || skip === 'true' || skip === 'yes')
}

/** Cooldown semanal da coleta de comentários (independente dos posts) */
export function isInstagramRadarCommentsCooldownEnabled(): boolean {
  const skip = process.env.INSTAGRAM_RADAR_SKIP_COMMENTS_COOLDOWN?.trim().toLowerCase()
  return !(skip === '1' || skip === 'true' || skip === 'yes')
}

/** Teto de cobrança por run de posts (maxTotalChargeUsd na API Apify) */
export function getInstagramRadarMaxChargeUsd(): number {
  const raw = process.env.INSTAGRAM_RADAR_MAX_CHARGE_USD?.trim()
  const n = raw ? Number(raw) : 0.25
  return Number.isFinite(n) && n > 0 ? Math.min(2, n) : 0.25
}

/** Teto por run de comentários */
export function getInstagramRadarCommentsMaxChargeUsd(): number {
  const raw = process.env.INSTAGRAM_RADAR_COMMENTS_MAX_CHARGE_USD?.trim()
  const n = raw ? Number(raw) : 1.5
  return Number.isFinite(n) && n > 0 ? Math.min(5, n) : 1.5
}

export function estimateInstagramRadarCostUsd(postCount: number): number {
  return (postCount / 1000) * APIFY_INSTAGRAM_POST_USD_PER_1000
}

export function estimateInstagramRadarCommentsCostUsd(commentCount: number): number {
  return (commentCount / 1000) * APIFY_INSTAGRAM_COMMENT_USD_PER_1000
}

export function maxPostsForBudgetUsd(budgetUsd: number): number {
  return Math.floor((budgetUsd / APIFY_INSTAGRAM_POST_USD_PER_1000) * 1000)
}

export const APIFY_INSTAGRAM_ACTOR_ID = 'apify~instagram-scraper'
