'use client'

import { useState } from 'react'
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  TseStatus,
  tseBotaoContornoClass,
  tseBotaoNeutroClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseLinkAcaoClass,
  tseRotuloCampoClass,
  TseModal,
} from '@/components/tse/tse-ui'
import { RadarAviso, fmtDataHora, plural } from '@/components/monitoramento/radar-ui'
import {
  alternarAlertaFeedAtivo,
  coletarAlertaFeed,
  coletarAlertas,
  removerAlertaFeed,
  salvarAlertaFeed,
  type AlertaFeed,
  type AlertaFeedForm,
  type AlertaFeedTipo,
} from '@/lib/services/radar-eleitoral-client'
import { stripHtml } from '@/lib/strip-html'
import { cn } from '@/lib/utils'

const FORM_VAZIO: AlertaFeedForm = { name: '', rss_url: '', auto_classify: true, type: 'user_feed' }

const ROTULO_TIPO: Record<AlertaFeedTipo, string> = {
  user_feed: 'Candidato',
  adversary_feed: 'Adversário',
}

interface RadarFeedsModalProps {
  feeds: AlertaFeed[]
  onClose: () => void
  onAlterado: () => void
}

export function RadarFeedsModal({ feeds, onClose, onAlterado }: RadarFeedsModalProps) {
  const [form, setForm] = useState<AlertaFeedForm | null>(feeds.length === 0 ? FORM_VAZIO : null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<boolean>(false)
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)
  const [coletandoTodos, setColetandoTodos] = useState<boolean>(false)
  const [mensagem, setMensagem] = useState<{ tom: 'ok' | 'atencao'; texto: string } | null>(null)

  const executar = async (id: string, acao: () => Promise<string | void>) => {
    setOcupadoId(id)
    setMensagem(null)
    try {
      const texto = await acao()
      if (texto) setMensagem({ tom: 'ok', texto })
      onAlterado()
    } catch (e) {
      setMensagem({ tom: 'atencao', texto: e instanceof Error ? e.message : 'Erro ao salvar.' })
    } finally {
      setOcupadoId(null)
    }
  }

  const fecharForm = () => {
    setForm(null)
    setEditandoId(null)
  }

  const salvar = async () => {
    if (!form) return
    if (!form.name.trim() || !form.rss_url.trim()) {
      setMensagem({ tom: 'atencao', texto: 'Informe o nome e a URL do feed RSS.' })
      return
    }
    setSalvando(true)
    setMensagem(null)
    try {
      await salvarAlertaFeed({ ...form, name: form.name.trim(), rss_url: form.rss_url.trim() }, editandoId ?? undefined)
      fecharForm()
      onAlterado()
    } catch (e) {
      setMensagem({ tom: 'atencao', texto: e instanceof Error ? e.message : 'Erro ao salvar alerta.' })
    } finally {
      setSalvando(false)
    }
  }

  const editar = (feed: AlertaFeed) => {
    setEditandoId(feed.id)
    setForm({ name: feed.name, rss_url: feed.rss_url, auto_classify: feed.auto_classify ?? true, type: feed.type })
  }

  const remover = (feed: AlertaFeed) => {
    if (!window.confirm(`Remover o alerta "${stripHtml(feed.name)}"?`)) return
    void executar(feed.id, () => removerAlertaFeed(feed))
  }

  const coletarTodos = async () => {
    setColetandoTodos(true)
    setMensagem(null)
    try {
      const { coletadas, altoRisco } = await coletarAlertas()
      setMensagem({
        tom: 'ok',
        texto: `${plural(coletadas, 'notícia coletada', 'notícias coletadas')}${
          altoRisco > 0 ? ` · ${altoRisco} de risco alto` : ''
        }.`,
      })
      onAlterado()
    } catch {
      setMensagem({ tom: 'atencao', texto: 'Erro ao coletar notícias.' })
    } finally {
      setColetandoTodos(false)
    }
  }

  const ativos = feeds.filter((f) => f.active !== false).length

  return (
    <TseModal
      id="radar-feeds-titulo"
      titulo="Alertas RSS"
      subtitulo={`${plural(feeds.length, 'alerta cadastrado', 'alertas cadastrados')} · ${plural(ativos, 'ativo', 'ativos')} · Google Alerts e feeds próprios`}
      onClose={onClose}
      rodape={
        <>
          {form ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={() => setForm(FORM_VAZIO)}
              className={cn(tseLinkAcaoClass, 'inline-flex items-center gap-1')}
            >
              <Plus className="h-4 w-4" /> Novo alerta
            </button>
          )}
          <div className="flex gap-2">
            {feeds.length > 0 ? (
              <button
                type="button"
                onClick={() => void coletarTodos()}
                disabled={coletandoTodos}
                className={tseBotaoNeutroClass}
              >
                <RefreshCw className={cn('h-4 w-4', coletandoTodos && 'animate-spin')} />
                {coletandoTodos ? 'Coletando…' : 'Coletar todos'}
              </button>
            ) : null}
            <button type="button" onClick={onClose} className={tseBotaoContornoClass}>
              Fechar
            </button>
          </div>
        </>
      }
    >
      {mensagem ? <RadarAviso tom={mensagem.tom}>{mensagem.texto}</RadarAviso> : null}

      {feeds.map((feed) => {
        const ocupado = ocupadoId === feed.id
        const ativo = feed.active !== false
        return (
          <section key={`${feed.type}-${feed.id}`} className={cn('rounded-xl bg-white p-4 shadow-sm', !ativo && 'opacity-60')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[14px] font-bold">{stripHtml(feed.name)}</p>
                  <TseStatus cor={feed.type === 'adversary_feed' ? 'var(--tse-green)' : 'var(--tse-yellow)'}>
                    {ROTULO_TIPO[feed.type]}
                  </TseStatus>
                  {!ativo ? <TseStatus cor="var(--tse-zero)">Inativo</TseStatus> : null}
                </div>
                <p className="mt-1 break-all text-[11px] text-[var(--tse-muted)]">{feed.rss_url}</p>
                {feed.last_collected_at ? (
                  <p className="text-[11px] text-[var(--tse-muted)]">Última coleta: {fmtDataHora(feed.last_collected_at)}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin text-[var(--tse-yellow)]" /> : null}
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    void executar(feed.id, async () => {
                      const n = await coletarAlertaFeed(feed)
                      return `${stripHtml(feed.name)}: ${plural(n, 'notícia coletada', 'notícias coletadas')}.`
                    })
                  }
                  title="Coletar agora"
                  aria-label={`Coletar ${feed.name}`}
                  className="rounded-md p-1.5 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-olive)]"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                {feed.type === 'user_feed' ? (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void executar(feed.id, () => alternarAlertaFeedAtivo(feed))}
                    className={tseBotaoNeutroClass}
                  >
                    {ativo ? 'Desativar' : 'Ativar'}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => editar(feed)}
                  title="Editar"
                  aria-label={`Editar ${feed.name}`}
                  className="rounded-md p-1.5 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-olive)]"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => remover(feed)}
                  title="Remover"
                  aria-label={`Remover ${feed.name}`}
                  className="rounded-md p-1.5 text-[var(--tse-muted)] hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        )
      })}

      {form ? (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-[14px] font-bold">{editandoId ? 'Editar alerta' : 'Novo alerta'}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              <span className={tseRotuloCampoClass}>Tipo</span>
              <select
                value={form.type}
                disabled={Boolean(editandoId)}
                onChange={(e) => setForm({ ...form, type: e.target.value as AlertaFeedTipo })}
                className={tseCampoClass}
              >
                <option value="user_feed">Feed do candidato</option>
                <option value="adversary_feed">Radar de adversário</option>
              </select>
            </label>
            <label>
              <span className={tseRotuloCampoClass}>Nome</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Meu nome + Piauí"
                className={tseCampoClass}
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className={tseRotuloCampoClass}>URL do feed RSS</span>
            <input
              type="url"
              value={form.rss_url}
              onChange={(e) => setForm({ ...form, rss_url: e.target.value })}
              placeholder="https://www.google.com/alerts/feeds/…"
              className={tseCampoClass}
            />
          </label>
          {form.type === 'user_feed' ? (
            <label className="mt-3 flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={form.auto_classify}
                onChange={(e) => setForm({ ...form, auto_classify: e.target.checked })}
                className="h-4 w-4 accent-[var(--tse-olive)]"
              />
              Classificar automaticamente (sentimento, risco e tema)
            </label>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={salvando} onClick={() => void salvar()} className={tseBotaoPrimarioClass}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editandoId ? 'Salvar alterações' : 'Adicionar alerta'}
            </button>
            {feeds.length > 0 ? (
              <button type="button" disabled={salvando} onClick={fecharForm} className={tseBotaoNeutroClass}>
                Cancelar
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </TseModal>
  )
}
