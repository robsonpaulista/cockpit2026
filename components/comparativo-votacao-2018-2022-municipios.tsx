'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ArrowUpRight,
  FileSpreadsheet,
  FileText,
  Minus,
  Search,
} from 'lucide-react'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import type { PontoVotosMunicipio } from '@/components/mapa-votos-historico-municipal'

export type LinhaComparativoMunicipio = {
  /** Chave normalizada (única) para React. */
  id: string
  municipio: string
  votos2018: number
  votos2022: number
  variacao: number
  percentual: number | null
}

function normalizarChaveMunicipio(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildLinhasComparativoMunicipios(
  pontos18: PontoVotosMunicipio[],
  pontos22: PontoVotosMunicipio[]
): LinhaComparativoMunicipio[] {
  const acum18 = new Map<string, { v: number; label: string }>()
  const acum22 = new Map<string, { v: number; label: string }>()

  for (const p of pontos18) {
    const k = normalizarChaveMunicipio(p.municipio)
    if (!k) continue
    const cur = acum18.get(k)
    acum18.set(k, {
      v: (cur?.v ?? 0) + p.votos,
      label: cur?.label ?? p.municipio,
    })
  }
  for (const p of pontos22) {
    const k = normalizarChaveMunicipio(p.municipio)
    if (!k) continue
    const cur = acum22.get(k)
    acum22.set(k, {
      v: (cur?.v ?? 0) + p.votos,
      label: cur?.label ?? p.municipio,
    })
  }

  const keys = new Set([...acum18.keys(), ...acum22.keys()])
  return [...keys].map((k) => {
    const a = acum18.get(k)
    const b = acum22.get(k)
    const votos2018 = a?.v ?? 0
    const votos2022 = b?.v ?? 0
    const municipio = a?.label || b?.label || k
    const variacao = votos2022 - votos2018
    let percentual: number | null = null
    if (votos2018 > 0) {
      percentual = ((votos2022 - votos2018) / votos2018) * 100
    }
    return { id: k, municipio, votos2018, votos2022, variacao, percentual }
  })
}

/** Critério principal de ordenação da tabela. */
type CriterioOrdenacaoComparativo = 'municipio' | 'variacao'
type SentidoVariacao = 'asc' | 'desc'

interface ComparativoVotacao20182022MunicipiosProps {
  pontos18: PontoVotosMunicipio[]
  pontos22: PontoVotosMunicipio[]
  /** Ex.: rótulo dos mapas (modo todos / candidato / filtro militar). */
  escopoResumo: string
}

function fmtPct(p: number | null): string {
  if (p === null) return '—'
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`
}

function dataArquivo(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ComparativoVotacao20182022Municipios({
  pontos18,
  pontos22,
  escopoResumo,
}: ComparativoVotacao20182022MunicipiosProps) {
  const [criterioOrdenacao, setCriterioOrdenacao] = useState<CriterioOrdenacaoComparativo>('municipio')
  const [sentidoVariacao, setSentidoVariacao] = useState<SentidoVariacao>('asc')
  const [buscaMunicipio, setBuscaMunicipio] = useState<string>('')

  const base = useMemo(
    () => buildLinhasComparativoMunicipios(pontos18, pontos22),
    [pontos18, pontos22]
  )

  const ordenadas = useMemo(() => {
    const copy = [...base]
    if (criterioOrdenacao === 'municipio') {
      copy.sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR'))
    } else {
      const cmp = sentidoVariacao === 'asc' ? 1 : -1
      copy.sort((a, b) => cmp * (a.variacao - b.variacao) || a.municipio.localeCompare(b.municipio, 'pt-BR'))
    }
    return copy
  }, [base, criterioOrdenacao, sentidoVariacao])

  const valorSelectOrdenacao =
    criterioOrdenacao === 'municipio' ? 'alfabetica' : sentidoVariacao === 'asc' ? 'variacao_az' : 'variacao_za'

  const alternarOrdenacaoVariacao = useCallback(() => {
    if (criterioOrdenacao !== 'variacao') {
      setCriterioOrdenacao('variacao')
      setSentidoVariacao('asc')
    } else {
      setSentidoVariacao((d) => (d === 'asc' ? 'desc' : 'asc'))
    }
  }, [criterioOrdenacao])

  const filtradas = useMemo(() => {
    const q = buscaMunicipio.trim()
    if (!q) return ordenadas
    const n = normalizarChaveMunicipio(q)
    if (!n) return ordenadas
    return ordenadas.filter((r) => normalizarChaveMunicipio(r.municipio).includes(n))
  }, [ordenadas, buscaMunicipio])

  const totais = useMemo(() => {
    const t18 = filtradas.reduce((s, r) => s + r.votos2018, 0)
    const t22 = filtradas.reduce((s, r) => s + r.votos2022, 0)
    const d = t22 - t18
    const pct = t18 > 0 ? ((t22 - t18) / t18) * 100 : null
    return { t18, t22, d, pct }
  }, [filtradas])

  const exportarExcel = useCallback(() => {
    const linhasSheet = filtradas.map((r) => ({
      Município: r.municipio,
      'Votos 2018': r.votos2018,
      'Votos 2022': r.votos2022,
      'Variação (2022 − 2018)': r.variacao,
      '% vs 2018': r.percentual === null ? '' : Math.round(r.percentual * 100) / 100,
    }))
    linhasSheet.push({
      Município: 'TOTAL (linhas exibidas)',
      'Votos 2018': totais.t18,
      'Votos 2022': totais.t22,
      'Variação (2022 − 2018)': totais.d,
      '% vs 2018': totais.pct === null ? '' : Math.round(totais.pct * 100) / 100,
    })
    const ws = XLSX.utils.json_to_sheet(linhasSheet.length ? linhasSheet : [{ Município: 'Sem dados' }])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Comparativo 2018-2022')
    const sufixo = buscaMunicipio.trim() ? '-filtrado' : ''
    XLSX.writeFile(wb, `comparativo-2018-2022-PI${sufixo}-${dataArquivo()}.xlsx`)
  }, [filtradas, totais, buscaMunicipio])

  const exportarPdf = useCallback(() => {
    const doc = new jsPDF('l', 'mm', 'a4')
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    const mx = 8
    const myBottom = 10
    const colM = mx
    const col18 = pw * 0.36
    const col22 = pw * 0.48
    const colV = pw * 0.62
    const colP = pw * 0.76
    const wMun = col18 - colM - 4

    let y = 12
    let totalPaginas = 1

    const garantirEspaco = (altura: number) => {
      if (y + altura > ph - myBottom) {
        doc.addPage()
        totalPaginas += 1
        y = 12
        return true
      }
      return false
    }

    const desenharCabecalhoTabela = () => {
      garantirEspaco(12)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('Município', colM, y)
      doc.text('2018', col18, y, { align: 'right' })
      doc.text('2022', col22, y, { align: 'right' })
      doc.text('Variação', colV, y, { align: 'right' })
      doc.text('%', colP, y, { align: 'right' })
      y += 2
      doc.setLineWidth(0.15)
      doc.line(mx, y, pw - mx, y)
      y += 5
      doc.setFont('helvetica', 'normal')
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Comparativo 2018 × 2022 por município — PI', mx, y)
    y += 6
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    const sub = doc.splitTextToSize(`Critério (mesmo dos mapas): ${escopoResumo}`, pw - 2 * mx) as string[]
    doc.text(sub, mx, y)
    y += sub.length * 4 + 2
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, mx, y)
    y += 5
    if (buscaMunicipio.trim()) {
      doc.setFont('helvetica', 'italic')
      doc.text(`Busca ativa: "${buscaMunicipio.trim()}" — ${filtradas.length} município(s)`, mx, y)
      y += 5
      doc.setFont('helvetica', 'normal')
    } else {
      doc.text(`${filtradas.length} municípios`, mx, y)
      y += 5
    }

    desenharCabecalhoTabela()

    for (const r of filtradas) {
      const linhasNome = doc.splitTextToSize(r.municipio, wMun) as string[]
      const altura = Math.max(linhasNome.length * 4.2, 5)
      if (garantirEspaco(altura + 1)) {
        desenharCabecalhoTabela()
      }
      doc.setFontSize(7.5)
      doc.text(linhasNome, colM, y)
      doc.text(r.votos2018.toLocaleString('pt-BR'), col18, y, { align: 'right' })
      doc.text(r.votos2022.toLocaleString('pt-BR'), col22, y, { align: 'right' })
      const vTxt = `${r.variacao > 0 ? '+' : ''}${r.variacao.toLocaleString('pt-BR')}`
      doc.text(vTxt, colV, y, { align: 'right' })
      doc.text(fmtPct(r.percentual), colP, y, { align: 'right' })
      y += altura + 0.5
    }

    garantirEspaco(10)
    doc.setLineWidth(0.3)
    doc.line(mx, y, pw - mx, y)
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL (linhas exibidas)', colM, y)
    doc.text(totais.t18.toLocaleString('pt-BR'), col18, y, { align: 'right' })
    doc.text(totais.t22.toLocaleString('pt-BR'), col22, y, { align: 'right' })
    doc.text(
      `${totais.d > 0 ? '+' : ''}${totais.d.toLocaleString('pt-BR')}`,
      colV,
      y,
      { align: 'right' }
    )
    doc.text(fmtPct(totais.pct), colP, y, { align: 'right' })

    for (let i = 1; i <= totalPaginas; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(100)
      doc.text(`Página ${i} / ${totalPaginas}`, pw - mx, ph - 4, { align: 'right' })
      doc.setTextColor(0)
    }

    const sufixo = buscaMunicipio.trim() ? '-filtrado' : ''
    doc.save(`comparativo-2018-2022-PI${sufixo}-${dataArquivo()}.pdf`)
  }, [filtradas, totais, escopoResumo, buscaMunicipio])

  return (
    <div className="mt-8 border-t border-card pt-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Comparativo 2018 × 2022 por município</h3>
          <p className="mt-1 text-xs text-secondary leading-relaxed">
            Variação dos votos por cidade entre as duas eleições, no <strong className="text-text-primary">mesmo critério</strong>{' '}
            dos mapas acima ({escopoResumo}).
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label htmlFor="ordem-comparativo-mun" className="text-[11px] font-medium text-secondary">
              Ordenar por
            </label>
            <select
              id="ordem-comparativo-mun"
              value={valorSelectOrdenacao}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'alfabetica') {
                  setCriterioOrdenacao('municipio')
                } else if (v === 'variacao_az') {
                  setCriterioOrdenacao('variacao')
                  setSentidoVariacao('asc')
                } else {
                  setCriterioOrdenacao('variacao')
                  setSentidoVariacao('desc')
                }
              }}
              className="rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
            >
              <option value="alfabetica">Município (A–Z)</option>
              <option value="variacao_az">Variação (A→Z — menor para maior)</option>
              <option value="variacao_za">Variação (Z→A — maior para menor)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary pointer-events-none" />
          <input
            id="busca-comparativo-municipio"
            type="search"
            value={buscaMunicipio}
            onChange={(e) => setBuscaMunicipio(e.target.value)}
            placeholder="Buscar município…"
            autoComplete="off"
            className="w-full rounded-lg border border-card bg-background py-2 pl-10 pr-3 text-sm text-text-primary placeholder:text-secondary"
            aria-label="Filtrar tabela por nome do município"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportarExcel}
            disabled={filtradas.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-card bg-background px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface disabled:opacity-50 disabled:pointer-events-none"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Excel
          </button>
          <button
            type="button"
            onClick={exportarPdf}
            disabled={filtradas.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-card bg-background px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface disabled:opacity-50 disabled:pointer-events-none"
          >
            <FileText className="h-4 w-4 text-red-600" />
            PDF
          </button>
        </div>
      </div>

      {buscaMunicipio.trim() && (
        <p className="mb-2 text-xs text-secondary">
          Exibindo <strong className="text-text-primary">{filtradas.length}</strong> de {ordenadas.length} municípios.
          Exportações usam apenas as linhas visíveis.
        </p>
      )}

      <div className="max-h-[min(520px,55vh)] overflow-auto rounded-xl border border-card">
        {base.length === 0 ? (
          <p className="p-4 text-sm text-secondary">Sem pontos para comparar neste critério.</p>
        ) : filtradas.length === 0 ? (
          <p className="p-4 text-sm text-secondary">Nenhum município encontrado para &quot;{buscaMunicipio.trim()}&quot;.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-background shadow-sm">
              <tr className="text-left text-xs uppercase tracking-wide text-secondary">
                <th className="px-3 py-2">Município</th>
                <th className="px-3 py-2 text-right">2018</th>
                <th className="px-3 py-2 text-right">2022</th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={alternarOrdenacaoVariacao}
                    aria-label={
                      criterioOrdenacao === 'variacao'
                        ? sentidoVariacao === 'asc'
                          ? 'Variação ordenada de menor para maior; alternar para maior para menor'
                          : 'Variação ordenada de maior para menor; alternar para menor para maior'
                        : 'Ordenar tabela pela coluna variação, menor para maior'
                    }
                    className="group inline-flex w-full items-center justify-end gap-1 rounded-md px-1 py-0.5 text-inherit hover:bg-surface focus-visible:outline focus-visible:ring-2 focus-visible:ring-accent-gold/40"
                    aria-sort={
                      criterioOrdenacao === 'variacao'
                        ? sentidoVariacao === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    title={
                      criterioOrdenacao === 'variacao'
                        ? sentidoVariacao === 'asc'
                          ? 'Variação A→Z (clique para Z→A)'
                          : 'Variação Z→A (clique para A→Z)'
                        : 'Ordenar por variação (A→Z)'
                    }
                  >
                    <span>Variação</span>
                    {criterioOrdenacao === 'variacao' ? (
                      sentidoVariacao === 'asc' ? (
                        <ArrowUpNarrowWide className="h-3.5 w-3.5 shrink-0 text-accent-gold" aria-hidden />
                      ) : (
                        <ArrowDownWideNarrow className="h-3.5 w-3.5 shrink-0 text-accent-gold" aria-hidden />
                      )
                    ) : (
                      <span className="inline-flex gap-0.5 opacity-40 group-hover:opacity-70" aria-hidden>
                        <ArrowUpNarrowWide className="h-3 w-3" />
                        <ArrowDownWideNarrow className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((row) => (
                <tr key={row.id} className="border-t border-card">
                  <td className="px-3 py-2 font-medium text-text-primary">{row.municipio}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                    {row.votos2018.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                    {row.votos2022.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span
                      className={
                        row.variacao > 0
                          ? 'text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center justify-end gap-0.5'
                          : row.variacao < 0
                            ? 'text-red-700 dark:text-red-400 font-medium inline-flex items-center justify-end gap-0.5'
                            : 'text-secondary inline-flex items-center justify-end gap-0.5'
                      }
                    >
                      {row.variacao > 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                      ) : row.variacao < 0 ? (
                        <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Minus className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      )}
                      {row.variacao > 0 ? '+' : ''}
                      {row.variacao.toLocaleString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-secondary">{fmtPct(row.percentual)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-card bg-surface font-semibold text-text-primary">
                <td className="px-3 py-2">
                  Total{buscaMunicipio.trim() ? ' (filtrado)' : ' (PI — linhas agregadas)'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{totais.t18.toLocaleString('pt-BR')}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totais.t22.toLocaleString('pt-BR')}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span
                    className={
                      totais.d > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : totais.d < 0
                          ? 'text-red-700 dark:text-red-400'
                          : ''
                    }
                  >
                    {totais.d > 0 ? '+' : ''}
                    {totais.d.toLocaleString('pt-BR')}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-secondary">{fmtPct(totais.pct)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      <p className="mt-2 text-[11px] text-secondary">
        Percentual em relação aos votos de 2018 no município; &quot;—&quot; quando o município tinha 0 em 2018 e votos em
        2022 (ou ambos zero).
      </p>
    </div>
  )
}
