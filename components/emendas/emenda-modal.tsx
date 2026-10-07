'use client'

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Loader2, Save } from 'lucide-react'
import {
  TseErro,
  TseModal,
  tseBotaoCinzaClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseRotuloCampoClass,
} from '@/components/tse/tse-ui'
import { fetchCidadesPesquisa, type CidadePesquisa } from '@/lib/services/pesquisa-client'
import { salvarEmenda, type Emenda, type EmendaForm } from '@/lib/services/emendas-client'
import { cn } from '@/lib/utils'

export type EmendaModalModo = { tipo: 'nova' } | { tipo: 'editar'; emenda: Emenda } | { tipo: 'duplicar'; emenda: Emenda }

const FORM_ID = 'emenda-modal-form'

function formVazio(): EmendaForm {
  return {
    bloco: '',
    exercicio: '',
    emenda: '',
    municipio_beneficiario: '',
    funcional: '',
    gnd: '',
    valor_indicado: '',
    valor_empenhado: '',
    valor_a_empenhar: '',
    valor_pago: '',
    valor_a_ser_pago: '',
    empenho: '',
    data_empenho: '',
    portaria_convenio: '',
    numero_proposta: '',
    data_pagamento: '',
    liderancas: '',
    alteracao: '',
    objeto: '',
  }
}

/** A API lê "." como separador de milhar: o decimal precisa ir com vírgula. */
function valorParaCampo(v: number | null | undefined): string {
  return v != null && Number.isFinite(Number(v)) ? String(v).replace('.', ',') : ''
}

function emendaParaForm(e: Emenda): EmendaForm {
  return {
    bloco: e.bloco ?? '',
    exercicio: e.exercicio != null && Number.isFinite(Number(e.exercicio)) ? String(e.exercicio) : '',
    emenda: e.emenda ?? '',
    municipio_beneficiario: e.municipio_beneficiario ?? '',
    funcional: e.funcional ?? '',
    gnd: e.gnd ?? '',
    valor_indicado: valorParaCampo(e.valor_indicado),
    valor_empenhado: valorParaCampo(e.valor_empenhado),
    valor_a_empenhar: valorParaCampo(e.valor_a_empenhar),
    valor_pago: valorParaCampo(e.valor_pago),
    valor_a_ser_pago: valorParaCampo(e.valor_a_ser_pago),
    empenho: e.empenho ?? '',
    data_empenho: e.data_empenho?.slice(0, 10) ?? '',
    portaria_convenio: e.portaria_convenio ?? '',
    numero_proposta: e.numero_proposta ?? '',
    data_pagamento: e.data_pagamento?.slice(0, 10) ?? '',
    liderancas: e.liderancas ?? '',
    alteracao: e.alteracao ?? '',
    objeto: e.objeto ?? '',
  }
}

function Secao({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h3 className="text-[14px] font-bold">{titulo}</h3>
      <div className={cn('mt-3 grid gap-3', className)}>{children}</div>
    </section>
  )
}

function Campo({ rotulo, className, children }: { rotulo: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn('block', className)}>
      <span className={tseRotuloCampoClass}>{rotulo}</span>
      {children}
    </label>
  )
}

const TITULO: Record<EmendaModalModo['tipo'], string> = {
  nova: 'Nova emenda',
  editar: 'Editar emenda',
  duplicar: 'Duplicar emenda',
}

export function EmendaModal({
  modo,
  onClose,
  onSalva,
}: {
  modo: EmendaModalModo
  onClose: () => void
  onSalva: () => void | Promise<void>
}) {
  const [form, setForm] = useState<EmendaForm>(() => (modo.tipo === 'nova' ? formVazio() : emendaParaForm(modo.emenda)))
  const [cidades, setCidades] = useState<CidadePesquisa[]>([])
  const [carregandoCidades, setCarregandoCidades] = useState<boolean>(true)
  const [buscaCidade, setBuscaCidade] = useState<string>('')
  const [salvando, setSalvando] = useState<boolean>(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    fetchCidadesPesquisa({ sincronizarSeVazio: true })
      .then((lista) => {
        if (!cancelado) setCidades(lista)
      })
      .catch(() => {
        if (!cancelado) setCidades([])
      })
      .finally(() => {
        if (!cancelado) setCarregandoCidades(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  const cidadesFiltradas = useMemo(() => {
    const q = buscaCidade.trim().toLowerCase()
    if (!q) return cidades
    const filtradas = cidades.filter((c) => c.name.toLowerCase().includes(q))
    return filtradas.length > 0 ? filtradas : cidades
  }, [cidades, buscaCidade])

  const cidadeSelecionadaId = cidades.find((c) => c.name.trim() === form.municipio_beneficiario.trim())?.id ?? ''

  const campo = (k: keyof EmendaForm) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm((prev) => ({ ...prev, [k]: e.target.value })),
  })

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.emenda.trim()) {
      setErro('Preencha o campo Emenda.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      await salvarEmenda(form, modo.tipo === 'editar' ? modo.emenda.id : null)
      await onSalva()
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar emenda.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <TseModal
      id="emenda-modal-titulo"
      titulo={TITULO[modo.tipo]}
      subtitulo={
        modo.tipo === 'duplicar'
          ? 'Os dados da emenda original já vêm preenchidos; ao salvar, um novo registro é criado.'
          : 'Valores em reais, com vírgula para centavos (ex.: 150000,50).'
      }
      onClose={onClose}
      largura="max-w-4xl"
      rodape={
        <>
          <button type="button" onClick={onClose} className={tseBotaoCinzaClass}>
            Cancelar
          </button>
          <button type="submit" form={FORM_ID} disabled={salvando} className={cn(tseBotaoPrimarioClass, 'min-w-[120px]')}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            Salvar
          </button>
        </>
      }
    >
      {erro ? <TseErro>{erro}</TseErro> : null}
      <form id={FORM_ID} onSubmit={(e) => void enviar(e)} className="space-y-3">
        <Secao titulo="Identificação" className="sm:grid-cols-2 lg:grid-cols-6">
          <Campo rotulo="Emenda *" className="sm:col-span-2 lg:col-span-3">
            <input {...campo('emenda')} required className={tseCampoClass} />
          </Campo>
          <Campo rotulo="Exercício">
            <input
              type="number"
              min={1900}
              max={2100}
              step={1}
              inputMode="numeric"
              placeholder="Ano"
              {...campo('exercicio')}
              className={tseCampoClass}
            />
          </Campo>
          <Campo rotulo="Bloco" className="lg:col-span-2">
            <input {...campo('bloco')} className={tseCampoClass} />
          </Campo>
          <Campo rotulo="Funcional" className="lg:col-span-3">
            <input {...campo('funcional')} className={tseCampoClass} />
          </Campo>
          <Campo rotulo="GND" className="lg:col-span-3">
            <input {...campo('gnd')} className={tseCampoClass} />
          </Campo>
        </Secao>

        <Secao titulo="Município / beneficiário" className="lg:grid-cols-2">
          <Campo rotulo="Beneficiário">
            <input
              type="text"
              {...campo('municipio_beneficiario')}
              placeholder="Ex.: Teresina, SESAPI, Secretaria Municipal de Saúde…"
              autoComplete="off"
              className={tseCampoClass}
            />
            <span className="mt-1 block text-[11px] text-[var(--tse-muted)]">
              Um dos 224 municípios do Piauí ou o nome de um órgão, secretaria ou outro beneficiário.
            </span>
          </Campo>
          <div>
            <span className={tseRotuloCampoClass}>Atalho: escolher município</span>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={buscaCidade}
                onChange={(e) => setBuscaCidade(e.target.value)}
                placeholder="Filtrar municípios…"
                aria-label="Filtrar municípios"
                autoComplete="off"
                className={tseCampoClass}
                disabled={carregandoCidades}
              />
              <select
                value={cidadeSelecionadaId}
                onChange={(e) => {
                  const cidade = cidades.find((c) => c.id === e.target.value)
                  if (cidade) setForm((prev) => ({ ...prev, municipio_beneficiario: cidade.name.trim() }))
                }}
                aria-label="Município do Piauí"
                className={tseCampoClass}
                disabled={carregandoCidades}
              >
                <option value="">{carregandoCidades ? 'Carregando municípios…' : 'Selecione…'}</option>
                {cidadesFiltradas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <span className="mt-1 block text-[11px] text-[var(--tse-muted)]">A escolha copia o nome para o beneficiário.</span>
          </div>
        </Secao>

        <Secao titulo="Valores (R$)" className="sm:grid-cols-2 lg:grid-cols-5">
          <Campo rotulo="Indicado">
            <input type="text" inputMode="decimal" {...campo('valor_indicado')} className={tseCampoClass} />
          </Campo>
          <Campo rotulo="Empenhado">
            <input type="text" inputMode="decimal" {...campo('valor_empenhado')} className={tseCampoClass} />
          </Campo>
          <Campo rotulo="A empenhar">
            <input type="text" inputMode="decimal" {...campo('valor_a_empenhar')} className={tseCampoClass} />
          </Campo>
          <Campo rotulo="Pago">
            <input type="text" inputMode="decimal" {...campo('valor_pago')} className={tseCampoClass} />
          </Campo>
          <Campo rotulo="A ser pago">
            <input type="text" inputMode="decimal" {...campo('valor_a_ser_pago')} className={tseCampoClass} />
          </Campo>
        </Secao>

        <Secao titulo="Execução" className="sm:grid-cols-2 lg:grid-cols-5">
          <Campo rotulo="Empenho">
            <input {...campo('empenho')} className={tseCampoClass} />
          </Campo>
          <Campo rotulo="Data do empenho">
            <input type="date" {...campo('data_empenho')} className={tseCampoClass} />
          </Campo>
          <Campo rotulo="Portaria / convênio">
            <input {...campo('portaria_convenio')} className={tseCampoClass} />
          </Campo>
          <Campo rotulo="Nº da proposta">
            <input {...campo('numero_proposta')} className={tseCampoClass} />
          </Campo>
          <Campo rotulo="Data do pagamento">
            <input type="date" {...campo('data_pagamento')} className={tseCampoClass} />
          </Campo>
        </Secao>

        <Secao titulo="Acompanhamento" className="lg:grid-cols-2">
          <Campo rotulo="Lideranças">
            <input {...campo('liderancas')} className={tseCampoClass} />
          </Campo>
          <Campo rotulo="Alteração">
            <input {...campo('alteracao')} className={tseCampoClass} />
          </Campo>
          <Campo rotulo="Objeto" className="lg:col-span-2">
            <textarea rows={4} {...campo('objeto')} className={cn(tseCampoClass, 'h-auto resize-y py-2')} />
          </Campo>
        </Secao>
      </form>
    </TseModal>
  )
}
