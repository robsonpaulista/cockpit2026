import { jsPDF } from 'jspdf'
import { applyPlugin, type UserOptions } from 'jspdf-autotable'
import { valorExibidoMapaObra } from '@/lib/obras-mapa'
import {
  formatRelatorioBrl,
  formatRelatorioBrlCompact,
  type RelatorioAnoBloco,
  type RelatorioExecutivoMunicipio,
  type RelatorioStatusValor,
} from '@/lib/war-room/relatorio-executivo-municipio'

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

/** Paleta War Room — preto / amarelo / cinza (gelo). */
const BLACK: [number, number, number] = [43, 45, 49] // #2B2D31
const YELLOW: [number, number, number] = [242, 208, 107] // #F2D06B
const GRAY: [number, number, number] = [112, 115, 122] // #70737A
const MUTED: [number, number, number] = [179, 182, 187] // #B3B6BB
const LINE: [number, number, number] = [208, 210, 214] // #D0D2D6
const SOFT: [number, number, number] = [229, 230, 232] // #E5E6E8
const WHITE: [number, number, number] = [255, 255, 255]

type Rgb = [number, number, number]

function slugArquivo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

function finalY(pdf: JsPdfWithAutoTable, fallback: number): number {
  return pdf.lastAutoTable?.finalY ?? fallback
}

function statusPillColors(status: string): { bg: Rgb; fg: Rgb } {
  const s = status
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  if (s.includes('PAGO') || s.includes('EXECUTAD') || s.includes('CONCLUID')) {
    return { bg: [220, 252, 231], fg: [22, 101, 52] }
  }
  if (s.includes('EMPENHAD') || (s.includes('EXECU') && !s.includes('AGUARD'))) {
    return { bg: [255, 237, 213], fg: [154, 52, 18] }
  }
  if (s.includes('AGUARD') && s.includes('EXEC')) {
    return { bg: [237, 233, 254], fg: [91, 33, 182] }
  }
  if (s.includes('AGUARD') || s.includes('INDICAD') || s.includes('PENDENTE')) {
    return { bg: [226, 232, 240], fg: [51, 65, 85] }
  }
  return { bg: SOFT, fg: BLACK }
}

function drawFooter(pdf: JsPdfWithAutoTable, page: number, total: number, cidade: string) {
  const w = pdf.internal.pageSize.getWidth()
  const h = pdf.internal.pageSize.getHeight()
  pdf.setDrawColor(...LINE)
  pdf.line(14, h - 12, w - 14, h - 12)
  pdf.setFontSize(7)
  pdf.setTextColor(...MUTED)
  pdf.setFont('helvetica', 'normal')
  pdf.text(
    `${cidade} · Relatório Executivo · Cockpit 2026 · pág. ${page}/${total}`,
    14,
    h - 7,
  )
}

function pageHead(
  pdf: JsPdfWithAutoTable,
  title: string,
  subtitle: string,
): number {
  const pageW = pdf.internal.pageSize.getWidth()
  pdf.setFillColor(...BLACK)
  pdf.rect(0, 0, pageW, 28, 'F')
  pdf.setFillColor(...YELLOW)
  pdf.rect(0, 0, 3, 28, 'F')

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  const yearLabel = '2026'
  const brandLabel = 'Cockpit '
  const yearW = pdf.getTextWidth(yearLabel)
  pdf.setTextColor(...YELLOW)
  pdf.text(yearLabel, pageW - 14, 10, { align: 'right' })
  pdf.setTextColor(...WHITE)
  pdf.text(brandLabel, pageW - 14 - yearW, 10, { align: 'right' })

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.setTextColor(...WHITE)
  pdf.text(title, 10, 13)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(210, 212, 216)
  const lines = pdf.splitTextToSize(subtitle, pageW - 28)
  pdf.text(lines, 10, 20)
  return 34
}

function estimateAnoCardHeight(ano: RelatorioAnoBloco): number {
  const head = 12
  const pad = 8
  const blockHead = 8
  const rowH = 7
  const gapBlocks = 8
  const emRows = ano.emendasSemRegistro
    ? 1
    : Math.max(1, ano.emendasPorStatus.length)
  const obRows =
    ano.obrasPorStatus.length === 0 ? 1 : Math.max(1, ano.obrasPorStatus.length)
  return (
    head +
    pad +
    blockHead +
    emRows * rowH +
    gapBlocks +
    blockHead +
    obRows * rowH +
    pad
  )
}

function drawStatusRows(
  pdf: JsPdfWithAutoTable,
  rows: RelatorioStatusValor[],
  emptyLabel: string,
  x: number,
  yStart: number,
  width: number,
): number {
  let y = yStart
  if (rows.length === 0) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...MUTED)
    pdf.text(emptyLabel, x, y + 3)
    return y + 7
  }

  for (const row of rows) {
    const colors = statusPillColors(row.status)
    const pillLabel = row.status.length > 22 ? `${row.status.slice(0, 20)}…` : row.status
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(5.5)
    const pillW = Math.min(42, pdf.getTextWidth(pillLabel) + 4)
    pdf.setFillColor(...colors.bg)
    pdf.roundedRect(x, y, pillW, 4.6, 1.2, 1.2, 'F')
    pdf.setTextColor(...colors.fg)
    pdf.text(pillLabel, x + 2, y + 3.2)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6.5)
    pdf.setTextColor(...BLACK)
    const valor =
      row.valor > 0 ? formatRelatorioBrlCompact(row.valor) : formatRelatorioBrlCompact(0)
    pdf.text(valor, x + width, y + 3.2, { align: 'right' })
    y += 7
  }
  return y
}

function drawAnoCard(
  pdf: JsPdfWithAutoTable,
  ano: RelatorioAnoBloco,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  pdf.setDrawColor(...LINE)
  pdf.setFillColor(...WHITE)
  pdf.roundedRect(x, y, width, height, 2.5, 2.5, 'FD')

  pdf.setFillColor(...BLACK)
  pdf.roundedRect(x, y, width, 11, 2.5, 2.5, 'F')
  pdf.rect(x, y + 6, width, 5, 'F')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(...WHITE)
  pdf.text(String(ano.ano), x + width / 2, y + 7.2, { align: 'center' })

  let cy = y + 14
  const innerX = x + 4
  const innerW = width - 8

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(6.5)
  pdf.setTextColor(...BLACK)
  pdf.text('EMENDAS FEDERAIS', innerX, cy)
  const emTotal = ano.emendasSemRegistro
    ? 'SEM REGISTROS'
    : formatRelatorioBrl(ano.emendasTotal)
  pdf.setFontSize(6)
  pdf.text(emTotal, innerX + innerW, cy, { align: 'right' })
  cy += 2
  pdf.setDrawColor(...LINE)
  pdf.line(innerX, cy, innerX + innerW, cy)
  cy += 3

  cy = drawStatusRows(
    pdf,
    ano.emendasSemRegistro ? [] : ano.emendasPorStatus,
    'Sem registros no período.',
    innerX,
    cy,
    innerW,
  )

  cy += 3
  pdf.setDrawColor(...LINE)
  pdf.line(innerX, cy, innerX + innerW, cy)
  cy += 5

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(6.5)
  pdf.setTextColor(...BLACK)
  pdf.text('OBRAS E AÇÕES', innerX, cy)
  const obTotal =
    ano.obrasPorStatus.length === 0
      ? 'SEM REGISTROS'
      : ano.obrasSemValor && ano.obrasTotal === 0
        ? 'SEM VALOR'
        : formatRelatorioBrl(ano.obrasTotal)
  pdf.setFontSize(6)
  pdf.text(obTotal, innerX + innerW, cy, { align: 'right' })
  cy += 2
  pdf.setDrawColor(...LINE)
  pdf.line(innerX, cy, innerX + innerW, cy)
  cy += 3

  drawStatusRows(
    pdf,
    ano.obrasPorStatus,
    'Sem registros no período.',
    innerX,
    cy,
    innerW,
  )
}

/**
 * PDF completo do Relatório Executivo municipal (modelo Teresina):
 * Capa · Emendas · Obras · Acervo.
 */
export function exportRelatorioExecutivoPdf(
  data: RelatorioExecutivoMunicipio,
): void {
  ensureJspdfAutotable()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pdf = doc as JsPdfWithAutoTable
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const cidade = data.municipio
  const cidadeUp = cidade.toUpperCase()

  // ─── Página 1 · Capa ───────────────────────────────────────────────
  let y = pageHead(
    pdf,
    `${cidadeUp} | RELATÓRIO EXECUTIVO`,
    'Emendas federais e obras/ações — valores apresentados separadamente para evitar dupla contagem.',
  )

  const cardW = (pageW - 28 - 8) / 2
  pdf.setFillColor(...SOFT)
  pdf.setDrawColor(...LINE)
  pdf.roundedRect(14, y, cardW, 28, 2, 2, 'FD')
  pdf.roundedRect(14 + cardW + 8, y, cardW, 28, 2, 2, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.setTextColor(...BLACK)
  pdf.text(formatRelatorioBrl(data.emendasTotalIndicado), 18, y + 12)
  pdf.text(formatRelatorioBrl(data.obrasValorMapeado), 18 + cardW + 8, y + 12)

  pdf.setFontSize(8)
  pdf.setTextColor(...GRAY)
  pdf.text('EMENDAS FEDERAIS', 18, y + 18)
  pdf.text('OBRAS E AÇÕES', 18 + cardW + 8, y + 18)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(...MUTED)
  pdf.text(
    `Valor indicado · ${data.emendasCount} registro${data.emendasCount === 1 ? '' : 's'}`,
    18,
    y + 23,
  )
  pdf.text(
    `Com valor informado · ${data.obrasCount} registro${data.obrasCount === 1 ? '' : 's'}`,
    18 + cardW + 8,
    y + 23,
  )

  y += 36
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(...BLACK)
  pdf.text('POR ANO › STATUS (EMENDAS E OBRAS SEPARADAS)', 14, y)
  y += 6

  if (data.porAno.length === 0) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...MUTED)
    pdf.text('Sem registros no município.', 14, y + 4)
    y += 10
  } else {
    const cols = Math.min(3, data.porAno.length)
    const gap = 4
    const anoCardW = (pageW - 28 - gap * (cols - 1)) / cols

    for (let i = 0; i < data.porAno.length; i += cols) {
      const slice = data.porAno.slice(i, i + cols)
      const rowH = Math.max(...slice.map(estimateAnoCardHeight))
      if (y + rowH > pageH - 36) {
        pdf.addPage()
        y = 16
      }
      slice.forEach((ano, idx) => {
        const x = 14 + idx * (anoCardW + gap)
        drawAnoCard(pdf, ano, x, y, anoCardW, rowH)
      })
      y += rowH + 5
    }
  }

  if (y > pageH - 40) {
    pdf.addPage()
    y = 16
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(...BLACK)
  pdf.text('BLOCOS', 14, y + 2)
  y += 6

  const blocos = [
    `BLOCO 01 — Emendas federais (${data.emendasCount})`,
    `BLOCO 02 — Obras e ações (${data.obrasCount})`,
    `BLOCO 03 — Acervo (${data.acervo.length > 0 ? data.acervo.length : 'a preencher'})`,
  ]
  const blocoW = (pageW - 28 - 8) / 3
  blocos.forEach((b, i) => {
    const x = 14 + i * (blocoW + 4)
    pdf.setFillColor(...SOFT)
    pdf.setDrawColor(...LINE)
    pdf.roundedRect(x, y, blocoW, 12, 2, 2, 'FD')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.5)
    pdf.setTextColor(...BLACK)
    const lines = pdf.splitTextToSize(b, blocoW - 6)
    pdf.text(lines, x + 3, y + 5)
  })
  y += 18

  pdf.setFontSize(7)
  pdf.setTextColor(...MUTED)
  pdf.text(
    pdf.splitTextToSize(
      'Emendas e obras não são somadas entre si para evitar dupla contagem de um mesmo investimento.',
      pageW - 28,
    ),
    14,
    y,
  )

  // ─── Página 2 · Emendas ────────────────────────────────────────────
  pdf.addPage()
  y = pageHead(
    pdf,
    `${cidadeUp} | EMENDAS FEDERAIS`,
    `${data.emendasCount} registro(s) · Indicado: ${formatRelatorioBrl(data.emendasTotais.indicado)}`,
  )

  const kpiW = (pageW - 28 - 12) / 3
  const kpis = [
    { label: 'INDICADOS', value: formatRelatorioBrl(data.emendasTotais.indicado) },
    { label: 'EMPENHADOS', value: formatRelatorioBrl(data.emendasTotais.empenhado) },
    { label: 'PAGOS', value: formatRelatorioBrl(data.emendasTotais.pago) },
  ]
  kpis.forEach((k, i) => {
    const x = 14 + i * (kpiW + 6)
    pdf.setFillColor(...SOFT)
    pdf.setDrawColor(...LINE)
    pdf.roundedRect(x, y, kpiW, 18, 2, 2, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...BLACK)
    pdf.text(k.value, x + 3, y + 8)
    pdf.setFontSize(7)
    pdf.setTextColor(...MUTED)
    pdf.text(k.label, x + 3, y + 14)
  })
  y += 24

  pdf.autoTable({
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['ANO', 'EMENDA', 'OBJETO', 'INDICADO', 'EMPENHADO', 'PAGO', 'STATUS']],
    body:
      data.emendas.length === 0
        ? [['—', 'Sem emendas', '—', '—', '—', '—', '—']]
        : data.emendas.map((row) => [
            row.exercicio ?? '—',
            row.emenda,
            row.objeto,
            row.indicado > 0 ? formatRelatorioBrl(row.indicado) : '—',
            row.empenhado > 0 ? formatRelatorioBrl(row.empenhado) : '—',
            row.pago > 0 ? formatRelatorioBrl(row.pago) : '—',
            row.status,
          ]),
    styles: { fontSize: 6.5, cellPadding: 1.2, overflow: 'linebreak' },
    headStyles: { fillColor: BLACK, textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 38 },
      2: { cellWidth: 52 },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 18 },
    },
  })
  y = finalY(pdf, y) + 8

  if (data.leiturasRapidas.length > 0) {
    if (y > pageH - 55) {
      pdf.addPage()
      y = 16
    }
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...BLACK)
    pdf.text('TERMOS QUE A AGÊNCIA PRECISA SABER', 14, y)
    y += 6

    const n = data.leiturasRapidas.length
    const gap = 4
    const cardW = (pageW - 28 - gap * (n - 1)) / n
    const cardH = 32
    data.leiturasRapidas.forEach((l, i) => {
      const x = 14 + i * (cardW + gap)
      pdf.setFillColor(250, 250, 249)
      pdf.setDrawColor(...LINE)
      pdf.roundedRect(x, y, cardW, cardH, 2, 2, 'FD')

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7.5)
      pdf.setTextColor(...BLACK)
      pdf.text(l.titulo, x + 3, y + 6)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(6)
      pdf.setTextColor(...GRAY)
      const lines = pdf.splitTextToSize(l.texto, cardW - 6)
      pdf.text(lines.slice(0, 5), x + 3, y + 11)
    })
    y += cardH + 6
  }

  // ─── Página 3 · Obras ──────────────────────────────────────────────
  pdf.addPage()
  y = pageHead(
    pdf,
    `${cidadeUp} | OBRAS, ENTREGAS E AÇÕES`,
    `${data.obrasKpis.registros} registro(s) · Total informado: ${formatRelatorioBrl(data.obrasKpis.valorMapeado)}`,
  )

  const ok = data.obrasKpis
  const obraKpis = [
    { label: 'REGISTROS', value: String(ok.registros) },
    { label: 'VALOR MAPEADO', value: formatRelatorioBrl(ok.valorMapeado) },
    { label: 'EXECUTADAS', value: String(ok.acoesExecutadas) },
    { label: 'EM EXECUÇÃO', value: String(ok.emExecucao) },
    { label: 'AGUARDANDO', value: String(ok.aguardando) },
  ]
  const okW = (pageW - 28 - 16) / 5
  obraKpis.forEach((k, i) => {
    const x = 14 + i * (okW + 4)
    pdf.setFillColor(...SOFT)
    pdf.setDrawColor(...LINE)
    pdf.roundedRect(x, y, okW, 18, 2, 2, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(...BLACK)
    const valLines = pdf.splitTextToSize(k.value, okW - 4)
    pdf.text(valLines, x + 2, y + 7)
    pdf.setFontSize(5.5)
    pdf.setTextColor(...MUTED)
    pdf.text(k.label, x + 2, y + 15)
  })
  y += 24

  if (data.obrasPorTipo.length === 0) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...MUTED)
    pdf.text('Nenhuma obra/ação neste município.', 14, y)
  } else {
    for (const bloco of data.obrasPorTipo) {
      if (y > pageH - 45) {
        pdf.addPage()
        y = 16
      }
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(...BLACK)
      pdf.text(
        `${bloco.tipoLabel.toUpperCase()} — ${bloco.count} registro(s) | ${formatRelatorioBrl(bloco.valor)}`,
        14,
        y,
      )
      y += 3

      pdf.autoTable({
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['STATUS', 'OBRA / AÇÃO', 'VALOR']],
        body: bloco.obras.map((obra) => {
          const valor = valorExibidoMapaObra(obra)
          return [
            (obra.status ?? 'SEM STATUS').trim().toUpperCase() || 'SEM STATUS',
            obra.obra?.trim() || obra.tipo?.trim() || 'Sem título',
            valor != null && valor > 0 ? formatRelatorioBrl(valor) : 'SEM VALOR',
          ]
        }),
        styles: { fontSize: 7, cellPadding: 1.2, overflow: 'linebreak' },
        headStyles: { fillColor: BLACK, textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
        columnStyles: {
          0: { cellWidth: 36 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 28, halign: 'right' },
        },
      })
      y = finalY(pdf, y) + 7
    }
  }

  // ─── Página 4 · Acervo ─────────────────────────────────────────────
  pdf.addPage()
  y = pageHead(
    pdf,
    `${cidadeUp} | ACERVO FOTOGRÁFICO E DOCUMENTAÇÃO`,
    'Links do repositório (Drive/pasta) · clicáveis no PDF · Bloco 03 — Comunicação',
  )

  if (data.acervo.length === 0) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(...BLACK)
    pdf.text('Acervo — a preencher', 14, y + 4)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...MUTED)
    pdf.text(
      pdf.splitTextToSize(
        'Quando houver links de plano no Drive nas obras do município, eles aparecem neste bloco.',
        pageW - 28,
      ),
      14,
      y + 10,
    )
  } else {
    const acervoRows = data.acervo
    pdf.autoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['TÍTULO', 'STATUS', 'LINK / ACERVO']],
      body: acervoRows.map((item) => [
        item.titulo,
        item.status,
        item.driveUrl
          ? item.driveName || 'Abrir repositório'
          : 'SEM LINK',
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.4, overflow: 'linebreak' },
      headStyles: { fillColor: BLACK, textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 36 },
        2: { cellWidth: 'auto', textColor: GRAY },
      },
      didDrawCell: (hookData) => {
        if (hookData.section !== 'body' || hookData.column.index !== 2) return
        const item = acervoRows[hookData.row.index]
        const url = item?.driveUrl?.trim()
        if (!url) return
        // Hiperlink clicável no PDF (abre o repositório)
        pdf.link(
          hookData.cell.x,
          hookData.cell.y,
          hookData.cell.width,
          hookData.cell.height,
          { url },
        )
        pdf.setDrawColor(...BLACK)
        pdf.setLineWidth(0.2)
        const underlineY = hookData.cell.y + hookData.cell.height - 1.2
        pdf.line(
          hookData.cell.x + 1.2,
          underlineY,
          hookData.cell.x + Math.min(hookData.cell.width - 2.4, 42),
          underlineY,
        )
      },
    })
    y = finalY(pdf, y) + 8

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...BLACK)
    pdf.text('RELAÇÃO COM O BLOCO DE OBRAS E AÇÕES', 14, y)
    y += 3
    pdf.autoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['AÇÃO / OBRA', 'STATUS']],
      body: acervoRows.map((item) => [item.titulo, item.status]),
      styles: { fontSize: 7.5, cellPadding: 1.3 },
      headStyles: { fillColor: BLACK, textColor: 255, fontStyle: 'bold' },
    })
  }

  const totalPages = pdf.getNumberOfPages()
  for (let p = 1; p <= totalPages; p += 1) {
    pdf.setPage(p)
    drawFooter(pdf, p, totalPages, cidade)
  }

  const dia = new Date().toISOString().slice(0, 10)
  pdf.save(`relatorio-executivo-${slugArquivo(cidade)}-${dia}.pdf`)
}
