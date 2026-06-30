'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ClipboardList, Download, FileSpreadsheet } from 'lucide-react'
import type { LocalMapaPlano } from '@/lib/eleitorado-locais-pi'
import type { PlanoAmostragemPublico } from '@/lib/plano-amostragem-publico-types'
import { montarRoteiroCampo, type ContextoRoteiroCampo } from '@/lib/plano-amostragem-campo'
import {
  exportarRoteiroCampoExcel,
  exportarRoteiroCampoPdf,
} from '@/lib/plano-amostragem-campo-export'
import type { SetorMapaPlano } from '@/lib/setores-censitarios-pi'

type PlanoCampoRoteiroSectionProps = {
  plano: PlanoAmostragemPublico
  locais?: LocalMapaPlano[]
  setores?: SetorMapaPlano[]
  usarSetoresIbge?: boolean
}

export function PlanoCampoRoteiroSection({
  plano,
  locais = [],
  setores = [],
  usarSetoresIbge = false,
}: PlanoCampoRoteiroSectionProps) {
  const ctx: ContextoRoteiroCampo = useMemo(
    () => ({ locais, setores, usarSetoresIbge }),
    [locais, setores, usarSetoresIbge],
  )
  const roteiro = useMemo(() => montarRoteiroCampo(plano, ctx), [plano, ctx])
  const [expandido, setExpandido] = useState<boolean>(true)
  const [entrevistadorAberto, setEntrevistadorAberto] = useState<number | null>(
    roteiro.plano.equipeCampo[0]?.entrevistador ?? null,
  )
  const [exportBusy, setExportBusy] = useState<'idle' | 'xlsx' | 'pdf'>('idle')

  const fontePontos = usarSetoresIbge ? 'setores IBGE' : 'locais TSE'

  return (
    <section className="rounded-xl border border-card bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
            <ClipboardList className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Roteiro de campo (Fase D)</h3>
            <p className="mt-1 text-xs text-secondary leading-relaxed">
              {roteiro.totalEntrevistadores} entrevistador(es) · {roteiro.fichas.length} fichas ·
              destinos por {fontePontos} · monitor de cotas incluído no export
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setExportBusy('xlsx')
              try {
                exportarRoteiroCampoExcel(plano, ctx)
              } finally {
                setExportBusy('idle')
              }
            }}
            disabled={exportBusy !== 'idle'}
            className="inline-flex items-center gap-2 rounded-lg border border-card bg-background px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Excel campo
          </button>
          <button
            type="button"
            onClick={() => {
              setExportBusy('pdf')
              try {
                exportarRoteiroCampoPdf(plano, ctx)
              } finally {
                setExportBusy('idle')
              }
            }}
            disabled={exportBusy !== 'idle'}
            className="inline-flex items-center gap-2 rounded-lg border border-card bg-background px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface"
          >
            <Download className="h-4 w-4" aria-hidden />
            PDF por entrevistador
          </button>
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-card px-3 py-2 text-sm text-secondary"
          >
            {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expandido ? 'Recolher' : 'Expandir'}
          </button>
        </div>
      </div>

      {expandido ? (
        <div className="mt-4 flex flex-col gap-4">
          {!roteiro.validacao.ok ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              <p className="font-semibold">Validação do roteiro — revisar antes do campo</p>
              <ul className="mt-1 list-inside list-disc">
                {roteiro.validacao.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="rounded-lg border border-card bg-background/50 p-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Monitor de cotas (meta)
            </h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <ListaCotas titulo="Sexo" itens={plano.cotasSexo} />
              <ListaCotas titulo="Idade" itens={plano.cotasIdade} />
              <ListaCotas titulo="Horário" itens={plano.cotasHorario} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {plano.equipeCampo.map((membro) => {
              const fichas = roteiro.fichas.filter((f) => f.entrevistador === membro.entrevistador)
              const aberto = entrevistadorAberto === membro.entrevistador
              return (
                <div key={membro.entrevistador} className="rounded-lg border border-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setEntrevistadorAberto(aberto ? null : membro.entrevistador)
                    }
                    className="flex w-full items-center justify-between gap-2 bg-background/60 px-3 py-2.5 text-left text-sm hover:bg-background"
                  >
                    <span className="font-medium text-text-primary">
                      Entrevistador {membro.entrevistador} — {membro.entrevistas} entrevistas
                    </span>
                    {aberto ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-secondary" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-secondary" />
                    )}
                  </button>
                  {aberto ? (
                    <div className="border-t border-card px-3 py-2">
                      <p className="mb-2 text-xs text-secondary">{membro.blocosSugeridos}</p>
                      <ul className="space-y-2 text-xs text-text-primary">
                        {fichas.map((f) => (
                          <li key={f.id} className="border-b border-card/50 pb-2">
                            <div className="flex justify-between gap-2">
                              <span className="font-medium">
                                Ficha {f.sequencia} · {f.id}
                              </span>
                              <span className="text-secondary capitalize">{f.tipoBloco}</span>
                            </div>
                            <p className="mt-0.5 text-text-primary">
                              <span className="text-text-muted">Bloco:</span> {f.blocoSugerido}
                            </p>
                            <p className="mt-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                              → {f.localCampo}
                              {f.bairroRecorte ? ` (${f.bairroRecorte})` : ''}
                            </p>
                            {f.enderecoSugerido ? (
                              <p className="mt-0.5 text-secondary">{f.enderecoSugerido}</p>
                            ) : null}
                            {f.latitudeSugerida != null && f.longitudeSugerida != null ? (
                              <p className="mt-0.5 text-[10px] text-text-muted">
                                GPS: {f.latitudeSugerida.toFixed(5)}, {f.longitudeSugerida.toFixed(5)}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <p className="text-[11px] text-secondary leading-relaxed">
            Cada ficha indica o destino concreto dentro do bloco (local de votação TSE ou setor
            censitário IBGE). A aba &quot;Guia pontos&quot; no Excel lista todos os pontos de referência.
          </p>
        </div>
      ) : null}
    </section>
  )
}

function ListaCotas({
  titulo,
  itens,
}: {
  titulo: string
  itens: PlanoAmostragemPublico['cotasSexo']
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-text-primary">{titulo}</p>
      <ul className="space-y-0.5 text-xs text-secondary">
        {itens.map((c) => (
          <li key={c.perfil} className="flex justify-between">
            <span>{c.perfil}</span>
            <span>
              {c.meta} <span className="text-text-muted">({c.pct}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
