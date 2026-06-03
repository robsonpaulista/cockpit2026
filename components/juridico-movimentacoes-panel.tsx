'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Copy, History, Loader2, Plus, Send } from 'lucide-react'
import { WhatsAppSendModal } from '@/components/whatsapp-send-modal'
import {
  fetchJuridicoMovimentacoes,
  registrarJuridicoMovimentacao,
} from '@/lib/services/juridico-processos'
import type { JuridicoMovimentacao } from '@/lib/juridico-movimentacoes'
import { formatUltimaMovimentacaoExibicao } from '@/lib/juridico-movimentacoes'
import { buildJuridicoMovimentacaoWhatsAppText } from '@/lib/juridico-whatsapp'
import type { ProcessoDimensao } from '@/lib/juridico-processos-dimensao'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import { cn, formatDateShort } from '@/lib/utils'

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fonteLabel(fonte: JuridicoMovimentacao['fonte']): string {
  if (fonte === 'planilha') return 'Planilha'
  if (fonte === 'datajud') return 'Datajud'
  return 'Manual'
}

type Props = {
  processo: ProcessoDimensao
  statusOptions?: string[]
  onAtualizado?: () => void
}

export function JuridicoMovimentacoesPanel({
  processo,
  statusOptions = [],
  onAtualizado,
}: Props) {
  const [historico, setHistorico] = useState<JuridicoMovimentacao[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [descricao, setDescricao] = useState('')
  const [dataMovimentacao, setDataMovimentacao] = useState(todayIso())
  const [statusProcesso, setStatusProcesso] = useState(processo.status ?? '')
  const [observacoes, setObservacoes] = useState('')
  const [whatsappSendOpen, setWhatsappSendOpen] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [ultimaRegistradaAgora, setUltimaRegistradaAgora] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchJuridicoMovimentacoes(processo.id)
      setHistorico(res.movimentacoes)
      if (res.statusAtual) setStatusProcesso(res.statusAtual)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar histórico')
      setHistorico([])
    } finally {
      setLoading(false)
    }
  }, [processo.id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await registrarJuridicoMovimentacao(processo.id, {
        descricao,
        dataMovimentacao: dataMovimentacao || null,
        statusProcesso: statusProcesso.trim() || null,
        observacoes: observacoes.trim() || null,
      })
      setHistorico(res.movimentacoes)
      setDescricao('')
      setObservacoes('')
      setDataMovimentacao(todayIso())
      setUltimaRegistradaAgora(true)
      onAtualizado?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const ultima = historico[0]

  const textoWhatsApp = useMemo(() => {
    if (!ultima) return ''
    return buildJuridicoMovimentacaoWhatsAppText({
      processo,
      movimentacao: ultima,
      novaAtualizacao: ultimaRegistradaAgora,
    })
  }, [ultima, processo, ultimaRegistradaAgora])

  const copiarWhatsApp = async () => {
    if (!textoWhatsApp) return
    try {
      await navigator.clipboard.writeText(textoWhatsApp)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = textoWhatsApp
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopiado(true)
    window.setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <section className="rounded-xl border border-border-card bg-bg-app/40 p-3">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-accent-gold" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Movimentações
        </h3>
      </div>

      {ultima ? (
        <div className="mb-3 space-y-2">
          <p className="text-sm text-text-primary">
            <span className="text-[10px] font-medium uppercase text-text-secondary">Última: </span>
            {formatUltimaMovimentacaoExibicao(ultima.descricao, ultima.dataMovimentacao)}
          </p>
          {ultimaRegistradaAgora ? (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
              Movimentação salva. Você pode avisar o CEO pelo WhatsApp abaixo.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copiarWhatsApp()}
              disabled={!textoWhatsApp}
              className={cn(
                sidebarPrimaryCTAButtonClass(false),
                'text-xs',
                copiado && 'ring-2 ring-status-success/40 ring-offset-2 ring-offset-background'
              )}
              title="Copiar alerta formatado para WhatsApp"
            >
              {copiado ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-accent-gold" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5 shrink-0 text-accent-gold" aria-hidden />
              )}
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
            <button
              type="button"
              onClick={() => setWhatsappSendOpen(true)}
              disabled={!textoWhatsApp}
              className={cn(sidebarPrimaryCTAButtonClass(false), 'text-xs')}
              title="Enviar atualização ao CEO pelo WhatsApp"
            >
              <Send className="h-3.5 w-3.5 shrink-0 text-accent-gold" aria-hidden />
              Enviar ao CEO
            </button>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-xs text-text-secondary">
          Nenhum registro no histórico. A tabela usa a planilha até você registrar a primeira
          movimentação.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-2 border-b border-border-card pb-3">
        <label className="block text-[10px] font-medium uppercase text-text-secondary">
          Nova movimentação
        </label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required
          rows={2}
          placeholder="Ex.: CONCLUSOS PARA DECISÃO"
          className="w-full rounded-lg border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase text-text-secondary">
              Data
            </label>
            <input
              type="date"
              value={dataMovimentacao}
              onChange={(e) => setDataMovimentacao(e.target.value)}
              className="w-full rounded-lg border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase text-text-secondary">
              Status (opcional)
            </label>
            <input
              list="juridico-status-list"
              value={statusProcesso}
              onChange={(e) => setStatusProcesso(e.target.value)}
              placeholder={processo.status ?? 'Status do processo'}
              className="w-full rounded-lg border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary"
            />
            <datalist id="juridico-status-list">
              {statusOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>
        <input
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Observações internas (opcional)"
          className="w-full rounded-lg border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60"
        />
        {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={saving || !descricao.trim()}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg bg-accent-gold px-3 py-2 text-xs font-semibold text-bg-app',
            'hover:bg-accent-gold/90 disabled:opacity-50'
          )}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Registrar movimentação
        </button>
      </form>

      <div className="mt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
          Histórico ({historico.length})
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando…
          </div>
        ) : historico.length === 0 ? (
          <p className="text-xs text-text-secondary">Sem registros.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {historico.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-border-card/80 bg-bg-surface/60 px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-text-primary">
                    {m.dataMovimentacao ? formatDateShort(m.dataMovimentacao) : formatDateShort(m.createdAt.slice(0, 10))}
                  </span>
                  <span className="text-[10px] text-text-secondary">
                    {fonteLabel(m.fonte)}
                    {m.createdByName ? ` · ${m.createdByName}` : ''}
                  </span>
                </div>
                <p className="mt-1 text-text-primary">{m.descricao}</p>
                {m.statusProcesso ? (
                  <p className="mt-1 text-text-secondary">Status: {m.statusProcesso}</p>
                ) : null}
                {m.observacoes ? (
                  <p className="mt-1 text-text-secondary/90">{m.observacoes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <WhatsAppSendModal
        isOpen={whatsappSendOpen}
        onClose={() => {
          setWhatsappSendOpen(false)
          setUltimaRegistradaAgora(false)
        }}
        text={textoWhatsApp}
        source="juridico-movimentacao"
        cidade={processo.processo}
        preferCeoPhone
        title="Enviar atualização ao CEO"
        description="Confira a mensagem e confirme o telefone do CEO antes de enviar."
      />
    </section>
  )
}
