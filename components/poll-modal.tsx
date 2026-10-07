'use client'

import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Save } from 'lucide-react'
import { TseErro, TseModal, tseBotaoCinzaClass, tseBotaoPrimarioClass, tseCampoClass, tseRotuloCampoClass } from '@/components/tse/tse-ui'
import {
  CARGO_PESQUISA_LABEL,
  TIPO_PESQUISA_LABEL,
  salvarPesquisa,
  type CargoPesquisa,
  type CidadePesquisa,
  type Pesquisa,
  type PesquisaForm,
  type TipoPesquisa,
} from '@/lib/services/pesquisa-client'

interface PollModalProps {
  poll: Pesquisa | null
  cidades: CidadePesquisa[]
  candidatos: string[]
  onClose: () => void
  onUpdate: (options?: { silent?: boolean }) => void | Promise<void>
}

const FORM_ID = 'poll-modal-form'

function formInicial(poll: Pesquisa | null): PesquisaForm {
  if (poll) {
    return {
      data: poll.data?.split('T')[0] ?? '',
      instituto: poll.instituto,
      candidato_nome: poll.candidato_nome,
      tipo: poll.tipo,
      cargo: poll.cargo,
      cidade_id: poll.cidade_id ?? null,
      intencao: poll.intencao,
      rejeicao: poll.rejeicao,
    }
  }
  return {
    data: new Date().toISOString().split('T')[0],
    instituto: '',
    candidato_nome: '',
    tipo: 'estimulada',
    cargo: 'dep_estadual',
    cidade_id: null,
    intencao: 0,
    rejeicao: 0,
  }
}

export function PollModal({ poll, cidades, candidatos, onClose, onUpdate }: PollModalProps) {
  const editando = Boolean(poll?.id)
  const [form, setForm] = useState<PesquisaForm>(() => formInicial(poll))
  const [buscaCidade, setBuscaCidade] = useState<string>('')
  const [salvando, setSalvando] = useState<boolean>(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvasNaSessao, setSalvasNaSessao] = useState<number>(0)
  const candidatoInputRef = useRef<HTMLInputElement | null>(null)

  const cidadesFiltradas = useMemo(() => {
    const q = buscaCidade.trim().toLowerCase()
    if (!q) return cidades
    const filtradas = cidades.filter((c) => c.name.toLowerCase().includes(q))
    return filtradas.length > 0 ? filtradas : cidades
  }, [cidades, buscaCidade])

  const atualizar = <K extends keyof PesquisaForm>(campo: K, valor: PesquisaForm[K]) =>
    setForm((prev) => ({ ...prev, [campo]: valor }))

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      await salvarPesquisa(form, poll?.id)
      await onUpdate({ silent: !editando })
      if (editando) {
        onClose()
        return
      }
      setSalvasNaSessao((n) => n + 1)
      setForm((prev) => ({ ...prev, candidato_nome: '', intencao: 0, rejeicao: 0 }))
      setTimeout(() => candidatoInputRef.current?.focus(), 0)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar pesquisa.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <TseModal
      id="poll-modal-titulo"
      titulo={editando ? 'Editar pesquisa' : 'Nova pesquisa'}
      subtitulo={
        editando
          ? 'Altere os dados e salve.'
          : salvasNaSessao > 0
            ? `${salvasNaSessao} ${salvasNaSessao === 1 ? 'registro salvo' : 'registros salvos'} · data, instituto, município, tipo e cargo são mantidos para o próximo candidato`
            : 'Cadastre um candidato por vez; data, instituto e município ficam preenchidos para o próximo.'
      }
      onClose={onClose}
      largura="max-w-2xl"
      rodape={
        <>
          <button type="button" onClick={onClose} className={tseBotaoCinzaClass}>
            {editando ? 'Cancelar' : 'Concluir'}
          </button>
          <button type="submit" form={FORM_ID} disabled={salvando} className={tseBotaoPrimarioClass}>
            <Save className="h-4 w-4" aria-hidden />
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar e adicionar outro'}
          </button>
        </>
      }
    >
      {erro ? <TseErro>{erro}</TseErro> : null}
      <form id={FORM_ID} onSubmit={(e) => void enviar(e)} className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={tseRotuloCampoClass}>Data *</span>
            <input
              type="date"
              value={form.data}
              onChange={(e) => atualizar('data', e.target.value)}
              required
              className={tseCampoClass}
            />
          </label>
          <label className="block">
            <span className={tseRotuloCampoClass}>Instituto *</span>
            <input
              type="text"
              value={form.instituto}
              onChange={(e) => atualizar('instituto', e.target.value)}
              placeholder="Nome do instituto"
              required
              className={tseCampoClass}
            />
          </label>
        </div>

        <label className="block">
          <span className={tseRotuloCampoClass}>Candidato *</span>
          <input
            type="text"
            list="poll-modal-candidatos"
            ref={candidatoInputRef}
            value={form.candidato_nome}
            onChange={(e) => atualizar('candidato_nome', e.target.value)}
            placeholder="Digite ou selecione um candidato existente"
            required
            className={tseCampoClass}
          />
          <datalist id="poll-modal-candidatos">
            {candidatos.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {candidatos.length > 0 ? (
            <span className="mt-1 block text-[11px] text-[var(--tse-muted)]">
              {candidatos.length} {candidatos.length === 1 ? 'candidato cadastrado' : 'candidatos cadastrados'} · selecione
              ou digite um novo nome
            </span>
          ) : null}
        </label>

        <div>
          <span className={tseRotuloCampoClass}>Município (Piauí)</span>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <input
              type="text"
              value={buscaCidade}
              onChange={(e) => setBuscaCidade(e.target.value)}
              placeholder="Filtrar municípios…"
              aria-label="Filtrar municípios"
              className={tseCampoClass}
            />
            <select
              value={form.cidade_id || ''}
              onChange={(e) => atualizar('cidade_id', e.target.value || null)}
              className={tseCampoClass}
              disabled={cidades.length === 0}
            >
              <option value="">{cidades.length === 0 ? 'Carregando municípios…' : 'Estado (sem município)'}</option>
              {cidadesFiltradas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {cidades.length > 0 ? (
            <span className="mt-1 block text-[11px] text-[var(--tse-muted)]">
              {cidadesFiltradas.length === cidades.length
                ? `${cidades.length} municípios disponíveis`
                : `${cidadesFiltradas.length} de ${cidades.length} municípios`}
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={tseRotuloCampoClass}>Tipo *</span>
            <select
              value={form.tipo}
              onChange={(e) => atualizar('tipo', e.target.value as TipoPesquisa)}
              required
              className={tseCampoClass}
            >
              {(Object.keys(TIPO_PESQUISA_LABEL) as TipoPesquisa[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_PESQUISA_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={tseRotuloCampoClass}>Cargo *</span>
            <select
              value={form.cargo}
              onChange={(e) => atualizar('cargo', e.target.value as CargoPesquisa)}
              required
              className={tseCampoClass}
            >
              {(Object.keys(CARGO_PESQUISA_LABEL) as CargoPesquisa[]).map((c) => (
                <option key={c} value={c}>
                  {CARGO_PESQUISA_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={tseRotuloCampoClass}>Intenção (%) *</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.intencao}
              onChange={(e) => atualizar('intencao', parseFloat(e.target.value) || 0)}
              required
              className={tseCampoClass}
            />
          </label>
          <label className="block">
            <span className={tseRotuloCampoClass}>Rejeição (%) *</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.rejeicao}
              onChange={(e) => atualizar('rejeicao', parseFloat(e.target.value) || 0)}
              required
              className={tseCampoClass}
            />
          </label>
        </div>
      </form>
    </TseModal>
  )
}
