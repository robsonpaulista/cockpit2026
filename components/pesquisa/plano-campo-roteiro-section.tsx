'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Download, FileSpreadsheet } from 'lucide-react'
import type { LocalMapaPlano } from '@/lib/eleitorado-locais-pi'
import type { PlanoAmostragemPublico } from '@/lib/plano-amostragem-publico-types'
import {
  montarRoteiroCampo,
  type ChecklistMetodologicoItem,
  type ContextoRoteiroCampo,
} from '@/lib/plano-amostragem-campo'
import {
  exportarRoteiroCampoExcel,
  exportarRoteiroCampoPdf,
} from '@/lib/plano-amostragem-campo-export'
import type { SetorMapaPlano } from '@/lib/setores-censitarios-pi'
import { tseBotaoCinzaClass, tseBotaoIconeClass, tseCardClass } from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'

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
    <section className={tseCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div>
            <h3 className="text-[15px] font-bold">Roteiro de campo (Fase D)</h3>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--tse-muted)]">
              {roteiro.totalEntrevistadores} entrevistador(es) · {roteiro.fichas.length} fichas ·
              destinos por {fontePontos} · monitor de cotas incluído no export
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 lg:w-auto">
          <ChecklistMetodologico checklist={roteiro.validacao.checklist} />
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
            className={tseBotaoCinzaClass}
          >
            <FileSpreadsheet className={tseBotaoIconeClass} aria-hidden />
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
            className={tseBotaoCinzaClass}
          >
            <Download className={tseBotaoIconeClass} aria-hidden />
            PDF por entrevistador
          </button>
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className={tseBotaoCinzaClass}
          >
            {expandido ? <ChevronUp className={tseBotaoIconeClass} /> : <ChevronDown className={tseBotaoIconeClass} />}
            {expandido ? 'Recolher' : 'Expandir'}
          </button>
          </div>
        </div>
      </div>

      {expandido ? (
        <div className="mt-4 flex flex-col gap-4">
          {!roteiro.validacao.ok && roteiro.validacao.avisos.length > 0 ? (
            <div className="rounded-lg bg-[var(--tse-yellow-soft)] px-3 py-2 text-[12px]">
              <p className="font-bold">Validação do roteiro — revisar antes do campo</p>
              <ul className="mt-1 list-inside list-disc">
                {roteiro.validacao.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="rounded-lg bg-[var(--tse-bar)] p-3">
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
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
                <div key={membro.entrevistador} className="overflow-hidden rounded-lg border border-[#EEEEEE]">
                  <button
                    type="button"
                    onClick={() =>
                      setEntrevistadorAberto(aberto ? null : membro.entrevistador)
                    }
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] hover:bg-[var(--tse-bar)]',
                      aberto && 'bg-[var(--tse-yellow-soft)] hover:bg-[var(--tse-yellow-soft)]',
                    )}
                  >
                    <span className="font-bold">
                      Entrevistador {membro.entrevistador} — {membro.entrevistas} entrevistas
                    </span>
                    {aberto ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-[var(--tse-gold-text)]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-[var(--tse-muted)]" />
                    )}
                  </button>
                  {aberto ? (
                    <div className="border-t border-[#EEEEEE] px-3 py-2">
                      <p className="mb-2 text-[12px] text-[var(--tse-muted)]">{membro.blocosSugeridos}</p>
                      <ul className="space-y-2 text-[12px]">
                        {fichas.map((f) => (
                          <li key={f.id} className="border-b border-[#EEEEEE] pb-2 last:border-0">
                            <div className="flex justify-between gap-2">
                              <span className="font-bold">
                                Ficha {f.sequenciaEntrevistador} (global {f.sequencia}) · {f.id}
                              </span>
                              <span className="capitalize text-[var(--tse-muted)]">{f.tipoBloco}</span>
                            </div>
                            <p className="mt-0.5 text-[var(--tse-muted)]">
                              Turno recomendado: <span className="font-bold text-[var(--tse-text)]">{f.turnoRecomendado}</span>
                            </p>
                            <p className="mt-0.5">
                              <span className="text-[var(--tse-muted)]">Bloco:</span> {f.blocoSugerido}
                            </p>
                            <p className="mt-0.5 font-bold text-[var(--tse-olive)]">
                              → {f.localCampo}
                              {f.bairroRecorte ? ` (${f.bairroRecorte})` : ''}
                            </p>
                            {f.enderecoSugerido ? (
                              <p className="mt-0.5 text-[var(--tse-muted)]">{f.enderecoSugerido}</p>
                            ) : null}
                            {f.latitudeSugerida != null && f.longitudeSugerida != null ? (
                              <p className="mt-0.5 text-[10px] text-[var(--tse-muted)]">
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

          <p className="text-[11px] leading-relaxed text-[var(--tse-muted)]">
            Cada ficha indica o destino concreto dentro do bloco (local de votação TSE ou setor
            censitário IBGE). A aba &quot;Guia pontos&quot; no Excel lista todos os pontos de referência.
          </p>
        </div>
      ) : null}
    </section>
  )
}

function ChecklistMetodologico({ checklist }: { checklist: ChecklistMetodologicoItem[] }) {
  if (checklist.length === 0) return null
  return (
    <div className="w-full rounded-lg bg-[var(--tse-bar)] p-3 lg:min-w-[280px]">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
        Checklist metodológico
      </p>
      <ul className="space-y-1.5 text-[12px]">
        {checklist.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            {item.status === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tse-olive)]" aria-hidden />
            ) : (
              <AlertTriangle
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.status === 'error' ? 'text-red-700' : 'text-[var(--tse-gold-text)]'}`}
                aria-hidden
              />
            )}
            <span>
              {item.label}
              {item.detalhe ? (
                <span className="text-[var(--tse-muted)]"> — {item.detalhe}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
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
      <p className="mb-1 text-[12px] font-bold">{titulo}</p>
      <ul className="space-y-0.5 text-[12px] text-[var(--tse-muted)]">
        {itens.map((c) => (
          <li key={c.perfil} className="flex justify-between">
            <span>{c.perfil}</span>
            <span>
              <span className="font-bold text-[var(--tse-text)]">{c.meta}</span> ({c.pct}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
