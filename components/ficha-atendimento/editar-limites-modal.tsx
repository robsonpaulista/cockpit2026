'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Loader2, Save } from 'lucide-react'
import {
  TseCarregando,
  TseErro,
  TseModal,
  tseBotaoCinzaClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseCardClass,
  tseLinkAcaoClass,
  tseRotuloCampoClass,
  tseTabela,
} from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'
import { MODALIDADE_LIMITE_LABEL, type ModalidadeLimite } from '@/lib/emenda-modalidade'
import { SUAS_FAIXAS_PADRAO, type SuasFaixaPorte } from '@/lib/limites-tetos-types'
import {
  fetchExercicioAtivo,
  fetchFaixasSuas,
  fetchLimitesMunicipio,
  importarLimitesJson,
  salvarExercicioAtivo,
  salvarFaixasSuas,
  salvarLimite,
} from '@/lib/services/ficha-atendimento-client'

const EXERCICIO_PADRAO = 2025

function parseInputMoney(s: string): number {
  const cleaned = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

function formatInputMoney(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type ValoresLimite = Record<'pap' | 'mac', Record<ModalidadeLimite, string>>

const LIMITES_VAZIOS: ValoresLimite = {
  pap: { individual: '', coletiva: '' },
  mac: { individual: '', coletiva: '' },
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={tseRotuloCampoClass}>{rotulo}</span>
      {children}
    </label>
  )
}

export function FichaAtendimentoEditarLimites({
  municipio,
  onClose,
  onSaved,
}: {
  municipio: string
  onClose: () => void
  onSaved: () => void
}) {
  const [loading, setLoading] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [importing, setImporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [exercicio, setExercicio] = useState<number>(0)
  const [exercicioGlobal, setExercicioGlobal] = useState<number>(EXERCICIO_PADRAO)
  const [limites, setLimites] = useState<ValoresLimite>(LIMITES_VAZIOS)
  const [faixas, setFaixas] = useState<SuasFaixaPorte[]>(SUAS_FAIXAS_PADRAO)

  const load = useCallback(async () => {
    if (!municipio) return
    setLoading(true)
    setError(null)
    try {
      const exAtivo = (await fetchExercicioAtivo().catch(() => null)) ?? EXERCICIO_PADRAO
      setExercicioGlobal(exAtivo)
      const exLoad = exercicio || exAtivo
      const [dados, faixasDb] = await Promise.all([
        fetchLimitesMunicipio(municipio, exLoad),
        fetchFaixasSuas(exLoad).catch(() => null),
      ])
      setExercicio(dados.exercicio ?? exLoad)
      setLimites({
        pap: {
          individual: formatInputMoney(dados.pap?.individual?.valor ?? null),
          coletiva: formatInputMoney(dados.pap?.coletiva?.valor ?? null),
        },
        mac: {
          individual: formatInputMoney(dados.mac?.individual?.valor ?? null),
          coletiva: formatInputMoney(dados.mac?.coletiva?.valor ?? null),
        },
      })
      setFaixas(faixasDb ?? dados.suas_faixas ?? SUAS_FAIXAS_PADRAO)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [municipio, exercicio])

  useEffect(() => {
    void load()
  }, [load])

  const alterarLimite = (tipo: 'pap' | 'mac', modalidade: ModalidadeLimite, valor: string) =>
    setLimites((prev) => ({ ...prev, [tipo]: { ...prev[tipo], [modalidade]: valor } }))

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await salvarExercicioAtivo(exercicioGlobal)
      for (const tipo of ['pap', 'mac'] as const) {
        for (const modalidade of ['individual', 'coletiva'] as const) {
          await salvarLimite({
            tipo,
            modalidade,
            exercicio,
            municipio,
            valor: parseInputMoney(limites[tipo][modalidade]),
          })
        }
      }
      await salvarFaixasSuas(exercicio, faixas)
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const importarJson = async () => {
    setImporting(true)
    setError(null)
    try {
      await importarLimitesJson(exercicio)
      await load()
      onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro na importação')
    } finally {
      setImporting(false)
    }
  }

  const updateFaixa = (index: number, field: 'porte' | 'populacao_max' | 'valor', value: string) => {
    setFaixas((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f
        if (field === 'porte') return { ...f, porte: value }
        if (field === 'populacao_max') return { ...f, populacao_max: value === '' ? null : parseInt(value, 10) }
        return { ...f, valor: parseInputMoney(value) }
      }),
    )
  }

  return (
    <TseModal
      id="editar-limites-titulo"
      titulo="Limites MAC, PAP e SUAS"
      subtitulo={municipio}
      onClose={onClose}
      largura="max-w-2xl"
      rodape={
        <>
          <button
            type="button"
            onClick={() => void importarJson()}
            disabled={importing || loading}
            className={cn(tseLinkAcaoClass, 'disabled:opacity-50')}
            title="Coletivas ficam em planilha separada"
          >
            {importing ? 'Importando…' : `Importar JSON individuais (${exercicio || '—'})`}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={tseBotaoCinzaClass}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || loading || !municipio}
              className={tseBotaoPrimarioClass}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </button>
          </div>
        </>
      }
    >
      {error ? <TseErro>{error}</TseErro> : null}

      {loading ? (
        <TseCarregando texto="Carregando limites…" className="min-h-[30vh]" />
      ) : (
        <>
          <section className={tseCardClass}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Exercício ativo (todos os usuários)">
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={exercicioGlobal}
                  onChange={(e) => setExercicioGlobal(parseInt(e.target.value, 10) || EXERCICIO_PADRAO)}
                  className={tseCampoClass}
                />
              </Campo>
              <Campo rotulo="Exercício desta edição">
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={exercicio}
                  onChange={(e) => setExercicio(parseInt(e.target.value, 10) || EXERCICIO_PADRAO)}
                  className={tseCampoClass}
                />
              </Campo>
            </div>
            <p className="mt-3 text-[12px] text-[var(--tse-muted)]">
              Tetos por modalidade (individual e coletiva) para o município no exercício indicado. As faixas SUAS são
              globais (por população) para todo o estado.
            </p>
          </section>

          {(['individual', 'coletiva'] as const).map((mod) => (
            <section key={mod} className={tseCardClass}>
              <h3 className="text-[14px] font-bold">Emendas {MODALIDADE_LIMITE_LABEL[mod]}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(['pap', 'mac'] as const).map((tipo) => (
                  <Campo key={tipo} rotulo={`Limite ${tipo.toUpperCase()} ${MODALIDADE_LIMITE_LABEL[mod]} (R$)`}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={limites[tipo][mod]}
                      onChange={(e) => alterarLimite(tipo, mod, e.target.value)}
                      placeholder="0,00"
                      className={cn(tseCampoClass, 'tabular-nums')}
                    />
                  </Campo>
                ))}
              </div>
            </section>
          ))}

          <section className={tseCardClass}>
            <h3 className="text-[14px] font-bold">Faixas SUAS por porte</h3>
            <div className={cn('mt-3', tseTabela.container, 'shadow-none ring-1 ring-[#EEEEEE]')}>
              <table className={tseTabela.table} data-tse-tabela>
                <thead className={tseTabela.thead}>
                  <tr>
                    <th className={tseTabela.th}>Até pop.</th>
                    <th className={tseTabela.th}>Porte</th>
                    <th className={cn(tseTabela.th, 'text-right')}>Teto (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {faixas.map((f, i) => (
                    <tr key={f.ordem} className={tseTabela.tr}>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          placeholder="∞"
                          value={f.populacao_max ?? ''}
                          onChange={(e) => updateFaixa(i, 'populacao_max', e.target.value)}
                          className={cn(tseCampoClass, 'w-28')}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={f.porte}
                          onChange={(e) => updateFaixa(i, 'porte', e.target.value)}
                          className={cn(tseCampoClass, 'min-w-[8rem]')}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formatInputMoney(f.valor)}
                          onChange={(e) => updateFaixa(i, 'valor', e.target.value)}
                          className={cn(tseCampoClass, 'ml-auto w-32 text-right tabular-nums')}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </TseModal>
  )
}
