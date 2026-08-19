import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { applyPlugin, type UserOptions } from 'jspdf-autotable'

export type ExpectativaRankingExportVisao = 'politica' | 'digital'

export type ExpectativaRankingExportRow = {
  municipio: string
  expectativa: number
  peso: number
  populacao: number | null
  eleitores: number | null
  /** Seguidores Instagram (API); null = fora do top / sem dado. */
  seguidores: number | null
  seguidoresLabel: string
  /** Posts com cidade na legenda (últimos 30 dias). */
  postsLegenda: number | null
  postsLegendaEngajamento: number
  /** Engajamento médio por post (legenda). */
  postsLegendaEngMedio: number | null
  /** Contas engajadas (API); null = fora do top / sem dado. */
  engajados: number | null
  engajadosLabel: string
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
  seguidores: number
  comSeguidores: number
  postsLegenda: number
  comPostsLegenda: number
  postsLegendaEngajamento: number
  /** Média ponderada Σ eng ÷ Σ posts. */
  postsLegendaEngMedio: number
  engajados: number
  comEngajados: number
  comUltimaVisita: number
  comProxVisita: number
  comEmendas: number
  comObras: number
  comPesquisa: number
  projPesquisa: number
  /** Σ Proj − Σ Meta; null se nenhuma cidade com proj. */
  metaVsProjDiff: number | null
}

const HEADERS_POLITICA = [
  'Cidade',
  'Meta',
  'Peso %',
  'Eleitores',
  'População',
  'Pesquisas',
  'Proj. pesquisa',
  'Meta × Pesquisas',
  'Emendas',
  'Obras',
  'Tendência',
  '% anterior',
  'Visitas',
  'Data última visita',
  'Próx. visita',
] as const

const HEADERS_DIGITAL = [
  'Cidade',
  'Meta',
  'Peso %',
  'Eleitores',
  'Seguidores',
  'Posts (legenda)',
  'ENG.MÉD.LEG',
  'Engajados (API)',
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

function nomeArquivo(
  ext: 'csv' | 'xlsx' | 'pdf',
  visao: ExpectativaRankingExportVisao,
  periodDays?: number,
): string {
  const dia = new Date().toISOString().slice(0, 10)
  const periodo =
    visao === 'digital' && periodDays != null && periodDays > 0
      ? `-${periodDays}d`
      : ''
  return `ranking-cidades-${visao}${periodo}-${dia}.${ext}`
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

function headersFor(visao: ExpectativaRankingExportVisao): readonly string[] {
  return visao === 'digital' ? HEADERS_DIGITAL : HEADERS_POLITICA
}

function cellRow(
  row: ExpectativaRankingExportRow,
  visao: ExpectativaRankingExportVisao,
): (string | number)[] {
  if (visao === 'digital') {
    return [
      row.municipio,
      row.expectativa,
      Number(row.peso.toFixed(2)),
      row.eleitores ?? '',
      row.seguidores ?? row.seguidoresLabel,
      row.postsLegenda ?? '',
      row.postsLegendaEngMedio ?? '',
      row.engajados ?? row.engajadosLabel,
    ]
  }
  return [
    row.municipio,
    row.expectativa,
    Number(row.peso.toFixed(2)),
    row.eleitores ?? '',
    row.populacao ?? '',
    row.pesquisaPosicaoLabel,
    row.projPesquisaLabel,
    row.expectVsProjLabel,
    row.temEmendas ? 'Sim' : 'Não',
    row.temObras ? 'Sim' : 'Não',
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
  visao: ExpectativaRankingExportVisao,
): (string | number)[] {
  if (visao === 'digital') {
    return [
      `Total (${count})`,
      totais.expectativa,
      Number(totais.peso.toFixed(2)),
      totais.eleitores || '',
      totais.seguidores || '',
      totais.postsLegenda || '',
      totais.postsLegendaEngMedio || '',
      totais.engajados || '',
    ]
  }
  return [
    `Total (${count})`,
    totais.expectativa,
    Number(totais.peso.toFixed(2)),
    totais.eleitores || '',
    totais.populacao || '',
    `${totais.comPesquisa} c/`,
    totais.projPesquisa || '',
    totais.metaVsProjDiff != null
      ? `${totais.metaVsProjDiff > 0 ? '+' : ''}${totais.metaVsProjDiff}`
      : '',
    `${totais.comEmendas} sim`,
    `${totais.comObras} sim`,
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
  visao: ExpectativaRankingExportVisao = 'politica',
  periodDays?: number,
): void {
  const headers = headersFor(visao)
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      cellRow(row, visao)
        .map((v) => csvEscape(String(v)))
        .join(','),
    ),
    totaisRow(totais, rows.length, visao)
      .map((v) => csvEscape(String(v)))
      .join(','),
  ]
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  downloadBlob(blob, nomeArquivo('csv', visao, periodDays))
}

export function exportExpectativaRankingXlsx(
  rows: ExpectativaRankingExportRow[],
  totais: ExpectativaRankingExportTotais,
  visao: ExpectativaRankingExportVisao = 'politica',
  periodDays?: number,
): void {
  const headers = headersFor(visao)
  const aoa: (string | number)[][] = [
    [...headers],
    ...rows.map((row) => cellRow(row, visao)),
    totaisRow(totais, rows.length, visao),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] =
    visao === 'digital'
      ? [
          { wch: 22 },
          { wch: 12 },
          { wch: 10 },
          { wch: 12 },
          { wch: 12 },
          { wch: 14 },
          { wch: 16 },
          { wch: 14 },
        ]
      : [
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
  XLSX.utils.book_append_sheet(wb, ws, visao === 'digital' ? 'Digital' : 'Politica')
  XLSX.writeFile(wb, nomeArquivo('xlsx', visao, periodDays))
}

export function exportExpectativaRankingPdf(
  rows: ExpectativaRankingExportRow[],
  totais: ExpectativaRankingExportTotais,
  visao: ExpectativaRankingExportVisao = 'politica',
  periodDays?: number,
): void {
  ensureJspdfAutotable()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pdf = doc as JsPdfWithAutoTable
  const headers = headersFor(visao)

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text(
    visao === 'digital'
      ? `War Room · Cidades · Digital${periodDays ? ` · ${periodDays}d` : ''}`
      : 'War Room · Cidades · Política',
    14,
    14,
  )
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.text(
    `${rows.length} município(s) · gerado em ${new Date().toLocaleString('pt-BR')}`,
    14,
    20,
  )

  pdf.autoTable({
    startY: 24,
    head: [headers as unknown as string[]],
    body: [
      ...rows.map((row) => cellRow(row, visao).map(String)),
      totaisRow(totais, rows.length, visao).map(String),
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

  pdf.save(nomeArquivo('pdf', visao, periodDays))
}
