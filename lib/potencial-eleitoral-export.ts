import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { applyPlugin, type UserOptions } from 'jspdf-autotable'
import {
  labelTendenciaExpectativa2022,
  type ComparativoExpectativa2022Row,
} from '@/lib/comparativo-expectativa-2022'

let jspdfAutotableApplied = false

function ensureJspdfAutotable(): void {
  if (!jspdfAutotableApplied) {
    applyPlugin(jsPDF)
    jspdfAutotableApplied = true
  }
}

type JsPdfWithAutoTable = InstanceType<typeof jsPDF> & {
  autoTable: (options: UserOptions) => InstanceType<typeof jsPDF>
  lastAutoTable: false | { finalY: number }
}

export type PotencialEleitoralExportTotais = {
  totalVotos2022: number
  totalExpectativa2026: number
  delta: number
  deltaPercentual: number | null
  municipios: number
  cresceu: number
}

export type PotencialEleitoralExportOptions = {
  rows: ComparativoExpectativa2022Row[]
  totais: PotencialEleitoralExportTotais
  cenarioLabel: string
  cargoFiltro?: string | null
}

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${Math.round(value)}%`
}

function formatDataExport(): string {
  return new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function nomeArquivo(ext: 'xlsx' | 'pdf'): string {
  const dia = new Date().toISOString().slice(0, 10)
  return `potencial-eleitoral-2022-2026-${dia}.${ext}`
}

function buildSubtitle(options: PotencialEleitoralExportOptions): string {
  const partes = [`Cenário: ${options.cenarioLabel}`, `Exportado em ${formatDataExport()}`]
  if (options.cargoFiltro) {
    partes.unshift(`Filtro por cargo: ${options.cargoFiltro}`)
  }
  return partes.join(' · ')
}

function rowToExportRecord(row: ComparativoExpectativa2022Row, cenarioLabel: string) {
  return {
    Município: row.cidade,
    'Votos 2022': row.votos2022,
    [cenarioLabel]: row.expectativa2026,
    Variação: row.delta,
    'Variação %': row.deltaPercentual != null ? Math.round(row.deltaPercentual * 10) / 10 : null,
    Tendência: labelTendenciaExpectativa2022(row.tendencia),
    Lideranças: row.liderancas,
  }
}

export function exportPotencialEleitoralToXlsx(options: PotencialEleitoralExportOptions): void {
  const { rows, totais, cenarioLabel } = options
  const wb = XLSX.utils.book_new()

  const metaRows = [
    ['Potencial Eleitoral: 2022 → 2026'],
    [buildSubtitle(options)],
    [],
    ['Total votos 2022', totais.totalVotos2022],
    [`Total ${cenarioLabel}`, totais.totalExpectativa2026],
    ['Variação total', totais.delta],
    ['Variação total %', totais.deltaPercentual != null ? Math.round(totais.deltaPercentual * 10) / 10 : null],
    ['Municípios', totais.municipios],
    ['Municípios com avanço', totais.cresceu],
    [],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaRows), 'Resumo')

  const dataSheet = XLSX.utils.json_to_sheet(rows.map((row) => rowToExportRecord(row, cenarioLabel)))
  const totalRow = rowToExportRecord(
    {
      cidade: 'Total',
      votos2022: totais.totalVotos2022,
      expectativa2026: totais.totalExpectativa2026,
      delta: totais.delta,
      deltaPercentual: totais.deltaPercentual,
      tendencia: totais.delta > 0 ? 'cresceu' : totais.delta < 0 ? 'caiu' : 'manteve',
      liderancas: 0,
    },
    cenarioLabel,
  )
  XLSX.utils.sheet_add_json(dataSheet, [totalRow], {
    skipHeader: true,
    origin: -1,
  })
  XLSX.utils.book_append_sheet(wb, dataSheet, 'Municípios')

  XLSX.writeFile(wb, nomeArquivo('xlsx'))
}

export function exportPotencialEleitoralToPdf(options: PotencialEleitoralExportOptions): void {
  ensureJspdfAutotable()
  const { rows, totais, cenarioLabel } = options
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable

  doc.setFontSize(14)
  doc.text('Potencial Eleitoral: 2022 → 2026', 14, 16)
  doc.setFontSize(9)
  const subtitleLines = doc.splitTextToSize(buildSubtitle(options), 268)
  doc.text(subtitleLines, 14, 23)

  const resumoY = 23 + subtitleLines.length * 4.2 + 2
  doc.setFontSize(8)
  doc.text(
    `Totais — 2022: ${totais.totalVotos2022.toLocaleString('pt-BR')} · ${cenarioLabel}: ${totais.totalExpectativa2026.toLocaleString('pt-BR')} · Variação: ${totais.delta >= 0 ? '+' : ''}${totais.delta.toLocaleString('pt-BR')} (${formatPct(totais.deltaPercentual)}) · ${totais.municipios} municípios`,
    14,
    resumoY,
  )

  doc.autoTable({
    startY: resumoY + 5,
    head: [['Município', '2022', cenarioLabel, 'Variação', 'Var. %', 'Tendência', 'Lideranças']],
    body: [
      ...rows.map((row) => [
        row.cidade,
        row.votos2022.toLocaleString('pt-BR'),
        row.expectativa2026.toLocaleString('pt-BR'),
        `${row.delta >= 0 ? '+' : ''}${row.delta.toLocaleString('pt-BR')}`,
        formatPct(row.deltaPercentual),
        labelTendenciaExpectativa2022(row.tendencia),
        String(row.liderancas),
      ]),
      [
        'Total',
        totais.totalVotos2022.toLocaleString('pt-BR'),
        totais.totalExpectativa2026.toLocaleString('pt-BR'),
        `${totais.delta >= 0 ? '+' : ''}${totais.delta.toLocaleString('pt-BR')}`,
        formatPct(totais.deltaPercentual),
        '—',
        '—',
      ],
    ],
    styles: { fontSize: 7, cellPadding: 1.6 },
    headStyles: { fillColor: [200, 144, 10], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      6: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  })

  doc.save(nomeArquivo('pdf'))
}
