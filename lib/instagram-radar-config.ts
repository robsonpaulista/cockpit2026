/**
 * Limites e custos Apify — Instagram Scraper (apify/instagram-scraper)
 *
 * Fonte oficial (mai/2026): https://apify.com/apify/instagram-scraper
 * - Posts: US$ 1,50 / 1.000 resultados (pay-per-event)
 * - Comentários (lista): US$ 2,30 / 1.000 — NÃO usamos no radar
 * - Plano Free: US$ 5/mês em créditos pré-pagos (não acumulam)
 *
 * Coleta padrão: até 10 perfis × 12 posts = 120 posts ≈ US$ 0,18/run
 * Semanal (4×/mês) ≈ US$ 0,72/mês — dentro do free.
 */

/** Preço por post (US$ 1,50 / 1000) — documentação Apify mai/2026 */
export const APIFY_INSTAGRAM_POST_USD_PER_1000 = 1.5

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

/** Janela de posts (onlyPostsNewerThan) */
export function getInstagramRadarPostsWindow(): string {
  return process.env.INSTAGRAM_RADAR_POSTS_WINDOW?.trim() || '30 days'
}

/** Cooldown entre coletas completas (ms) — padrão 7 dias */
export const INSTAGRAM_RADAR_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export function isInstagramRadarCooldownEnabled(): boolean {
  const skip = process.env.INSTAGRAM_RADAR_SKIP_COOLDOWN?.trim().toLowerCase()
  return !(skip === '1' || skip === 'true' || skip === 'yes')
}

/** Teto de cobrança por run (maxTotalChargeUsd na API Apify) */
export function getInstagramRadarMaxChargeUsd(): number {
  const raw = process.env.INSTAGRAM_RADAR_MAX_CHARGE_USD?.trim()
  const n = raw ? Number(raw) : 0.25
  return Number.isFinite(n) && n > 0 ? Math.min(2, n) : 0.25
}

export function estimateInstagramRadarCostUsd(postCount: number): number {
  return (postCount / 1000) * APIFY_INSTAGRAM_POST_USD_PER_1000
}

export function maxPostsForBudgetUsd(budgetUsd: number): number {
  return Math.floor((budgetUsd / APIFY_INSTAGRAM_POST_USD_PER_1000) * 1000)
}

export const APIFY_INSTAGRAM_ACTOR_ID = 'apify~instagram-scraper'
