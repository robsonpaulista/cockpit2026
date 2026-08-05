import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { applyPlugin, type UserOptions } from 'jspdf-autotable'

export type ExpectativaRankingExportRow = {
  municipio: string
  expectativa: number
  peso: number
  populacao: number | null
  eleitores: number | null
  ultimaVisitaLabel: string
  diasDesdeLabel: string
  proxVisitaLabel: string
  temEmendas: boolean
  temObras: boolean
  /** Posição do candidato foco na última pesquisa (ex.: "3º"); "—" se não houver. */
  pesquisaPosicaoLabel: string
  /** Votos projetados (% válidos × total DF 2022 na cidade); "—" sem pesquisa. */
  projPesquisaLabel: string
  /** Proj − Meta (votos); "—" sem pesquisa. */
  expectVsProjLabel: string
  pesquisaTendenciaLabel: string
  pesquisaPctUltimaLabel: string
  pesquisaPctAnteriorLabel: string
}

export type ExpectativaRankingExportTotais = {
  expectativa: number
  peso: number
  populacao: number
  eleitores: number
  comUltimaVisita: number
  comProxVisita: number
  comEmendas: number
  comObras: number
  comPesquisa: number
  projPesquisa: number
  /** Σ Proj − Σ Meta; null se nenhuma cidade com proj. */
  metaVsProjDiff: number | null
}

const HEADERS = [
  'Cidade',
  'Meta',
  'Peso %',
  'Eleitores',
  'População',
  'Emendas',
  'Obras',
  'Pesquisas',
  'Proj. pesquisa',
  'Meta × Pesquisas',
  'Tendência',
  '% anterior',
  'Visitas',
  'Data última visita',
  'Próx. visita',
] as const

let jspdfAutotableApplied = false

function ensureJspdfAutotable(): void {
  if (!jspdfAutotableApplied) {
    applyPlugin(jsPDF)
    jspdfAutotableApplied = true
  }
}

type JsPdfWithAutoTable = InstanceType<typeof jsPDF> & {
  autoTable: (options: UserOptions) => InstanceType<typeof jsPDF>
}

function nomeArquivo(ext: 'csv' | 'xlsx' | 'pdf'): string {
  const dia = new Date().toISOString().slice(0, 10)
  return `ranking-expectativa-${dia}.${ext}`
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cellRow(row: ExpectativaRankingExportRow): (string | number)[] {
  return [
    row.municipio,
    row.expectativa,
    Number(row.peso.toFixed(2)),
    row.eleitores ?? '',
    row.populacao ?? '',
    row.temEmendas ? 'Sim' : 'Não',
    row.temObras ? 'Sim' : 'Não',
    row.pesquisaPosicaoLabel,
    row.projPesquisaLabel,
    row.expectVsProjLabel,
    row.pesquisaTendenciaLabel,
    row.pesquisaPctAnteriorLabel,
    row.diasDesdeLabel,
    row.ultimaVisitaLabel,
    row.proxVisitaLabel,
  ]
}

function totaisRow(
  totais: ExpectativaRankingExportTotais,
  count: number,
): (string | number)[] {
  return [
    `Total (${count})`,
    totais.expectativa,
    Number(totais.peso.toFixed(2)),
    totais.eleitores || '',
    totais.populacao || '',
    `${totais.comEmendas} sim`,
    `${totais.comObras} sim`,
    `${totais.comPesquisa} c/`,
    totais.projPesquisa || '',
    totais.metaVsProjDiff != null
      ? `${totais.metaVsProjDiff > 0 ? '+' : ''}${totais.metaVsProjDiff}`
      : '',
    '',
    '',
    `${totais.comUltimaVisita} com`,
    '',
    `${totais.comProxVisita} com`,
  ]
}

export function exportExpectativaRankingCsv(
  rows: ExpectativaRankingExportRow[],
  totais: ExpectativaRankingExportTotais,
): void {
  const lines = [
    HEADERS.join(','),
    ...rows.map((row) => cellRow(row).map((v) => csvEscape(String(v))).join(',')),
    totaisRow(totais, rows.length)
      .map((v) => csvEscape(String(v)))
      .join(','),
  ]
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  downloadBlob(blob, nomeArquivo('csv'))
}

export function exportExpectativaRankingXlsx(
  rows: ExpectativaRankingExportRow[],
  totais: ExpectativaRankingExportTotais,
): void {
  const aoa: (string | number)[][] = [
    [...HEADERS],
    ...rows.map((row) => cellRow(row)),
    totaisRow(totais, rows.length),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ranking')
  XLSX.writeFile(wb, nomeArquivo('xlsx'))
}

export function exportExpectativaRankingPdf(
  rows: ExpectativaRankingExportRow[],
  totais: ExpectativaRankingExportTotais,
): void {
  ensureJspdfAutotable()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pdf = doc as JsPdfWithAutoTable

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text('War Room · Ranking de expectativa', 14, 14)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.text(
    `${rows.length} município(s) · gerado em ${new Date().toLocaleString('pt-BR')}`,
    14,
    20,
  )

  pdf.autoTable({
    startY: 24,
    head: [HEADERS as unknown as string[]],
    body: [
      ...rows.map((row) => cellRow(row).map(String)),
      totaisRow(totais, rows.length).map(String),
    ],
    styles: {
      fontSize: 6.5,
      cellPadding: 1.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 6.5,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 246],
    },
    margin: { left: 8, right: 8 },
  })

  pdf.save(nomeArquivo('pdf'))
}
