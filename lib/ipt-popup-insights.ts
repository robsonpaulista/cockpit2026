import {
  formatInsightAcaoLabel,
  formatInsightIndicadorLabel,
  IPT_INDICADORES,
  IPT_SINAIS,
  type IptMunicipioInsightRow,
} from '@/lib/ipt-insights'
import {
  IPT_SINAL_LABEL,
  iptLabelIndicador,
  normalizeIptMunicipio,
  type IptIndicador,
  type IptMunicipio,
  type IptSinal,
} from '@/lib/ipt'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function authorLabel(row: IptMunicipioInsightRow): string {
  const name = row.profiles?.name?.trim()
  if (name) return name
  const email = row.profiles?.email?.trim()
  if (email) return email.split('@')[0] ?? 'Usuário'
  return 'Equipe'
}

export function createIptInsightsSectionShell(
  m: IptMunicipio,
  appearance: 'light' | 'dark' = 'light'
): string {
  const isDark = appearance === 'dark'
  const line = isDark ? 'rgba(148,163,184,0.25)' : '#e2e8f0'
  const key = normalizeIptMunicipio(m.municipio)

  const indicadorOptions = IPT_INDICADORES.map(
    (id) =>
      `<option value="${id}">${escapeHtml(iptLabelIndicador(id))}</option>`
  ).join('')

  const sinalOptions = IPT_SINAIS.map(
    (s) => `<option value="${s}">${escapeHtml(IPT_SINAL_LABEL[s])}</option>`
  ).join('')

  return `<div
    class="ipt-insights-root"
    data-ipt-insights-root
    data-municipio="${escapeHtml(m.municipio)}"
    data-municipio-key="${escapeHtml(key)}"
    data-sinal-visitas="${m.sinaisOriginais?.visitas ?? m.sinais.visitas}"
    data-sinal-obras="${m.sinaisOriginais?.obras ?? m.sinais.obras}"
    data-sinal-pesquisa="${m.sinaisOriginais?.pesquisa ?? m.sinais.pesquisa}"
    data-prioridade="${m.prioridade}"
    style="margin-top:10px;padding-top:10px;border-top:1px solid ${line}"
  >
    <button
      type="button"
      class="ipt-insights-toggle"
      data-ipt-insights-toggle
      aria-expanded="false"
      aria-controls="ipt-insights-panel-${escapeHtml(key)}"
    >
      <span class="ipt-insights-toggle__ico" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </span>
      <span class="ipt-insights-toggle__label">Insights de campo</span>
      <span class="ipt-insights-toggle__count" data-ipt-insights-count hidden></span>
      <span class="ipt-insights-toggle__chevron" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </span>
    </button>
    <div
      id="ipt-insights-panel-${escapeHtml(key)}"
      class="ipt-insights-panel"
      data-ipt-insights-panel
      hidden
    >
      <p class="ipt-insights-panel__lead">
        Registre contexto local. Opcionalmente ajuste a avaliação quando pesquisa ou obras ainda não refletem o cenário.
      </p>
      <form class="ipt-insights-form" data-ipt-insights-form>
        <label class="ipt-insights-field">
          <span class="ipt-insights-field__label">Indicador</span>
          <select name="indicador" class="ipt-insights-input" required>${indicadorOptions}</select>
        </label>
        <label class="ipt-insights-field">
          <span class="ipt-insights-field__label">Insight</span>
          <textarea
            name="body"
            class="ipt-insights-input ipt-insights-textarea"
            rows="3"
            required
            minlength="3"
            placeholder="Ex.: prefeito sinalizou obra em licitação; pesquisa local prevista em agosto…"
          ></textarea>
        </label>
        <fieldset class="ipt-insights-fieldset">
          <legend class="ipt-insights-field__label">Este insight altera a avaliação do indicador?</legend>
          <label class="ipt-insights-radio">
            <input type="radio" name="acao_avaliacao" value="nenhuma" checked />
            Não — apenas registrar observação
          </label>
          <label class="ipt-insights-radio">
            <input type="radio" name="acao_avaliacao" value="definir" />
            Sim — definir novo status
          </label>
          <label class="ipt-insights-radio">
            <input type="radio" name="acao_avaliacao" value="automatico" />
            Sim — voltar ao cálculo automático
          </label>
        </fieldset>
        <div class="ipt-insights-sinal-wrap" data-ipt-sinal-wrap hidden>
          <label class="ipt-insights-field">
            <span class="ipt-insights-field__label">Novo status</span>
            <select name="sinal_override" class="ipt-insights-input">
              <option value="">Selecione…</option>
              ${sinalOptions}
            </select>
          </label>
        </div>
        <p class="ipt-insights-error" data-ipt-insights-error hidden></p>
        <button type="submit" class="ipt-insights-submit" data-ipt-insights-submit>
          Salvar insight
        </button>
      </form>
      <div class="ipt-insights-history" data-ipt-insights-history>
        <div class="ipt-insights-history__loading">Carregando histórico…</div>
      </div>
    </div>
  </div>`
}

function renderHistoryItem(row: IptMunicipioInsightRow, muted: string): string {
  const acao = formatInsightAcaoLabel(row)
  const meta = `${formatInsightIndicadorLabel(row.indicador)} · ${formatDateShort(row.created_at)} · ${escapeHtml(authorLabel(row))}`
  const acaoHtml = acao
    ? `<div style="margin-top:4px;font-size:10px;font-weight:600;color:#185FA5">${escapeHtml(acao)}</div>`
    : ''

  return `<div class="ipt-insights-history-item" style="padding:8px 0;border-bottom:1px solid rgba(148,163,184,0.2)">
    <div style="font-size:10px;color:${muted}">${meta}</div>
    <div style="margin-top:4px;font-size:11px;line-height:1.45;white-space:pre-wrap">${escapeHtml(row.body)}</div>
    ${acaoHtml}
  </div>`
}

export function renderIptInsightsHistory(
  rows: IptMunicipioInsightRow[],
  appearance: 'light' | 'dark' = 'light'
): string {
  const muted = appearance === 'dark' ? '#94a3b8' : '#64748b'
  if (rows.length === 0) {
    return `<div class="ipt-insights-history__empty">Nenhum insight registrado ainda.</div>`
  }
  return `<div class="ipt-insights-history__title">Histórico</div>${rows.map((r) => renderHistoryItem(r, muted)).join('')}`
}

async function fetchInsights(municipio: string): Promise<IptMunicipioInsightRow[]> {
  const res = await fetch(
    `/api/ipt/insights?municipio=${encodeURIComponent(municipio)}`,
    { cache: 'no-store' }
  )
  if (!res.ok) return []
  const data = (await res.json()) as { insights?: IptMunicipioInsightRow[] }
  return data.insights ?? []
}

function syncSinalWrap(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('[data-ipt-insights-form]')
  const wrap = root.querySelector<HTMLElement>('[data-ipt-sinal-wrap]')
  if (!form || !wrap) return
  const acao = form.querySelector<HTMLInputElement>('input[name="acao_avaliacao"]:checked')?.value
  const show = acao === 'definir'
  wrap.hidden = !show
}

function updateInsightsCountBadge(root: HTMLElement, count: number): void {
  const badge = root.querySelector<HTMLElement>('[data-ipt-insights-count]')
  if (!badge) return
  if (count <= 0) {
    badge.hidden = true
    badge.textContent = ''
    return
  }
  badge.hidden = false
  badge.textContent = String(count)
}

function bindInsightsToggle(root: HTMLElement): void {
  const btn = root.querySelector<HTMLButtonElement>('[data-ipt-insights-toggle]')
  const panel = root.querySelector<HTMLElement>('[data-ipt-insights-panel]')
  if (!btn || !panel || btn.dataset.iptToggleBound === '1') return
  btn.dataset.iptToggleBound = '1'

  btn.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    const willOpen = panel.hidden
    panel.hidden = !willOpen
    btn.setAttribute('aria-expanded', String(willOpen))
    root.classList.toggle('ipt-insights-root--open', willOpen)
  })
}

function bindInsightsForm(
  root: HTMLElement,
  appearance: 'light' | 'dark',
  onSaved?: () => void
): void {
  const form = root.querySelector<HTMLFormElement>('[data-ipt-insights-form]')
  if (!form || form.dataset.iptBound === '1') return
  form.dataset.iptBound = '1'

  form.querySelectorAll<HTMLInputElement>('input[name="acao_avaliacao"]').forEach((radio) => {
    radio.addEventListener('change', () => syncSinalWrap(root))
  })
  syncSinalWrap(root)

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    event.stopPropagation()

    const errorEl = root.querySelector<HTMLElement>('[data-ipt-insights-error]')
    const submitBtn = root.querySelector<HTMLButtonElement>('[data-ipt-insights-submit]')
    const historyEl = root.querySelector<HTMLElement>('[data-ipt-insights-history]')
    if (!errorEl || !submitBtn || !historyEl) return

    errorEl.hidden = true
    errorEl.textContent = ''
    submitBtn.disabled = true
    submitBtn.textContent = 'Salvando…'

    const fd = new FormData(form)
    const acao = String(fd.get('acao_avaliacao') ?? 'nenhuma')
    const payload = {
      municipio: root.dataset.municipio ?? '',
      indicador: String(fd.get('indicador') ?? 'visitas'),
      body: String(fd.get('body') ?? '').trim(),
      acao_avaliacao: acao,
      sinal_override: acao === 'definir' ? String(fd.get('sinal_override') ?? '') || null : null,
      sinal_visitas_calculado: root.dataset.sinalVisitas ?? null,
      sinal_obras_calculado: root.dataset.sinalObras ?? null,
      sinal_pesquisa_calculado: root.dataset.sinalPesquisa ?? null,
      prioridade_calculada: root.dataset.prioridade ?? null,
    }

    try {
      const res = await fetch('/api/ipt/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? 'Erro ao salvar insight')
      }

      form.reset()
      syncSinalWrap(root)

      const insights = await fetchInsights(payload.municipio)
      historyEl.innerHTML = renderIptInsightsHistory(insights, appearance)
      updateInsightsCountBadge(root, insights.length)
      onSaved?.()
    } catch (e: unknown) {
      errorEl.hidden = false
      errorEl.textContent = e instanceof Error ? e.message : 'Erro ao salvar'
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = 'Salvar insight'
    }
  })
}

export async function hydrateIptPopupInsights(
  popupRoot: HTMLElement,
  appearance: 'light' | 'dark' = 'light',
  onSaved?: () => void
): Promise<void> {
  const root = popupRoot.querySelector<HTMLElement>('[data-ipt-insights-root]')
  if (!root) return

  const municipio = root.dataset.municipio ?? ''
  const historyEl = root.querySelector<HTMLElement>('[data-ipt-insights-history]')
  if (!historyEl) return

  bindInsightsToggle(root)
  bindInsightsForm(root, appearance, onSaved)

  try {
    const insights = await fetchInsights(municipio)
    historyEl.innerHTML = renderIptInsightsHistory(insights, appearance)
    updateInsightsCountBadge(root, insights.length)
  } catch {
    historyEl.innerHTML = `<div class="ipt-insights-history__empty ipt-insights-history__error">Não foi possível carregar o histórico.</div>`
  }
}

export function overrideBadgeHtml(indicador: IptIndicador, muted: string): string {
  return `<span style="margin-left:6px;font-size:9px;font-weight:600;color:#185FA5;background:rgba(24,95,165,0.1);padding:2px 6px;border-radius:999px">ajustado</span>`
}
