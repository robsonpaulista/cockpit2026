'use client'

import { useCallback, useState } from 'react'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import {
  tseBotaoContornoClass,
  tseBotaoNeutroClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseLinkAcaoClass,
  tseRotuloCampoClass,
  TseModal,
} from '@/components/tse/tse-ui'
import { corDoTipo, plural } from '@/components/monitoramento/radar-ui'
import {
  adicionarRadarTermo,
  atualizarRadarAtor,
  criarRadarAtor,
  removerRadarAtor,
  removerRadarTermo,
} from '@/lib/services/radar-eleitoral-client'
import { ACTOR_TYPE_OPTIONS, labelActorType } from '@/lib/youtube-radar-labels'
import { parseTermsInput } from '@/lib/youtube-radar-slug'
import type { PoliticalActorType, PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

interface RadarCandidatosModalProps {
  atores: PoliticalActorWithTerms[]
  onClose: () => void
  onAlterado: () => void
}

export function RadarCandidatosModal({ atores, onClose, onAlterado }: RadarCandidatosModalProps) {
  const [mostrarForm, setMostrarForm] = useState<boolean>(false)
  const [salvando, setSalvando] = useState<boolean>(false)
  const [erroForm, setErroForm] = useState<string>('')
  const [erro, setErro] = useState<string>('')
  const [nome, setNome] = useState<string>('')
  const [tipo, setTipo] = useState<PoliticalActorType>('competitor')
  const [termosTexto, setTermosTexto] = useState<string>('')
  const [novoTermo, setNovoTermo] = useState<Record<string, string>>({})
  const [instagram, setInstagram] = useState<Record<string, string>>({})
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)

  const executar = useCallback(
    async (id: string, acao: () => Promise<void>) => {
      setOcupadoId(id)
      setErro('')
      try {
        await acao()
        onAlterado()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
      } finally {
        setOcupadoId(null)
      }
    },
    [onAlterado],
  )

  const criar = async () => {
    setSalvando(true)
    setErroForm('')
    try {
      const terms = parseTermsInput(termosTexto)
      if (!nome.trim()) throw new Error('Informe o nome do candidato.')
      if (terms.length === 0) throw new Error('Informe ao menos um termo de busca.')
      await criarRadarAtor({ name: nome.trim(), actor_type: tipo, terms })
      setNome('')
      setTermosTexto('')
      setMostrarForm(false)
      onAlterado()
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const adicionarTermo = (ator: PoliticalActorWithTerms) => {
    const termo = (novoTermo[ator.id] ?? '').trim()
    if (!termo) return
    void executar(ator.id, async () => {
      await adicionarRadarTermo(ator.id, termo)
      setNovoTermo((prev) => ({ ...prev, [ator.id]: '' }))
    })
  }

  const salvarInstagram = (ator: PoliticalActorWithTerms) => {
    const valor = (instagram[ator.id] ?? ator.instagram_username ?? '').trim()
    void executar(ator.id, () => atualizarRadarAtor(ator.id, { instagram_username: valor || null }))
  }

  const remover = (ator: PoliticalActorWithTerms) => {
    if (!window.confirm(`Remover "${ator.name}" e todas as menções associadas?`)) return
    void executar(ator.id, () => removerRadarAtor(ator.id))
  }

  const ativos = atores.filter((a) => a.active).length

  return (
    <TseModal
      id="radar-candidatos-titulo"
      titulo="Candidatos monitorados"
      subtitulo={
        <>
          {plural(atores.length, 'cadastrado', 'cadastrados')} · {plural(ativos, 'ativo', 'ativos')} · os termos
          alimentam YouTube, Notícias, Anúncios e Buscas
        </>
      }
      onClose={onClose}
      rodape={
        <>
          {mostrarForm ? (
            <span />
          ) : (
            <button type="button" onClick={() => setMostrarForm(true)} className={cn(tseLinkAcaoClass, 'inline-flex items-center gap-1')}>
              <Plus className="h-4 w-4" /> Incluir candidato
            </button>
          )}
          <button type="button" onClick={onClose} className={tseBotaoContornoClass}>
            Fechar
          </button>
        </>
      }
    >
          {erro ? <p className="rounded-xl bg-white px-4 py-2.5 text-[13px] text-red-700 shadow-sm">{erro}</p> : null}

          {atores.map((ator) => {
            const ocupado = ocupadoId === ator.id
            const termos = [...(ator.youtube_search_terms ?? [])].sort((a, b) => a.priority - b.priority)
            return (
              <section key={ator.id} className={cn('rounded-xl bg-white p-4 shadow-sm', !ator.active && 'opacity-60')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-3 w-3 shrink-0" style={{ backgroundColor: corDoTipo(ator.actor_type) }} aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold">{ator.name}</p>
                      <p className="text-[11px] text-[var(--tse-muted)]">
                        {labelActorType(ator.actor_type)} · {ator.active ? 'ativo' : 'inativo'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ocupado ? <Loader2 className="h-4 w-4 animate-spin text-[var(--tse-yellow)]" /> : null}
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => void executar(ator.id, () => atualizarRadarAtor(ator.id, { active: !ator.active }))}
                      className={tseBotaoNeutroClass}
                    >
                      {ator.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => remover(ator)}
                      aria-label={`Remover ${ator.name}`}
                      className="rounded-md p-1.5 text-[var(--tse-muted)] hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {termos.length === 0 ? (
                    <span className="text-[12px] text-[var(--tse-muted)]">Sem termos de busca.</span>
                  ) : (
                    termos.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--tse-bar)] px-2.5 py-0.5 text-[12px] font-semibold"
                      >
                        {t.term}
                        <button
                          type="button"
                          disabled={ocupadoId === t.id}
                          onClick={() => void executar(t.id, () => removerRadarTermo(t.id))}
                          aria-label={`Remover termo ${t.term}`}
                          className="text-[var(--tse-muted)] hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="flex gap-2">
                    <input
                      value={novoTermo[ator.id] ?? ''}
                      onChange={(e) => setNovoTermo((prev) => ({ ...prev, [ator.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') adicionarTermo(ator)
                      }}
                      placeholder="Novo termo de busca…"
                      className={tseCampoClass}
                    />
                    <button type="button" disabled={ocupado} onClick={() => adicionarTermo(ator)} className={tseBotaoNeutroClass}>
                      Adicionar
                    </button>
                  </div>
                  {ator.actor_type === 'own_candidate' ? (
                    <p className="self-center text-[11px] text-[var(--tse-muted)]">
                      @ do candidato próprio vem da API do Instagram
                      {ator.instagram_username ? ` (atual: @${ator.instagram_username})` : ''}.
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={instagram[ator.id] ?? ator.instagram_username ?? ''}
                        onChange={(e) => setInstagram((prev) => ({ ...prev, [ator.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') salvarInstagram(ator)
                        }}
                        placeholder="@ Instagram (ex.: silviomendes)"
                        className={tseCampoClass}
                      />
                      <button type="button" disabled={ocupado} onClick={() => salvarInstagram(ator)} className={tseBotaoNeutroClass}>
                        Salvar @
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )
          })}

          {mostrarForm ? (
            <section className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-[14px] font-bold">Novo candidato</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={tseRotuloCampoClass}>Nome</span>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex.: Maria Silva"
                    className={tseCampoClass}
                  />
                </label>
                <label>
                  <span className={tseRotuloCampoClass}>Tipo</span>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as PoliticalActorType)}
                    className={tseCampoClass}
                  >
                    {ACTOR_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="mt-3 block">
                <span className={tseRotuloCampoClass}>Termos de busca (um por linha)</span>
                <textarea
                  value={termosTexto}
                  onChange={(e) => setTermosTexto(e.target.value)}
                  rows={3}
                  placeholder={'Maria Silva\nDeputada Maria'}
                  className={cn(tseCampoClass, 'h-auto py-2')}
                />
              </label>
              {erroForm ? <p className="mt-2 text-[12px] text-red-700">{erroForm}</p> : null}
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={salvando} onClick={() => void criar()} className={tseBotaoPrimarioClass}>
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Salvar candidato
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => {
                    setMostrarForm(false)
                    setErroForm('')
                  }}
                  className={tseBotaoNeutroClass}
                >
                  Cancelar
                </button>
              </div>
            </section>
          ) : null}
    </TseModal>
  )
}
