'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, Download, FileSpreadsheet, HelpCircle, Loader2, MapPin } from 'lucide-react'
import type { PlanoAmostragemPublico } from '@/lib/plano-amostragem-publico-types'
import type { LocalMapaPlano } from '@/lib/eleitorado-locais-pi'
import type { SetorMapaPlano } from '@/lib/setores-censitarios-pi'
import {
  exportarPlanoAmostragemExcel,
  exportarPlanoAmostragemPdf,
} from '@/lib/plano-amostragem-publico-export'
import { PlanoCampoRoteiroSection } from '@/components/pesquisa/plano-campo-roteiro-section'
import { PlanoAmostragemComoFuncionaModal } from '@/components/pesquisa/plano-amostragem-como-funciona-modal'
import { sugerirEntrevistadores } from '@/lib/plano-amostragem-publico'
import {
  fetchMunicipiosPlano,
  gerarPlanoAmostragem,
  type MunicipioPlano,
  type PlanoAmostragemMeta,
  type TipoPlanoPesquisa,
} from '@/lib/services/pesquisa-client'
import {
  TseCard,
  TseErro,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseRotuloCampoClass,
  tseTabela,
} from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'

const MapaPlanoAmostragem = dynamic(
  () => import('./mapa-plano-amostragem').then((m) => m.MapaPlanoAmostragem),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-lg bg-[var(--tse-bar)] text-[13px] text-[var(--tse-muted)]">
        Carregando mapa…
      </div>
    ),
  },
)

const OPCOES_N = [
  400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000,
] as const

export function GerarPublicoPesquisaPanel() {
  const [municipios, setMunicipios] = useState<MunicipioPlano[]>([])
  const [municipio, setMunicipio] = useState<string>('')
  const [amostra, setAmostra] = useState<number>(500)
  const [tipo, setTipo] = useState<TipoPlanoPesquisa>('opiniao')
  const [instituto, setInstituto] = useState<string>('')
  const [entrevistadores, setEntrevistadores] = useState<number>(() => sugerirEntrevistadores(500))
  const [plano, setPlano] = useState<PlanoAmostragemPublico | null>(null)
  const [locais, setLocais] = useState<LocalMapaPlano[]>([])
  const [setores, setSetores] = useState<SetorMapaPlano[]>([])
  const [meta, setMeta] = useState<PlanoAmostragemMeta | null>(null)
  const [loadingLista, setLoadingLista] = useState<boolean>(true)
  const [loadingPlano, setLoadingPlano] = useState<boolean>(false)
  const [erro, setErro] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState<'idle' | 'xlsx' | 'pdf'>('idle')
  const [comoFuncionaAberto, setComoFuncionaAberto] = useState<boolean>(false)

  useEffect(() => {
    let cancelado = false
    setLoadingLista(true)
    fetchMunicipiosPlano()
      .then((lista) => {
        if (cancelado) return
        setMunicipios(lista)
        if (lista.length) setMunicipio((prev) => prev || lista[0].municipio)
      })
      .catch((e: unknown) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao carregar municípios.')
      })
      .finally(() => {
        if (!cancelado) setLoadingLista(false)
      })
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
      const resposta = await gerarPlanoAmostragem({ municipio, amostra, tipo, entrevistadores, instituto })
      setPlano(resposta.plano)
      setLocais(resposta.locais)
      setSetores(resposta.setores)
      setMeta(resposta.meta)
    } catch (e) {
      setPlano(null)
      setLocais([])
      setSetores([])
      setMeta(null)
      setErro(e instanceof Error ? e.message : 'Erro ao gerar plano.')
    } finally {
      setLoadingPlano(false)
    }
  }, [amostra, entrevistadores, instituto, municipio, tipo])

  const exportar = useCallback(
    (formato: 'xlsx' | 'pdf') => {
      if (!plano) return
      setExportBusy(formato)
      try {
        if (formato === 'xlsx') exportarPlanoAmostragemExcel(plano)
        else exportarPlanoAmostragemPdf(plano)
      } finally {
        setExportBusy('idle')
      }
    },
    [plano],
  )

  return (
    <div className="flex flex-col gap-4">
      <PlanoAmostragemComoFuncionaModal open={comoFuncionaAberto} onClose={() => setComoFuncionaAberto(false)} />

      <TseCard
        titulo="Gerar público para pesquisa"
        subtitulo="Plano metodológico preliminar para o instituto executar no campo: cotas demográficas, blocos urbano/rural e roteiro de equipe. Valide povoados e limites locais antes da coleta."
        acao={
          <button
            type="button"
            onClick={() => setComoFuncionaAberto(true)}
            className={cn(tseBotaoCinzaClass, 'shrink-0')}
            title="Entenda como o plano distribui entrevistas por área"
          >
            <HelpCircle className={tseBotaoIconeClass} aria-hidden />
            Como funciona?
          </button>
        }
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <label className="block">
            <span className={tseRotuloCampoClass}>Município</span>
            <select
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              disabled={loadingLista}
              className={tseCampoClass}
            >
              {municipios.map((m) => (
                <option key={m.codigoIbge} value={m.municipio}>
                  {m.municipio} ({m.populacao.toLocaleString('pt-BR')} hab.)
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={tseRotuloCampoClass}>Amostra (N)</span>
            <select value={amostra} onChange={(e) => setAmostra(Number(e.target.value))} className={tseCampoClass}>
              {OPCOES_N.map((n) => (
                <option key={n} value={n}>
                  {n} entrevistas
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={tseRotuloCampoClass}>Entrevistadores</span>
            <input
              type="number"
              min={1}
              max={50}
              value={entrevistadores}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10)
                if (Number.isFinite(n)) setEntrevistadores(Math.max(1, Math.min(50, n)))
              }}
              className={tseCampoClass}
            />
            <span className="mt-1 block text-[11px] text-[var(--tse-muted)]">
              ≈ {entrevistasPorEntrevistador} entrevistas/pessoa
            </span>
          </label>

          <label className="block">
            <span className={tseRotuloCampoClass}>Tipo</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoPlanoPesquisa)}
              className={tseCampoClass}
            >
              <option value="opiniao">Opinião pública (peso: população IBGE)</option>
              <option value="eleitoral">Eleitoral (peso: eleitorado TSE)</option>
            </select>
          </label>

          <label className="block">
            <span className={tseRotuloCampoClass}>Instituto (opcional)</span>
            <input
              type="text"
              value={instituto}
              onChange={(e) => setInstituto(e.target.value)}
              placeholder="Nome do instituto parceiro"
              className={tseCampoClass}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void gerarPlano()}
            disabled={!municipio || loadingPlano || loadingLista}
            className={tseBotaoPrimarioClass}
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
                onClick={() => exportar('xlsx')}
                disabled={exportBusy !== 'idle'}
                className={tseBotaoCinzaClass}
              >
                {exportBusy === 'xlsx' ? (
                  <Loader2 className={cn(tseBotaoIconeClass, 'animate-spin')} aria-hidden />
                ) : (
                  <FileSpreadsheet className={tseBotaoIconeClass} aria-hidden />
                )}
                Excel
              </button>
              <button
                type="button"
                onClick={() => exportar('pdf')}
                disabled={exportBusy !== 'idle'}
                className={tseBotaoCinzaClass}
              >
                {exportBusy === 'pdf' ? (
                  <Loader2 className={cn(tseBotaoIconeClass, 'animate-spin')} aria-hidden />
                ) : (
                  <Download className={tseBotaoIconeClass} aria-hidden />
                )}
                PDF
              </button>
            </>
          ) : null}
          {municipioSelecionado ? (
            <span className="text-[12px] text-[var(--tse-muted)] lg:ml-auto">
              IBGE {municipioSelecionado.codigoIbge} · população Censo 2022:{' '}
              {municipioSelecionado.populacao.toLocaleString('pt-BR')}
            </span>
          ) : null}
        </div>
      </TseCard>

      {erro ? <TseErro>{erro}</TseErro> : null}

      {plano ? (
        <PlanoPreview plano={plano} meta={meta} locais={locais} setores={setores} municipio={municipio} />
      ) : (
        <TseVazio>
          Selecione o município e clique em «Gerar plano» para ver cotas, blocos territoriais e sugestão de equipe
          de campo.
        </TseVazio>
      )}
    </div>
  )
}

function ResumoItem({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--tse-bar)] px-3 py-2">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">{rotulo}</dt>
      <dd className="mt-0.5 text-[14px] font-bold">{children}</dd>
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
  meta: PlanoAmostragemMeta | null
  locais: LocalMapaPlano[]
  setores: SetorMapaPlano[]
  municipio: string
}) {
  const totalBlocos = plano.divisaoTerritorial.reduce((acc, b) => acc + b.entrevistas, 0)

  return (
    <div className="flex flex-col gap-4" id="plano-amostragem-preview">
      {plano.avisos.length > 0 ? (
        <div className="rounded-xl bg-[var(--tse-yellow-soft)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--tse-gold-text)]" aria-hidden />
            <span className="text-[13px] font-bold">Avisos metodológicos</span>
          </div>
          <ul className="list-disc space-y-1.5 pl-5 text-[12px] leading-relaxed">
            {plano.avisos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <TseCard titulo="Resumo" subtitulo={plano.metodologiaResumo}>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          <ResumoItem rotulo="Território">{plano.territorio ?? '—'}</ResumoItem>
          <ResumoItem rotulo="Eleitorado">{plano.eleitorado?.toLocaleString('pt-BR') ?? '—'}</ResumoItem>
          <ResumoItem rotulo="Urbano / rural">
            {plano.taxaUrbanaPct}% / {plano.taxaRuralPct}%
            <span className="mt-0.5 block text-[11px] font-normal text-[var(--tse-muted)]">
              Meta: {plano.amostraUrbana} urb. + {plano.amostraRural} rur. = {plano.amostraTotal}
            </span>
          </ResumoItem>
          <ResumoItem rotulo="Peso territorial">
            {meta?.pesoTerritorial === 'eleitorado_tse' ? 'Eleitorado TSE' : 'População IBGE'}
          </ResumoItem>
          <ResumoItem rotulo="Entrevistadores">{plano.entrevistadoresPrevistos} pessoas</ResumoItem>
          <ResumoItem rotulo={meta?.modoSetoresPlano ? 'Blocos (setores)' : 'Blocos (TSE)'}>
            {meta?.modoSetoresPlano
              ? `${meta.setoresIbge ?? 0} setores`
              : `${meta?.bairrosEncontrados ?? 0} bairros/recortes`}
          </ResumoItem>
          <ResumoItem rotulo="Mapa">
            {meta?.camadaMapa === 'hibrido'
              ? 'IBGE ref. + TSE'
              : meta?.camadaMapa === 'setores_ibge'
                ? 'Setores IBGE'
                : 'Locais TSE'}
          </ResumoItem>
        </dl>
      </TseCard>

      {setores.length > 0 || locais.length > 0 ? (
        <TseCard titulo="Mapa territorial">
          <div className="mt-3">
            <MapaPlanoAmostragem
              municipio={municipio}
              locais={locais}
              setores={setores}
              blocos={plano.divisaoTerritorial}
              camadaMapa={meta?.camadaMapa ?? 'locais_tse'}
            />
          </div>
        </TseCard>
      ) : null}

      <div>
        <h3 className="mb-2 text-[15px] font-bold">Divisão territorial ({totalBlocos} entrevistas)</h3>
        <div className={tseTabela.container}>
          <table className={cn(tseTabela.table, 'min-w-[600px]')} data-tse-tabela>
            <thead className={tseTabela.thead}>
              <tr>
                <th className={tseTabela.th}>Bloco</th>
                <th className={tseTabela.th}>Tipo</th>
                <th className={cn(tseTabela.th, 'text-right')}>N</th>
                <th className={cn(tseTabela.th, 'text-right')}>% no estrato</th>
                <th className={cn(tseTabela.th, 'text-right')}>% da amostra</th>
              </tr>
            </thead>
            <tbody>
              {plano.divisaoTerritorial.map((b) => (
                <tr key={b.id} className={tseTabela.tr}>
                  <td className={tseTabela.td}>
                    <span className="font-semibold">{b.nome}</span>
                    {b.notas ? <p className="mt-0.5 text-[11px] text-[var(--tse-muted)]">{b.notas}</p> : null}
                  </td>
                  <td className={cn(tseTabela.td, 'capitalize text-[var(--tse-muted)]')}>{b.tipo}</td>
                  <td className={cn(tseTabela.td, 'text-right font-bold tabular-nums')}>{b.entrevistas}</td>
                  <td className={cn(tseTabela.td, 'text-right tabular-nums text-[var(--tse-muted)]')}>{b.pesoPct}%</td>
                  <td className={cn(tseTabela.td, 'text-right tabular-nums text-[var(--tse-muted)]')}>
                    {b.pctAmostra}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CotaTable titulo="Sexo" cotas={plano.cotasSexo} />
        <CotaTable titulo="Idade" cotas={plano.cotasIdade} />
        <CotaTable titulo="Horário" cotas={plano.cotasHorario} />
      </div>

      <div>
        <h3 className="mb-2 text-[15px] font-bold">Equipe de campo sugerida</h3>
        <div className={tseTabela.container}>
          <table className={cn(tseTabela.table, 'min-w-[480px]')} data-tse-tabela>
            <thead className={tseTabela.thead}>
              <tr>
                <th className={tseTabela.th}>#</th>
                <th className={cn(tseTabela.th, 'text-right')}>Entrevistas</th>
                <th className={tseTabela.th}>Blocos</th>
              </tr>
            </thead>
            <tbody>
              {plano.equipeCampo.map((e) => (
                <tr key={e.entrevistador} className={tseTabela.tr}>
                  <td className={cn(tseTabela.td, 'font-semibold')}>{e.entrevistador}</td>
                  <td className={cn(tseTabela.td, 'text-right font-bold tabular-nums')}>{e.entrevistas}</td>
                  <td className={cn(tseTabela.td, 'text-[12px] text-[var(--tse-muted)]')}>{e.blocosSugeridos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PlanoCampoRoteiroSection
        plano={plano}
        locais={locais}
        setores={setores}
        usarSetoresIbge={meta?.modoSetoresPlano ?? false}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <ListaRegras titulo="Regras de campo" itens={plano.regrasCampo} />
        <ListaRegras titulo="Elegibilidade" itens={plano.regrasSorteio} />
        <ListaRegras titulo="Auditoria" itens={plano.auditoria} />
      </div>
    </div>
  )
}

function CotaTable({ titulo, cotas }: { titulo: string; cotas: PlanoAmostragemPublico['cotasSexo'] }) {
  const max = Math.max(1, ...cotas.map((c) => c.pct))
  return (
    <TseCard titulo={`Cotas — ${titulo}`}>
      <ul className="mt-3 space-y-2 text-[13px]">
        {cotas.map((c) => (
          <li key={c.perfil}>
            <div className="flex justify-between gap-2">
              <span>{c.perfil}</span>
              <span className="font-bold tabular-nums">
                {c.meta} <span className="text-[11px] font-normal text-[var(--tse-muted)]">({c.pct}%)</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EEEEEE]">
              <div className="h-full rounded-full bg-[var(--tse-green)]" style={{ width: `${(c.pct / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </TseCard>
  )
}

function ListaRegras({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <TseCard titulo={titulo}>
      <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-[12px] leading-relaxed text-[var(--tse-muted)]">
        {itens.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
    </TseCard>
  )
}
