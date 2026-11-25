'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileDown, Loader2, X } from 'lucide-react'
import { FotoCandidato, srcFotoCandidatoTse } from '@/components/candidatos/foto-candidato'
import {
  TseCarregando,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
} from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'
import {
  CANDIDATO_FEDERAL_NUMERO_2026,
  nomeCandidatoResumoExibicao,
  parseVotosEleicao,
  type ResultadoEleicao,
} from '@/lib/resumo-eleicoes-dados'
import {
  filtrarEmendasPorMunicipio,
  type EmendaRegistro,
} from '@/lib/emendas-filtro'
import { fetchEmendas } from '@/lib/services/emendas-client'
import { fetchResultadosEleicaoCidade } from '@/lib/services/ficha-atendimento-client'
import type { PropostaFns } from '@/lib/fns-tetos-saldo'
import type { LimitesMunicipioResponse } from '@/lib/limites-tetos-types'
import type { ClassificacaoSuas } from '@/lib/suas-porte'
import {
  resolverCargoFotoCandidato,
  type CargoFotoCandidato,
} from '@/lib/candidatos-foto-divulgacand'
import { MODALIDADE_LIMITE_LABEL } from '@/lib/emenda-modalidade'
import {
  formatarMoedaFicha,
  formatarSaldoFicha,
  montarDadosFichaLideranca,
  percentualVotosCandidato,
  rotuloCargoFicha,
  situacaoEleicaoCandidato,
  type TotaisEmendaExercicio,
} from '@/lib/ficha-lideranca-resumo'
import type { DistribuicaoCandidatoBweb } from '@/lib/candidato-distribuicao-bweb'
import { chaveMatchFromResumo } from '@/lib/candidato-votacao-secao-match'

const cell = 'border border-slate-300 px-2 py-[3px] text-[11px] leading-normal'
const headCell =
  'border border-slate-300 px-2 py-[3px] text-[10px] font-semibold leading-normal bg-slate-100'
const BAIRROS_VISIVEIS = 12

function slugArquivo(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 48)
}

type JsPdfDoc = InstanceType<typeof import('jspdf').jsPDF>

function recortarCanvas(
  origem: HTMLCanvasElement,
  y0: number,
  y1: number,
): HTMLCanvasElement | null {
  const top = Math.max(0, Math.floor(y0))
  const bottom = Math.min(origem.height, Math.ceil(y1))
  const altura = bottom - top
  if (altura <= 0) return null

  const fatia = document.createElement('canvas')
  fatia.width = origem.width
  fatia.height = altura
  const ctx = fatia.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, fatia.width, fatia.height)
  ctx.drawImage(origem, 0, top, origem.width, altura, 0, 0, origem.width, altura)
  return fatia
}

function adicionarFatiasCanvas(
  pdf: JsPdfDoc,
  canvas: HTMLCanvasElement,
  margem: number,
  utilWidth: number,
  utilHeight: number,
  iniciarNovaPagina: boolean,
): void {
  const imgHeightMm = (canvas.height * utilWidth) / canvas.width
  const pageHeightPx = Math.max(1, Math.floor((utilHeight / imgHeightMm) * canvas.height))

  let origemY = 0
  let pagina = 0
  while (origemY < canvas.height) {
    const fatiaAltura = Math.min(pageHeightPx, canvas.height - origemY)
    if (fatiaAltura <= 0) break
    const fatia = recortarCanvas(canvas, origemY, origemY + fatiaAltura)
    if (!fatia) break

    const fatiaMm = (fatia.height * utilWidth) / fatia.width
    if (iniciarNovaPagina || pagina > 0) pdf.addPage()
    pdf.addImage(fatia.toDataURL('image/png'), 'PNG', margem, margem, utilWidth, fatiaMm)

    origemY += fatiaAltura
    pagina += 1
  }
}

/**
 * Página 1: conteúdo até a marcação `data-ficha-pdf-pagina="2"`.
 * Página 2+: recursos 2025 em diante (sem cortar o título no meio da página 1).
 */
async function exportarFichaPdf(elemento: HTMLElement, nomeArquivo: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const quebra = elemento.querySelector('[data-ficha-pdf-pagina="2"]') as HTMLElement | null
  const rootRect = elemento.getBoundingClientRect()
  const quebraOffsetCss = quebra
    ? Math.max(0, quebra.getBoundingClientRect().top - rootRect.top + elemento.scrollTop)
    : null

  const canvas = await html2canvas(elemento, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    windowWidth: elemento.scrollWidth,
    windowHeight: elemento.scrollHeight,
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margem = 8
  const utilWidth = pageWidth - margem * 2
  const utilHeight = pageHeight - margem * 2

  const escala =
    canvas.height / Math.max(elemento.scrollHeight, elemento.offsetHeight, 1)
  const quebraPx =
    quebraOffsetCss != null
      ? Math.min(canvas.height, Math.max(0, Math.round(quebraOffsetCss * escala)))
      : null

  if (quebraPx == null || quebraPx <= 0 || quebraPx >= canvas.height) {
    adicionarFatiasCanvas(pdf, canvas, margem, utilWidth, utilHeight, false)
  } else {
    const pagina1 = recortarCanvas(canvas, 0, quebraPx)
    const pagina2mais = recortarCanvas(canvas, quebraPx, canvas.height)

    if (pagina1) {
      const hMm = (pagina1.height * utilWidth) / pagina1.width
      if (hMm <= utilHeight) {
        pdf.addImage(pagina1.toDataURL('image/png'), 'PNG', margem, margem, utilWidth, hMm)
      } else {
        // Cabe na página 1 com leve redução (evita estourar e empurrar emendas).
        const escalaFit = utilHeight / hMm
        const w = utilWidth * escalaFit
        const h = utilHeight
        const x = margem + (utilWidth - w) / 2
        pdf.addImage(pagina1.toDataURL('image/png'), 'PNG', x, margem, w, h)
      }
    }

    if (pagina2mais) {
      adicionarFatiasCanvas(pdf, pagina2mais, margem, utilWidth, utilHeight, true)
    }
  }

  pdf.save(nomeArquivo.endsWith('.pdf') ? nomeArquivo : `${nomeArquivo}.pdf`)
}

function CelulaDupla({
  label,
  mac,
  pap,
}: {
  label: string
  mac: string
  pap: string
}) {
  return (
    <tr>
      <td className={cn(cell, 'font-medium bg-slate-50')}>{label}</td>
      <td className={cn(cell, 'text-right tabular-nums')}>{mac}</td>
      <td className={cn(cell, 'text-right tabular-nums')}>{pap}</td>
    </tr>
  )
}

function DadoCandidato({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string
  valor: string
  destaque?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p
        className={cn(
          'mt-0.5 break-words text-[13px] leading-snug text-slate-900',
          destaque ? 'font-bold' : 'font-semibold',
        )}
        title={valor}
      >
        {valor}
      </p>
    </div>
  )
}

export interface FichaLiderancaResumoProps {
  onClose: () => void
  municipio: string
  candidato: ResultadoEleicao
  cargo: CargoFotoCandidato
  limitesDb: LimitesMunicipioResponse | null
  propostasFns: PropostaFns[]
  emendasSuas: Array<{ valor_proposta: number; valor_pagar: number }>
  populacao: number | null
  classificacaoSuas: ClassificacaoSuas
  exercicioAtivo: number | null
  autoPrint?: boolean
  onPrinted?: () => void
}

export function FichaLiderancaResumo({
  onClose,
  municipio,
  candidato,
  cargo,
  limitesDb,
  propostasFns,
  emendasSuas,
  populacao,
  classificacaoSuas,
  exercicioAtivo,
  autoPrint = false,
  onPrinted,
}: FichaLiderancaResumoProps) {
  const [loading, setLoading] = useState<boolean>(true)
  const [resultadosEleicao, setResultadosEleicao] = useState<ResultadoEleicao[]>([])
  const [emendasTodas, setEmendasTodas] = useState<EmendaRegistro[]>([])
  const [fotoFalhou, setFotoFalhou] = useState<boolean>(false)
  const [distribuicao, setDistribuicao] = useState<DistribuicaoCandidatoBweb | null>(null)
  const [loadingBairros, setLoadingBairros] = useState<boolean>(false)
  const [erroBairros, setErroBairros] = useState<string | null>(null)
  const [gerandoPdf, setGerandoPdf] = useState<boolean>(false)
  const [erroPdf, setErroPdf] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const carregarExtra = useCallback(async () => {
    if (!municipio.trim()) return
    setLoading(true)
    const [eleicao, emendas] = await Promise.all([
      fetchResultadosEleicaoCidade(municipio).catch(() => null),
      fetchEmendas().catch(() => []),
    ])
    setResultadosEleicao(eleicao?.resultados ?? [])
    setEmendasTodas(emendas)
    setLoading(false)
  }, [municipio])

  useEffect(() => {
    if (municipio) void carregarExtra()
  }, [municipio, carregarExtra])

  useEffect(() => {
    setFotoFalhou(false)
  }, [candidato.anoEleicao, candidato.sequencialCandidato])

  useEffect(() => {
    const chave = chaveMatchFromResumo(candidato)
    if (!municipio.trim() || !chave) {
      setDistribuicao(null)
      setErroBairros(
        chave ? null : 'Sem dados de votação por seção para este cargo/ano.',
      )
      setLoadingBairros(false)
      return
    }

    const controller = new AbortController()
    setLoadingBairros(true)
    setErroBairros(null)
    setDistribuicao(null)

    const params = new URLSearchParams({
      cidade: municipio,
      ano: String(chave.ano),
      cargo: chave.dsCargo,
      cd_cargo: String(chave.cdCargo),
      nr: String(chave.nrVotavel),
      votos_resumo: candidato.quantidadeVotosNominais,
    })
    if (chave.sqCandidato != null) params.set('sq', String(chave.sqCandidato))

    void (async () => {
      try {
        const res = await fetch(
          `/api/resumo-eleicoes/votacao-secao/distribuicao?${params.toString()}`,
          { signal: controller.signal },
        )
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          distribuicao?: DistribuicaoCandidatoBweb
        }
        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
        setDistribuicao(data.distribuicao ?? null)
      } catch (e: unknown) {
        if (controller.signal.aborted) return
        setDistribuicao(null)
        setErroBairros(e instanceof Error ? e.message : 'Erro ao carregar bairros')
      } finally {
        if (!controller.signal.aborted) setLoadingBairros(false)
      }
    })()

    return () => controller.abort()
  }, [municipio, candidato])

  const totalSuasPropostas = emendasSuas.reduce((acc, e) => acc + (e.valor_proposta || 0), 0)
  const totalSuasPagar = emendasSuas.reduce((acc, e) => acc + (e.valor_pagar || 0), 0)

  const dados = useMemo(
    () =>
      montarDadosFichaLideranca({
        resultadosEleicao,
        limitesDb,
        propostasFns,
        emendasMunicipio: filtrarEmendasPorMunicipio(emendasTodas, municipio),
        classificacaoSuas,
        populacao,
        exercicioAtivo,
        totalSuasPropostas,
        totalSuasPagar,
      }),
    [
      resultadosEleicao,
      limitesDb,
      propostasFns,
      emendasTodas,
      municipio,
      classificacaoSuas,
      populacao,
      exercicioAtivo,
      totalSuasPropostas,
      totalSuasPagar,
    ],
  )

  useEffect(() => {
    if (!autoPrint || loading || loadingBairros) return
    const t = window.setTimeout(() => {
      window.print()
      onPrinted?.()
    }, 400)
    return () => window.clearTimeout(t)
  }, [autoPrint, loading, loadingBairros, onPrinted])

  const cargoEfetivo = resolverCargoFotoCandidato(candidato, cargo)
  const tituloCargo = rotuloCargoFicha(cargoEfetivo, candidato)
  const listaCargo = cargoEfetivo === 'prefeito' ? dados.prefeitos : dados.vereadores
  const votos = parseVotosEleicao(candidato.quantidadeVotosNominais)
  const pct = percentualVotosCandidato(candidato, listaCargo)
  const situacao = situacaoEleicaoCandidato(candidato)
  const nomeExibicao = nomeCandidatoResumoExibicao(
    candidato.nomeUrnaCandidato,
    candidato.numeroUrna,
  )
  const depFed = dados.depFederal[0]
  const depEst1 = dados.depEstadual[0]
  const depEst2 = dados.depEstadual[1]
  const depFedEhDestaque = depFed?.numeroUrna?.trim() === CANDIDATO_FEDERAL_NUMERO_2026
  const exFns = dados.exercicioAtivo ?? exercicioAtivo ?? 2025
  const emendasPorExercicio = dados.totaisEmendasPorExercicio
  const propostasExAtivo = dados.linhasFns

  const bairrosOrdenados = useMemo(() => {
    if (!distribuicao?.encontrado) return []
    return [...distribuicao.bairros].sort(
      (a, b) => b.totalVotos - a.totalVotos || a.nmBairro.localeCompare(b.nmBairro, 'pt-BR'),
    )
  }, [distribuicao])

  const bairrosVisiveis = bairrosOrdenados.slice(0, BAIRROS_VISIVEIS)
  const totalBairros = bairrosOrdenados.length
  const totalVotosBairros = distribuicao?.totalVotos ?? 0

  const gerarPdf = useCallback(async () => {
    const el = printRef.current
    if (!el || gerandoPdf) return
    setGerandoPdf(true)
    setErroPdf(null)
    try {
      await new Promise((r) => window.setTimeout(r, 80))
      const nome = slugArquivo(
        `ficha-${municipio}-${nomeExibicao || candidato.nomeUrnaCandidato}`,
      )
      await exportarFichaPdf(el, nome || 'ficha-lideranca')
    } catch (e: unknown) {
      setErroPdf(e instanceof Error ? e.message : 'Erro ao gerar PDF')
    } finally {
      setGerandoPdf(false)
    }
  }, [candidato.nomeUrnaCandidato, gerandoPdf, municipio, nomeExibicao])

  return (
    <div className="fixed inset-0 z-[1200] flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-4 print:static print:bg-white print:p-0">
      <div className="relative my-2 flex w-full max-w-4xl flex-col rounded-2xl bg-white text-[var(--tse-text)] shadow-xl print:my-0 print:max-w-none print:rounded-none print:shadow-none">
        <div className="flex items-start justify-between gap-3 border-b border-[#EEEEEE] px-6 py-4 print:hidden">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-bold">Ficha de liderança · {tituloCargo}</h2>
            <p className="mt-0.5 text-[12px] text-[var(--tse-muted)]">{municipio}</p>
            {erroPdf ? <p className="mt-1 text-[11px] text-red-600">{erroPdf}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void gerarPdf()}
              disabled={loading || loadingBairros || gerandoPdf}
              className={tseBotaoCinzaClass}
              title="Baixar PDF com o layout atual da ficha"
            >
              {gerandoPdf ? (
                <Loader2 className={cn(tseBotaoIconeClass, 'animate-spin')} aria-hidden />
              ) : (
                <FileDown className={tseBotaoIconeClass} aria-hidden />
              )}
              {gerandoPdf ? 'Gerando…' : 'Gerar PDF'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-text)]"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <TseCarregando texto="Montando ficha…" className="min-h-[16rem]" />
        ) : (
          <div
            id="ficha-lideranca-print"
            ref={printRef}
            className="bg-white p-4 font-sans text-slate-900 sm:p-6"
          >
            <div className="mb-4 border-2 border-[var(--tse-yellow)] bg-[var(--tse-yellow-soft)] px-4 py-3 text-center">
              <h1 className="text-xl font-bold uppercase tracking-wide sm:text-2xl">{municipio}</h1>
            </div>

            {/* Card 1 — candidato */}
            <section className="mb-4 border border-slate-300">
              <h3 className="border-b border-slate-300 bg-[var(--tse-yellow-soft)] px-3 py-1.5 text-xs font-bold uppercase">
                Candidato
              </h3>
              <div className="flex flex-col gap-3 p-2.5 sm:flex-row sm:items-start">
                <div className="flex shrink-0 justify-center sm:justify-start">
                  {!fotoFalhou &&
                  srcFotoCandidatoTse(candidato.anoEleicao, candidato.sequencialCandidato) ? (
                    <FotoCandidato
                      ano={candidato.anoEleicao}
                      sq={candidato.sequencialCandidato}
                      variante="ficha"
                      alt={candidato.nomeUrnaCandidato}
                      onFalhou={() => setFotoFalhou(true)}
                    />
                  ) : (
                    <div className="flex h-36 w-28 items-center justify-center border border-dashed border-slate-400 px-2 text-center text-[10px] text-slate-500">
                      Sem foto
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {tituloCargo}
                    </p>
                    <h2 className="text-lg font-bold uppercase leading-snug text-slate-900">
                      {nomeExibicao}
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                    <DadoCandidato rotulo="Partido" valor={candidato.partido || '—'} />
                    <DadoCandidato
                      rotulo="Nº urna"
                      valor={candidato.numeroUrna?.trim() || '—'}
                    />
                    <DadoCandidato rotulo="Situação" valor={situacao} />
                    <DadoCandidato
                      rotulo="Votos obtidos"
                      valor={`${votos.toLocaleString('pt-BR')} (${pct})`}
                    />
                    <DadoCandidato
                      rotulo="Eleição"
                      valor={candidato.anoEleicao || '—'}
                    />
                    <DadoCandidato
                      rotulo="Município"
                      valor={municipio || '—'}
                    />
                    <DadoCandidato
                      rotulo="Dep. Federal 2026"
                      valor={
                        depFed
                          ? `${depFed.nomeUrnaCandidato} (${depFed.partido || '—'})`
                          : '—'
                      }
                      destaque={depFedEhDestaque}
                    />
                    <div className="min-w-0 sm:col-span-2">
                      <DadoCandidato
                        rotulo="Dep. Estadual 2026"
                        valor={
                          [depEst1, depEst2]
                            .filter(Boolean)
                            .map((d) => `${d!.nomeUrnaCandidato} (${d!.partido || '—'})`)
                            .join(' · ') || '—'
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-300 px-3 pb-3 pt-2">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                    Votação por bairro
                  </h4>
                  {distribuicao?.encontrado ? (
                    <span className="text-[10px] text-slate-500">
                      {totalBairros.toLocaleString('pt-BR')} bairros ·{' '}
                      {totalVotosBairros.toLocaleString('pt-BR')} votos (bweb)
                    </span>
                  ) : null}
                </div>

                {loadingBairros ? (
                  <p className="py-3 text-center text-[12px] text-slate-500">Carregando bairros…</p>
                ) : erroBairros ? (
                  <p className="py-2 text-[12px] text-slate-500">{erroBairros}</p>
                ) : !distribuicao?.encontrado || bairrosVisiveis.length === 0 ? (
                  <p className="py-2 text-[12px] text-slate-500">
                    Sem votos por bairro para este candidato.
                  </p>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={cn(headCell, 'w-8 text-center')}>#</th>
                        <th className={headCell}>Bairro</th>
                        <th className={cn(headCell, 'w-20 text-right')}>Votos</th>
                        <th className={cn(headCell, 'w-16 text-right')}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bairrosVisiveis.map((bairro, i) => {
                        const pctBairro =
                          totalVotosBairros > 0
                            ? (bairro.totalVotos / totalVotosBairros) * 100
                            : 0
                        return (
                          <tr key={bairro.id}>
                            <td className={cn(cell, 'text-center tabular-nums text-slate-500')}>
                              {i + 1}
                            </td>
                            <td className={cell} title={bairro.nmBairro}>
                              {bairro.nmBairro}
                            </td>
                            <td className={cn(cell, 'text-right tabular-nums font-semibold')}>
                              {bairro.totalVotos.toLocaleString('pt-BR')}
                            </td>
                            <td className={cn(cell, 'text-right tabular-nums text-slate-600')}>
                              {pctBairro.toFixed(1).replace('.', ',')}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {totalBairros > BAIRROS_VISIVEIS ? (
                      <tfoot>
                        <tr>
                          <td className={cn(cell, 'text-slate-500')} colSpan={4}>
                            + {totalBairros - BAIRROS_VISIVEIS} bairro(s) omitidos na ficha
                          </td>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                )}
              </div>
            </section>

            {/* Card 2 — tetos e contexto eleitoral do município */}
            <section className="mb-4 border border-slate-300">
              <h3 className="border-b border-slate-300 bg-[var(--tse-yellow-soft)] px-3 py-1.5 text-xs font-bold uppercase">
                Tetos e contexto do município
              </h3>
              <div className="space-y-2 p-2.5">
                {(['individual', 'coletiva'] as const).map((mod) => (
                  <table key={mod} className="mb-0.5 w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={headCell} colSpan={3}>
                          Emendas {MODALIDADE_LIMITE_LABEL[mod]}
                        </th>
                      </tr>
                      <tr>
                        <th className={headCell} />
                        <th className={cn(headCell, 'text-center')}>MAC</th>
                        <th className={cn(headCell, 'text-center')}>PAP</th>
                      </tr>
                    </thead>
                    <tbody>
                      <CelulaDupla
                        label="Limite (teto)"
                        mac={formatarMoedaFicha(dados.resumoMac[mod].limite)}
                        pap={formatarMoedaFicha(dados.resumoPap[mod].limite)}
                      />
                      <CelulaDupla
                        label="Propostas"
                        mac={formatarMoedaFicha(dados.resumoMac[mod].propostas)}
                        pap={formatarMoedaFicha(dados.resumoPap[mod].propostas)}
                      />
                      <CelulaDupla
                        label="Saldo"
                        mac={formatarSaldoFicha(dados.resumoMac[mod].saldo)}
                        pap={formatarSaldoFicha(dados.resumoPap[mod].saldo)}
                      />
                      <CelulaDupla
                        label="A pagar"
                        mac={formatarMoedaFicha(dados.resumoMac[mod].valorPagar)}
                        pap={formatarMoedaFicha(dados.resumoPap[mod].valorPagar)}
                      />
                    </tbody>
                  </table>
                ))}

                <table className="w-full border-collapse">
                  <tbody>
                    <tr>
                      <td className={cn(cell, 'w-[40%] bg-slate-50 font-medium')}>SUAS (porte)</td>
                      <td className={cell}>
                        {dados.classificacaoSuas.porte} — {dados.classificacaoSuas.valorFormatado}
                        {dados.populacao != null ? (
                          <span className="text-slate-500">
                            {' '}
                            · pop. {dados.populacao.toLocaleString('pt-BR')}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                    <tr>
                      <td className={cn(cell, 'bg-slate-50 font-medium')}>Saldo SUAS</td>
                      <td className={cell}>{formatarSaldoFicha(dados.resumoSuas.saldo)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* PDF: esta marcação força início na página 2 (Recursos 2025 em diante). */}
            <div data-ficha-pdf-pagina="2">
              {emendasPorExercicio.map((bloco) => (
                <SecaoRecursosEmendasExercicio key={bloco.exercicio} bloco={bloco} />
              ))}

              {propostasExAtivo.length > 0 ? (
                <div className="mb-4">
                  <h3 className="mb-1 border border-slate-300 bg-[var(--tse-yellow-soft)] px-2 py-1.5 text-xs font-bold uppercase">
                    Propostas FNS ({exFns}) — MAC / PAP
                  </h3>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={headCell}>Tipo</th>
                        <th className={headCell}>Recurso</th>
                        <th className={cn(headCell, 'text-right')}>Valor</th>
                        <th className={headCell}>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {propostasExAtivo.slice(0, 15).map((p, i) => (
                        <tr key={`${p.descricao}-${i}`}>
                          <td className={cell}>{p.descricao}</td>
                          <td className={cell}>{p.tipoRecurso}</td>
                          <td className={cn(cell, 'text-right tabular-nums')}>
                            {formatarMoedaFicha(p.valor)}
                          </td>
                          <td className={cell}>{p.situacao}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold">
                        <td className={cell} colSpan={2}>
                          Total propostas (exc. PROGRAMA)
                        </td>
                        <td className={cn(cell, 'text-right tabular-nums')}>
                          {formatarMoedaFicha(
                            propostasExAtivo.reduce((acc, p) => acc + p.valor, 0),
                          )}
                        </td>
                        <td className={cell} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : null}

              <p className="pt-2 text-center text-[10px] text-slate-500 print:pt-4">
                Gerado pelo Cockpit — Ficha de Atendimento · {new Date().toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SecaoRecursosEmendasExercicio({ bloco }: { bloco: TotaisEmendaExercicio }) {
  const temItens = bloco.itens.length > 0
  const temValores =
    bloco.valorIndicado > 0 || bloco.valorEmpenhado > 0 || bloco.valorPago > 0

  return (
    <div className="mb-4">
      <h3 className="border border-slate-300 bg-[var(--tse-yellow-soft)] px-2 py-1.5 text-xs font-bold uppercase">
        Recursos destinados em {bloco.exercicio} (emendas mandato)
      </h3>
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className={cn(cell, 'w-[70%] bg-slate-50 font-medium')}>Valor indicado</td>
            <td className={cn(cell, 'text-right font-medium tabular-nums')}>
              {formatarMoedaFicha(bloco.valorIndicado)}
            </td>
          </tr>
          <tr>
            <td className={cn(cell, 'bg-slate-50 font-medium')}>Valor empenhado</td>
            <td className={cn(cell, 'text-right font-medium tabular-nums')}>
              {formatarMoedaFicha(bloco.valorEmpenhado)}
            </td>
          </tr>
          <tr className="bg-slate-50 font-bold">
            <td className={cell}>Valor pago</td>
            <td className={cn(cell, 'text-right tabular-nums')}>
              {formatarMoedaFicha(bloco.valorPago)}
            </td>
          </tr>
        </tbody>
      </table>

      {!temValores && !temItens ? (
        <p className="mt-1 px-1 text-xs text-slate-500">Nenhuma emenda do mandato neste exercício.</p>
      ) : null}

      {temItens ? (
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr>
              <th className={headCell}>Emenda</th>
              <th className={headCell}>Objeto</th>
              <th className={cn(headCell, 'text-right')}>Indicado</th>
              <th className={cn(headCell, 'text-right')}>Empenhado</th>
              <th className={cn(headCell, 'text-right')}>Pago</th>
            </tr>
          </thead>
          <tbody>
            {bloco.itens.map((e) => (
              <tr key={e.id}>
                <td className={cell}>{e.emenda}</td>
                <td className={cn(cell, 'max-w-[10rem] truncate')} title={e.objeto || ''}>
                  {e.objeto || '—'}
                </td>
                <td className={cn(cell, 'text-right tabular-nums')}>
                  {formatarMoedaFicha(e.valor_indicado)}
                </td>
                <td className={cn(cell, 'text-right tabular-nums')}>
                  {formatarMoedaFicha(e.valor_empenhado)}
                </td>
                <td className={cn(cell, 'text-right tabular-nums')}>
                  {formatarMoedaFicha(e.valor_pago)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}
