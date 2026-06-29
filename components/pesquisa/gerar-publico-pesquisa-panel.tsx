'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download, FileSpreadsheet, Loader2, MapPin, Users } from 'lucide-react'
import type { PlanoAmostragemPublico } from '@/lib/plano-amostragem-publico-types'
import type { LocalMapaPlano } from '@/lib/eleitorado-locais-pi'
import type { SetorMapaPlano } from '@/lib/setores-censitarios-pi'
import type { CamadaMapaPlano } from '@/components/pesquisa/mapa-plano-amostragem'
import {
  exportarPlanoAmostragemExcel,
  exportarPlanoAmostragemPdf,
} from '@/lib/plano-amostragem-publico-export'
import { PlanoCampoRoteiroSection } from '@/components/pesquisa/plano-campo-roteiro-section'
import { sugerirEntrevistadores } from '@/lib/plano-amostragem-publico'

const MapaPlanoAmostragem = dynamic(
  () => import('./mapa-plano-amostragem').then((m) => m.MapaPlanoAmostragem),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-lg border border-card bg-background/50 text-sm text-secondary">
        Carregando mapa…
      </div>
    ),
  },
)

type TipoPesquisaForm = 'opiniao' | 'eleitoral'

type MunicipioOption = {
  municipio: string
  codigoIbge: string
  populacao: number
}

type PlanoResponse = {
  plano: PlanoAmostragemPublico
  locais: LocalMapaPlano[]
  setores: SetorMapaPlano[]
  meta: {
    bairrosEncontrados: number
    fonteBairros: string | null
    locaisComGeo: number
    setoresIbge: number
    fonteSetores: string | null
    pesoTerritorial: 'populacao_ibge' | 'eleitorado_tse'
    camadaMapa: CamadaMapaPlano
    modoSetoresPlano: boolean
    mapaReferenciaIbge: boolean
    pesoPorEleitores: boolean
    eleitoradoUrbanoTse: number
    eleitoradoRuralTse: number
    populacaoUrbanaSetor: number
    populacaoRuralSetor: number
  }
}

const OPCOES_N = [400, 500, 600] as const

export function GerarPublicoPesquisaPanel() {
  const [municipios, setMunicipios] = useState<MunicipioOption[]>([])
  const [municipio, setMunicipio] = useState<string>('')
  const [amostra, setAmostra] = useState<number>(500)
  const [tipo, setTipo] = useState<TipoPesquisaForm>('opiniao')
  const [instituto, setInstituto] = useState<string>('')
  const [entrevistadores, setEntrevistadores] = useState<number>(() => sugerirEntrevistadores(500))
  const [plano, setPlano] = useState<PlanoAmostragemPublico | null>(null)
  const [locais, setLocais] = useState<LocalMapaPlano[]>([])
  const [setores, setSetores] = useState<SetorMapaPlano[]>([])
  const [meta, setMeta] = useState<PlanoResponse['meta'] | null>(null)
  const [loadingLista, setLoadingLista] = useState<boolean>(true)
  const [loadingPlano, setLoadingPlano] = useState<boolean>(false)
  const [erro, setErro] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState<'idle' | 'xlsx' | 'pdf'>('idle')

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      setLoadingLista(true)
      try {
        const res = await fetch('/api/pesquisa/plano-amostragem?list=municipios')
        if (!res.ok) throw new Error('Falha ao carregar municípios')
        const json = (await res.json()) as { municipios: MunicipioOption[] }
        if (!cancelado) {
          setMunicipios(json.municipios ?? [])
          if (json.municipios?.length) {
            setMunicipio((prev) => prev || json.municipios[0].municipio)
          }
        }
      } catch (e) {
        if (!cancelado) {
          setErro(e instanceof Error ? e.message : 'Erro ao carregar municípios')
        }
      } finally {
        if (!cancelado) setLoadingLista(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    setEntrevistadores(sugerirEntrevistadores(amostra))
  }, [amostra])

  const entrevistasPorEntrevistador = useMemo(() => {
    const n = Math.max(1, entrevistadores)
    const base = Math.floor(amostra / n)
    const resto = amostra % n
    return resto > 0 ? `${base}–${base + 1}` : String(base)
  }, [amostra, entrevistadores])

  const municipioSelecionado = useMemo(
    () => municipios.find((m) => m.municipio === municipio) ?? null,
    [municipios, municipio],
  )

  const gerarPlano = useCallback(async () => {
    if (!municipio) return
    setLoadingPlano(true)
    setErro(null)
    try {
      const params = new URLSearchParams({
        municipio,
        n: String(amostra),
        tipo,
        entrevistadores: String(entrevistadores),
      })
      if (instituto.trim()) params.set('instituto', instituto.trim())
      const res = await fetch(`/api/pesquisa/plano-amostragem?${params.toString()}`)
      const json = (await res.json()) as PlanoResponse & { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro ao gerar plano')
      setPlano(json.plano)
      setLocais(json.locais ?? [])
      setSetores(json.setores ?? [])
      setMeta(json.meta)
    } catch (e) {
      setPlano(null)
      setLocais([])
      setSetores([])
      setMeta(null)
      setErro(e instanceof Error ? e.message : 'Erro ao gerar plano')
    } finally {
      setLoadingPlano(false)
    }
  }, [amostra, entrevistadores, instituto, municipio, tipo])

  const handleExportXlsx = useCallback(() => {
    if (!plano) return
    setExportBusy('xlsx')
    try {
      exportarPlanoAmostragemExcel(plano)
    } finally {
      setExportBusy('idle')
    }
  }, [plano])

  const handleExportPdf = useCallback(() => {
    if (!plano) return
    setExportBusy('pdf')
    try {
      exportarPlanoAmostragemPdf(plano)
    } finally {
      setExportBusy('idle')
    }
  }, [plano])

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-card bg-surface p-4 sm:p-5 shadow-card">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-lg bg-accent-gold/10 p-2 text-accent-gold">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">Gerar público para pesquisa</h2>
            <p className="mt-1 text-sm text-secondary leading-relaxed">
              Plano metodológico preliminar para o instituto executar no campo: cotas demográficas,
              blocos urbano/rural e roteiro de equipe. Valide povoados e limites locais antes da coleta.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-text-muted">Município</span>
            <select
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              disabled={loadingLista}
              className="rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
            >
              {municipios.map((m) => (
                <option key={m.codigoIbge} value={m.municipio}>
                  {m.municipio} ({m.populacao.toLocaleString('pt-BR')} hab.)
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-text-muted">Amostra (N)</span>
            <select
              value={amostra}
              onChange={(e) => setAmostra(Number(e.target.value))}
              className="rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
            >
              {OPCOES_N.map((n) => (
                <option key={n} value={n}>
                  {n} entrevistas
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-text-muted">Entrevistadores</span>
            <input
              type="number"
              min={1}
              max={50}
              value={entrevistadores}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10)
                if (Number.isFinite(n)) {
                  setEntrevistadores(Math.max(1, Math.min(50, n)))
                }
              }}
              className="rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
            />
            <span className="text-[11px] text-secondary">
              ≈ {entrevistasPorEntrevistador} entrevistas/pessoa
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-text-muted">Tipo</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoPesquisaForm)}
              className="rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
            >
              <option value="opiniao">Opinião pública (peso: população IBGE)</option>
              <option value="eleitoral">Eleitoral (peso: eleitorado TSE)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-text-muted">Instituto (opcional)</span>
            <input
              type="text"
              value={instituto}
              onChange={(e) => setInstituto(e.target.value)}
              placeholder="Nome do instituto parceiro"
              className="rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
            />
          </label>
        </div>

        {municipioSelecionado ? (
          <p className="mt-3 text-xs text-secondary">
            IBGE {municipioSelecionado.codigoIbge} · população Censo 2022:{' '}
            {municipioSelecionado.populacao.toLocaleString('pt-BR')}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void gerarPlano()}
            disabled={!municipio || loadingPlano || loadingLista}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-gold px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-gold/90 disabled:opacity-50"
          >
            {loadingPlano ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <MapPin className="h-4 w-4" aria-hidden />
            )}
            Gerar plano
          </button>

          {plano ? (
            <>
              <button
                type="button"
                onClick={handleExportXlsx}
                disabled={exportBusy !== 'idle'}
                className="inline-flex items-center gap-2 rounded-lg border border-card bg-background px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface"
              >
                {exportBusy === 'xlsx' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" aria-hidden />
                )}
                Excel
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportBusy !== 'idle'}
                className="inline-flex items-center gap-2 rounded-lg border border-card bg-background px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface"
              >
                {exportBusy === 'pdf' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="h-4 w-4" aria-hidden />
                )}
                PDF
              </button>
            </>
          ) : null}
        </div>

        {erro ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {erro}
          </p>
        ) : null}
      </section>

      {plano ? (
        <PlanoPreview
          plano={plano}
          meta={meta}
          locais={locais}
          setores={setores}
          municipio={municipio}
        />
      ) : (
        <section className="rounded-xl border border-dashed border-card bg-background/50 p-6 text-center text-sm text-secondary">
          Selecione o município e clique em &quot;Gerar plano&quot; para ver cotas, blocos territoriais e
          sugestão de equipe de campo.
        </section>
      )}
    </div>
  )
}

function PlanoPreview({
  plano,
  meta,
  locais,
  setores,
  municipio,
}: {
  plano: PlanoAmostragemPublico
  meta: PlanoResponse['meta'] | null
  locais: LocalMapaPlano[]
  setores: SetorMapaPlano[]
  municipio: string
}) {
  const totalBlocos = plano.divisaoTerritorial.reduce((acc, b) => acc + b.entrevistas, 0)

  return (
    <div className="flex flex-col gap-4" id="plano-amostragem-preview">
      {plano.avisos.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-600/70 dark:bg-amber-950/70">
          <div className="mb-2 flex items-center gap-2 text-amber-950 dark:text-amber-50">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
            <span className="text-sm font-semibold">Avisos metodológicos</span>
          </div>
          <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
            {plano.avisos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="rounded-xl border border-card bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-text-primary">Resumo</h3>
        <p className="mt-2 text-sm text-secondary leading-relaxed">{plano.metodologiaResumo}</p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="text-xs text-text-muted">Território</dt>
            <dd className="font-medium text-text-primary">{plano.territorio ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Eleitorado</dt>
            <dd className="font-medium text-text-primary">
              {plano.eleitorado?.toLocaleString('pt-BR') ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Urbano / rural</dt>
            <dd className="font-medium text-text-primary">
              {plano.taxaUrbanaPct}% / {plano.taxaRuralPct}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Peso territorial</dt>
            <dd className="font-medium text-text-primary">
              {meta?.pesoTerritorial === 'eleitorado_tse'
                ? 'Eleitorado TSE'
                : 'População IBGE'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Entrevistadores</dt>
            <dd className="font-medium text-text-primary">
              {plano.entrevistadoresPrevistos} pessoas
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">
              {meta?.modoSetoresPlano ? 'Blocos (setores)' : 'Blocos (TSE)'}
            </dt>
            <dd className="font-medium text-text-primary">
              {meta?.modoSetoresPlano
                ? `${meta.setoresIbge ?? 0} setores`
                : `${meta?.bairrosEncontrados ?? 0} bairros/recortes`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Mapa</dt>
            <dd className="font-medium text-text-primary">
              {meta?.camadaMapa === 'hibrido'
                ? 'IBGE ref. + TSE'
                : meta?.camadaMapa === 'setores_ibge'
                  ? 'Setores IBGE'
                  : 'Locais TSE'}
            </dd>
          </div>
        </dl>
      </section>

      {setores.length > 0 || locais.length > 0 ? (
        <section className="rounded-xl border border-card bg-surface p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">Mapa territorial</h3>
          <MapaPlanoAmostragem
            municipio={municipio}
            locais={locais}
            setores={setores}
            blocos={plano.divisaoTerritorial}
            camadaMapa={meta?.camadaMapa ?? 'locais_tse'}
          />
        </section>
      ) : null}

      <section className="rounded-xl border border-card bg-surface p-4 sm:p-5 overflow-x-auto">
        <h3 className="mb-3 text-sm font-semibold text-text-primary">
          Divisão territorial ({totalBlocos} entrevistas)
        </h3>
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-card text-xs uppercase tracking-wide text-text-muted">
              <th className="py-2 pr-3 font-semibold">Bloco</th>
              <th className="py-2 pr-3 font-semibold">Tipo</th>
              <th className="py-2 pr-3 font-semibold text-right">N</th>
              <th className="py-2 font-semibold text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {plano.divisaoTerritorial.map((b) => (
              <tr key={b.id} className="border-b border-card/60">
                <td className="py-2 pr-3 text-text-primary">
                  {b.nome}
                  {b.notas ? (
                    <p className="mt-0.5 text-[11px] text-secondary">{b.notas}</p>
                  ) : null}
                </td>
                <td className="py-2 pr-3 capitalize text-secondary">{b.tipo}</td>
                <td className="py-2 pr-3 text-right font-medium">{b.entrevistas}</td>
                <td className="py-2 text-right text-secondary">{b.pesoPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <CotaTable titulo="Sexo" cotas={plano.cotasSexo} />
        <CotaTable titulo="Idade" cotas={plano.cotasIdade} />
        <CotaTable titulo="Horário" cotas={plano.cotasHorario} />
      </div>

      <section className="rounded-xl border border-card bg-surface p-4 sm:p-5 overflow-x-auto">
        <h3 className="mb-3 text-sm font-semibold text-text-primary">Equipe de campo sugerida</h3>
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-card text-xs uppercase tracking-wide text-text-muted">
              <th className="py-2 pr-3 font-semibold">#</th>
              <th className="py-2 pr-3 font-semibold text-right">Entrevistas</th>
              <th className="py-2 font-semibold">Blocos</th>
            </tr>
          </thead>
          <tbody>
            {plano.equipeCampo.map((e) => (
              <tr key={e.entrevistador} className="border-b border-card/60">
                <td className="py-2 pr-3">{e.entrevistador}</td>
                <td className="py-2 pr-3 text-right font-medium">{e.entrevistas}</td>
                <td className="py-2 text-secondary text-xs">{e.blocosSugeridos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <PlanoCampoRoteiroSection
        plano={plano}
        locais={locais}
        setores={setores}
        usarSetoresIbge={meta?.modoSetoresPlano ?? false}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <ListaRegras titulo="Regras de campo" itens={plano.regrasCampo} />
        <ListaRegras titulo="Elegibilidade" itens={plano.regrasSorteio} />
        <ListaRegras titulo="Auditoria" itens={plano.auditoria} />
      </section>
    </div>
  )
}

function CotaTable({
  titulo,
  cotas,
}: {
  titulo: string
  cotas: PlanoAmostragemPublico['cotasSexo']
}) {
  return (
    <section className="rounded-xl border border-card bg-surface p-4">
      <h3 className="mb-2 text-sm font-semibold text-text-primary">Cotas — {titulo}</h3>
      <ul className="space-y-1.5 text-sm">
        {cotas.map((c) => (
          <li key={c.perfil} className="flex justify-between gap-2">
            <span className="text-secondary">{c.perfil}</span>
            <span className="font-medium text-text-primary">
              {c.meta} <span className="text-xs text-text-muted">({c.pct}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ListaRegras({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <section className="rounded-xl border border-card bg-surface p-4">
      <h3 className="mb-2 text-sm font-semibold text-text-primary">{titulo}</h3>
      <ol className="list-decimal space-y-1.5 pl-4 text-xs text-secondary leading-relaxed">
        {itens.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
    </section>
  )
}
