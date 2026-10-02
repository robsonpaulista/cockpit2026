/**
 * PDF profissional — Termômetro · Guia Cobertura · aba Anexo.
 * Inclui header, KPIs e card de peso eleitoral (elementos gerais da página)
 * + tabela de municípios sem cobertura válida.
 */

import { jsPDF } from 'jspdf'
import { applyPlugin, type UserOptions } from 'jspdf-autotable'
import {
  formatMeta,
  formatPeso,
  formatProximaAgendaLabel,
  formatUltimaVisitaLabel,
  type CoberturaVisitasTdModel,
} from '@/lib/war-room/cobertura-visitas-td'

let jspdfAutotableApplied = false

function ensureJspdfAutotable(): void {
  if (!jspdfAutotableApplied) {
    applyPlugin(jsPDF)
    jspdfAutotableApplied = true
  }
}

type JsPdfWithAutoTable = InstanceType<typeof jsPDF> & {
  autoTable: (options: UserOptions) => InstanceType<typeof jsPDF>
  lastAutoTable?: { finalY: number }
}

/** Paleta CX (Termômetro / cobertura). */
const INK: [number, number, number] = [20, 22, 26] // #14161a
const AMBER: [number, number, number] = [232, 168, 37] // #e8a825
const MUTED: [number, number, number] = [104, 104, 101] // #686865
const LINE: [number, number, number] = [232, 232, 230] // #e8e8e6
const SOFT: [number, number, number] = [245, 245, 243]
const WHITE: [number, number, number] = [255, 255, 255]
const BAD: [number, number, number] = [196, 196, 192] // #c4c4c0
const TEXT: [number, number, number] = [32, 32, 30]

const M = 12

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

function nomeArquivo(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `cobertura-anexo-sem-cobertura-${y}${m}${day}.pdf`
}

function finalY(pdf: JsPdfWithAutoTable, fallback: number): number {
  return pdf.lastAutoTable?.finalY ?? fallback
}

function drawPageFooter(pdf: JsPdfWithAutoTable, page: number, total: number): void {
  const w = pdf.internal.pageSize.getWidth()
  const h = pdf.internal.pageSize.getHeight()
  pdf.setDrawColor(...LINE)
  pdf.line(M, h - 10, w - M, h - 10)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(...MUTED)
  pdf.text(
    `Termômetro · Guia Cobertura · Anexo · Cockpit 2026 · pág. ${page}/${total}`,
    M,
    h - 5.5,
  )
}

function drawHero(pdf: JsPdfWithAutoTable, model: CoberturaVisitasTdModel): number {
  const pageW = pdf.internal.pageSize.getWidth()
  const heroH = 26

  pdf.setFillColor(...INK)
  pdf.rect(0, 0, pageW, heroH, 'F')
  pdf.setFillColor(...AMBER)
  pdf.rect(0, 0, 3.2, heroH, 'F')

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  const yearLabel = '2026'
  const brandLabel = 'Cockpit '
  const yearW = pdf.getTextWidth(yearLabel)
  pdf.setTextColor(...AMBER)
  pdf.text(yearLabel, pageW - M, 9, { align: 'right' })
  pdf.setTextColor(...WHITE)
  pdf.text(brandLabel, pageW - M - yearW, 9, { align: 'right' })

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.setTextColor(...WHITE)
  pdf.text('Cobertura por território', M + 2, 12)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(210, 210, 206)
  pdf.text(
    `${model.cidadesRanking} cidades · ${model.territorios.length} TDs · atualizado em ${model.atualizadoEm}`,
    M + 2,
    19.5,
  )

  return heroH + 6
}

function drawKpis(pdf: JsPdfWithAutoTable, model: CoberturaVisitasTdModel, y0: number): number {
  const pageW = pdf.internal.pageSize.getWidth()
  const gap = 3.5
  const cards = 4
  const cardW = (pageW - M * 2 - gap * (cards - 1)) / cards
  const cardH = 22

  const items: Array<{ label: string; value: string; hint: string }> = [
    {
      label: 'Cidades no ranking',
      value: String(model.cidadesRanking),
      hint: `${model.cidadesRanking} municípios mapeados`,
    },
    {
      label: `Cobertas (≤${model.janelaDias} dias)`,
      value: String(model.cobertas),
      hint: `${formatPeso(model.pesoCobertasPct)} do peso total`,
    },
    {
      label: 'Agendadas',
      value: String(model.agendadas),
      hint: 'fora do prazo ou nunca, com data marcada',
    },
    {
      label: 'Sem cobertura',
      value: String(model.semCobertura),
      hint: `${formatPeso(model.pesoSemCoberturaPct)} · ${formatMeta(model.eleitoresSemCobertura)} eleitores`,
    },
  ]

  items.forEach((item, i) => {
    const x = M + i * (cardW + gap)
    pdf.setFillColor(...WHITE)
    pdf.setDrawColor(...LINE)
    pdf.roundedRect(x, y0, cardW, cardH, 1.5, 1.5, 'FD')
    pdf.setFillColor(...AMBER)
    pdf.rect(x, y0 + cardH - 1.4, cardW, 1.4, 'F')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6.5)
    pdf.setTextColor(...MUTED)
    pdf.text(item.label.toUpperCase(), x + 3, y0 + 5.5)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.setTextColor(...INK)
    pdf.text(item.value, x + 3, y0 + 13)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.5)
    pdf.setTextColor(...MUTED)
    const hintLines = pdf.splitTextToSize(item.hint, cardW - 6)
    pdf.text(hintLines.slice(0, 2), x + 3, y0 + 17.5)
  })

  return y0 + cardH + 6
}

function drawWeightCard(
  pdf: JsPdfWithAutoTable,
  model: CoberturaVisitasTdModel,
  y0: number,
): number {
  const pageW = pdf.internal.pageSize.getWidth()
  const innerW = pageW - M * 2
  const barOk = Math.max(0, Math.min(100, model.pesoCobertasPct))
  const barWarn = Math.max(0, Math.min(100 - barOk, model.pesoAgendadasPct))
  const barBad = Math.max(0, 100 - barOk - barWarn)

  const note = `Janela de cobertura: ${model.janelaDias} dias. Uma cidade só conta como “visitada” se a última visita ocorreu nos últimos ${model.janelaDias} dias (a partir de ${model.atualizadoEm} — visitas antes de ${model.cutoffLabel} não contam). Cidade com visita mais antiga que isso entra em “Sem cobertura”, a menos que já tenha uma próxima visita agendada, caso em que entra em “Agendada”. Os Territórios de Desenvolvimento seguem a divisão oficial do Governo do Piauí (12 territórios, 224 municípios no total; ${model.cidadesRanking} constam neste ranking).`
  const noteLines = pdf.splitTextToSize(note, innerW - 10)
  const cardH = 14 + 8 + 18 + noteLines.length * 3.2 + 8

  pdf.setFillColor(...WHITE)
  pdf.setDrawColor(...LINE)
  pdf.roundedRect(M, y0, innerW, cardH, 2, 2, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(...INK)
  pdf.text(
    `Peso eleitoral coberto x descoberto — cobertura válida por ${model.janelaDias} dias`,
    M + 5,
    y0 + 7,
  )

  const barY = y0 + 11
  const barH = 5
  const barX = M + 5
  const barW = innerW - 10
  pdf.setFillColor(...SOFT)
  pdf.roundedRect(barX, barY, barW, barH, 1, 1, 'F')

  let cx = barX
  const segOk = (barOk / 100) * barW
  const segWarn = (barWarn / 100) * barW
  const segBad = (barBad / 100) * barW
  if (segOk > 0) {
    pdf.setFillColor(...AMBER)
    pdf.rect(cx, barY, segOk, barH, 'F')
    cx += segOk
  }
  if (segWarn > 0) {
    pdf.setFillColor(...INK)
    pdf.rect(cx, barY, segWarn, barH, 'F')
    cx += segWarn
  }
  if (segBad > 0) {
    pdf.setFillColor(...BAD)
    pdf.rect(cx, barY, Math.max(0, barX + barW - cx), barH, 'F')
  }

  const legendY = barY + barH + 6
  const legends: Array<{ color: [number, number, number]; text: string }> = [
    {
      color: AMBER,
      text: `Visitadas (dentro de ${model.janelaDias} dias) — ${formatPeso(model.pesoCobertasPct)} do peso`,
    },
    {
      color: INK,
      text: `Agendadas — ${formatPeso(model.pesoAgendadasPct)} do peso`,
    },
    {
      color: BAD,
      text: `Sem cobertura — ${formatPeso(model.pesoSemCoberturaPct)} do peso`,
    },
  ]

  let lx = barX
  legends.forEach((leg) => {
    pdf.setFillColor(...leg.color)
    pdf.circle(lx + 1.5, legendY - 1, 1.3, 'F')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...TEXT)
    pdf.text(leg.text, lx + 4.5, legendY)
    lx += pdf.getTextWidth(leg.text) + 14
  })

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6.5)
  pdf.setTextColor(...MUTED)
  pdf.text(noteLines, M + 5, legendY + 6)

  return y0 + cardH + 6
}

/**
 * Gera e baixa o PDF do Anexo (com header, KPIs e peso eleitoral da página).
 */
export function exportCoberturaAnexoPdf(model: CoberturaVisitasTdModel): void {
  ensureJspdfAutotable()
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  }) as JsPdfWithAutoTable

  let y = drawHero(pdf, model)
  y = drawKpis(pdf, model, y)
  y = drawWeightCard(pdf, model, y)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(...INK)
  pdf.text('Anexo · Sem cobertura válida', M, y + 2)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...MUTED)
  const anexoSub = `${model.anexoSemCobertura.length} municípios sem visita nos últimos ${model.janelaDias} dias${
    model.agendadas > 0 ? ` · ${model.agendadas} com próxima visita agendada` : ''
  } · por peso eleitoral`
  pdf.text(anexoSub, M, y + 7)
  y += 10

  const head = [
    '#',
    'Município',
    'Território',
    'Meta',
    'Peso %',
    'Eleitores',
    'Última visita',
    'Próxima visita',
  ]
  const body = model.anexoSemCobertura.map((c, i) => [
    String(i + 1),
    c.municipio,
    c.territorio ?? '—',
    formatMeta(c.meta),
    formatPeso(c.pesoPct),
    formatMeta(c.eleitores),
    formatUltimaVisitaLabel(c),
    formatProximaAgendaLabel(c),
  ])

  const totalMeta = model.anexoSemCobertura.reduce((s, c) => s + c.meta, 0)
  const totalPeso = model.anexoSemCobertura.reduce((s, c) => s + c.pesoPct, 0)
  const totalEleitores = model.anexoSemCobertura.reduce((s, c) => s + c.eleitores, 0)
  const foot = [
    [
      '',
      `Total · ${model.anexoSemCobertura.length} cidades`,
      '',
      formatMeta(totalMeta),
      formatPeso(totalPeso),
      formatMeta(totalEleitores),
      '',
      '',
    ],
  ]

  pdf.autoTable({
    startY: y,
    head: [head],
    body,
    foot,
    showFoot: 'lastPage',
    margin: { left: M, right: M, top: 14, bottom: 14 },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
      textColor: TEXT,
      lineColor: LINE,
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: INK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'left',
    },
    footStyles: {
      fillColor: SOFT,
      textColor: INK,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [252, 252, 250],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 42 },
      2: { cellWidth: 48 },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 36 },
      7: { cellWidth: 36 },
    },
    didDrawPage: (data) => {
      // Header strip only on page 1 (already drawn); on later pages a slim bar
      if (data.pageNumber > 1) {
        const pageW = pdf.internal.pageSize.getWidth()
        pdf.setFillColor(...INK)
        pdf.rect(0, 0, pageW, 10, 'F')
        pdf.setFillColor(...AMBER)
        pdf.rect(0, 0, 3.2, 10, 'F')
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8)
        pdf.setTextColor(...WHITE)
        pdf.text('Cobertura por território · Anexo', M + 2, 6.5)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7)
        pdf.setTextColor(...AMBER)
        pdf.text('Cockpit 2026', pageW - M, 6.5, { align: 'right' })
      }
    },
  })

  // Force finalY usage so TS doesn't complain about unused helper in edge cases
  void finalY(pdf, y)

  const totalPages = pdf.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p)
    drawPageFooter(pdf, p, totalPages)
  }

  const blob = pdf.output('blob')
  downloadBlob(blob, nomeArquivo())
}
