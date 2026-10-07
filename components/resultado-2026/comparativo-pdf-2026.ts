import { jsPDF } from 'jspdf'
import autoTable, { type CellDef, type CellHookData, type RowInput, type Styles } from 'jspdf-autotable'
import {
  formatarPct2026,
  formatarVotos2026,
  type LinhaArvore2026,
  type NivelArvore2026,
  type ResultadoSecao2026Candidato,
  type ResultadoSecao2026Meta,
  type ResumoComparativo2026,
} from '@/lib/resultado-secao-2026'
import {
  COR,
  MARGEM,
  desenharCabecalho,
  desenharFaixaSuperior,
  ferramentasPdf,
  numerarPaginas,
  rgb,
  slugEscopo,
  type Rgb,
} from './pdf-base-2026'
import { NIVEL_ARVORE_ROTULO, abreviarCargo, corCandidato, nomeProprio, rotuloCorrelacao } from './tse-ui'

export type ModoPdfComparativo = 'tela' | 'completo'

export type OpcoesComparativoPdf2026 = {
  meta: ResultadoSecao2026Meta
  candidatos: ResultadoSecao2026Candidato[]
  resumo: ResumoComparativo2026
  linhas: LinhaArvore2026[]
  escopoLabel: string
  qtdRaiz: number
  comMunicipio: boolean
  ordemLabel: string
  busca: string
  modo: ModoPdfComparativo
}

const FUNDO_NIVEL: Record<NivelArvore2026, Rgb> = {
  municipio: rgb('#FBFAF3'),
  bairro: rgb('#FDFDFB'),
  local: COR.branco,
  zona: COR.branco,
  secao: COR.branco,
}

const FONTE_NIVEL: Record<NivelArvore2026, { tam: number; estilo: 'bold' | 'normal'; cor: Rgb; caixaAlta: boolean }> = {
  municipio: { tam: 8, estilo: 'bold', cor: COR.text, caixaAlta: true },
  bairro: { tam: 8, estilo: 'bold', cor: COR.text, caixaAlta: true },
  local: { tam: 7.5, estilo: 'bold', cor: COR.text, caixaAlta: true },
  zona: { tam: 7.5, estilo: 'normal', cor: COR.text, caixaAlta: false },
  secao: { tam: 7, estilo: 'normal', cor: COR.muted, caixaAlta: false },
}

const PAD_V = 1.3
const FONTE_DETALHE = 6.5
const RESERVA_CHIP = 14
const RESERVA_NUMERO = 13

const alturaLinha = (tamPt: number): number => (tamPt * 1.15 * 25.4) / 72
const recuo = (profundidade: number): number => 2 + profundidade * 4

type LinhaPreparada = {
  linha: LinhaArvore2026
  aberto: boolean
  nomeLinhas: string[]
  detalheLinhas: string[]
  altura: number
}

export function montarComparativoPdf2026(o: OpcoesComparativoPdf2026): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const W = doc.internal.pageSize.getWidth()
  const n = o.candidatos.length
  const cores = o.candidatos.map((_, i) => rgb(corCandidato(i)))
  const totalGeral = o.resumo.totais.reduce((a, b) => a + b, 0)
  const fonteDados = o.candidatos[0]?.fonte ?? ''
  const { preencher, contorno, tinta, fonte, pilula, barra, barraEmpilhada: empilhada } = ferramentasPdf(doc)
  const barraEmpilhada = (x: number, y: number, w: number, h: number, valores: number[]) =>
    empilhada(x, y, w, h, valores, cores)

  const descricao = [
    o.escopoLabel,
    `Ordenação: ${o.ordemLabel}`,
    o.busca ? `Busca: "${o.busca}"` : null,
    o.modo === 'completo' ? 'Árvore completa até seções' : 'Árvore como exibida na tela',
  ]
    .filter((t): t is string => Boolean(t))
    .join('  ·  ')
  let y = desenharCabecalho(doc, { titulo: 'Comparativo por local', descricao, fonteDados, meta: o.meta })

  // Cards dos candidatos
  const colunasCards = n === 4 ? 4 : n > 2 ? 3 : 2
  const gap = 4
  const cw = (W - 2 * MARGEM - gap * (colunasCards - 1)) / colunasCards
  const ch = 40
  o.candidatos.forEach((c, i) => {
    const x = MARGEM + (i % colunasCards) * (cw + gap)
    const yc = y + Math.floor(i / colunasCards) * (ch + gap)
    const cor = cores[i]
    preencher(COR.branco)
    contorno(COR.trilho)
    doc.setLineWidth(0.4)
    doc.roundedRect(x, yc, cw, ch, 2.5, 2.5, 'FD')
    preencher(cor)
    doc.rect(x + 2, yc + 0.3, cw - 4, 1.4, 'F')

    const cx = x + 10.5
    const cy = yc + 11.5
    preencher(COR.branco)
    contorno(cor)
    doc.setLineWidth(1)
    doc.circle(cx, cy, 6.5, 'FD')
    fonte(14, 'bold')
    tinta(cor)
    doc.text(c.nome.slice(0, 1), cx, cy, { align: 'center', baseline: 'middle' })

    fonte(17, 'bold')
    tinta(COR.text)
    doc.text(formatarVotos2026(o.resumo.totais[i]), x + cw - 4, yc + 11, { align: 'right' })
    fonte(7.5)
    tinta(COR.muted)
    const pct = formatarPct2026(totalGeral ? (o.resumo.totais[i] / totalGeral) * 100 : 0, 1)
    doc.text(`votos · ${pct} da soma`, x + cw - 4, yc + 15.5, { align: 'right' })

    fonte(10.5, 'bold')
    tinta(COR.text)
    doc.text(c.nome.toUpperCase(), x + 4, yc + 24)
    fonte(8.5)
    tinta(COR.muted)
    doc.text(`${c.cargo} – ${c.numero}`, x + 4, yc + 28.5)

    const xp = pilula(`Lidera em ${formatarVotos2026(o.resumo.vitorias[i])} locais`, x + 4, yc + 31.5, cor, COR.branco)
    pilula(`Exclusivo em ${formatarVotos2026(o.resumo.exclusivos[i])}`, xp + 2, yc + 31.5, COR.bg, COR.muted)
  })
  y += Math.ceil(n / colunasCards) * (ch + gap) + 1

  // Faixa de resumo
  const sh = 24
  const sw = W - 2 * MARGEM
  preencher(COR.branco)
  contorno(COR.trilho)
  doc.setLineWidth(0.3)
  doc.roundedRect(MARGEM, y, sw, sh, 2.5, 2.5, 'FD')
  barraEmpilhada(MARGEM + 4, y + 4, sw - 8, 2.6, o.resumo.totais)

  const r = o.resumo
  const estatisticas: { rotulo: string; valor: string; extra?: string }[] = [
    { rotulo: 'Locais comparados', valor: formatarVotos2026(r.linhas) },
    {
      rotulo: 'Com voto de todos',
      valor: formatarVotos2026(r.todosComVoto),
      extra: formatarPct2026(r.linhas ? (r.todosComVoto / r.linhas) * 100 : 0, 1),
    },
    { rotulo: 'Empates', valor: formatarVotos2026(r.empates) },
    { rotulo: 'Sem voto de nenhum', valor: formatarVotos2026(r.nenhumVoto) },
    {
      rotulo: `Correlação por local${
        n > 2 ? ` (${nomeProprio(o.candidatos[0].nome)} × ${nomeProprio(o.candidatos[1].nome)})` : ''
      }`,
      valor: r.correlacao != null ? r.correlacao.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—',
      extra: r.correlacao != null ? rotuloCorrelacao(r.correlacao) : undefined,
    },
  ]
  const colEst = (sw - 8) / estatisticas.length
  estatisticas.forEach((e, i) => {
    const x = MARGEM + 4 + i * colEst
    fonte(7.5)
    tinta(COR.muted)
    doc.text(e.rotulo, x, y + 12.5)
    fonte(12, 'bold')
    tinta(COR.text)
    doc.text(e.valor, x, y + 19)
    if (e.extra) {
      const wv = doc.getTextWidth(e.valor)
      fonte(7.5)
      tinta(COR.muted)
      doc.text(e.extra, x + wv + 1.5, y + 19)
    }
  })
  y += sh + 5

  fonte(7.5)
  tinta(COR.muted)
  doc.text(`${formatarVotos2026(o.qtdRaiz)} ${o.comMunicipio ? 'municípios' : 'bairros'} · ${o.escopoLabel}`, MARGEM, y)
  y += 2.5

  // Tabela em árvore
  const wSec = 15
  const wCand = 34
  const wDiv = 32
  const wDif = n === 2 ? 20 : 0
  const wSoma = 20
  const wNome = W - 2 * MARGEM - wSec - wCand * n - wDiv - wDif - wSoma
  const colDivisao = 2 + n

  const preparadas: LinhaPreparada[] = o.linhas.map((linha, idx) => {
    const { no, profundidade } = linha
    const f = FONTE_NIVEL[no.nivel]
    const largura = wNome - recuo(profundidade) - 4 - RESERVA_CHIP
    fonte(f.tam, f.estilo)
    const nomeLinhas = doc.splitTextToSize(f.caixaAlta ? no.nome.toUpperCase() : no.nome, largura) as string[]
    fonte(FONTE_DETALHE)
    const detalheLinhas = no.detalhe ? (doc.splitTextToSize(no.detalhe, largura) as string[]) : []
    const altura =
      PAD_V * 2 +
      nomeLinhas.length * alturaLinha(f.tam) +
      (detalheLinhas.length ? 0.4 + detalheLinhas.length * alturaLinha(FONTE_DETALHE) : 0)
    const aberto = (o.linhas[idx + 1]?.profundidade ?? -1) > profundidade
    return { linha, aberto, nomeLinhas, detalheLinhas, altura }
  })

  const head: CellDef[] = [
    { content: `${o.comMunicipio ? 'MUNICÍPIO > ' : ''}BAIRRO > LOCAL > ZONA > SEÇÃO` },
    { content: 'SEÇÕES', styles: { halign: 'right' } },
    ...o.candidatos.map(
      (c): CellDef => ({
        content: `${nomeProprio(c.nome).toUpperCase()} (${abreviarCargo(c.cargo)})`,
        styles: { cellPadding: { top: 2.2, bottom: 2.2, left: 5, right: 2 } },
      }),
    ),
    { content: 'DIVISÃO' },
    ...(n === 2 ? [{ content: 'DIFERENÇA', styles: { halign: 'right' } } as CellDef] : []),
    { content: 'SOMA', styles: { halign: 'right' } },
  ]

  const body: RowInput[] = preparadas.map(({ linha: { no }, altura }) => {
    const base: Partial<Styles> = { fillColor: FUNDO_NIVEL[no.nivel] }
    const diferenca: CellDef[] =
      n === 2
        ? [
            no.lider != null
              ? {
                  content: `+${formatarVotos2026(Math.abs(no.votos[0] - no.votos[1]))}`,
                  styles: { ...base, halign: 'right', fontStyle: 'bold', textColor: cores[no.lider] },
                }
              : {
                  content: no.total ? 'empate' : '—',
                  styles: { ...base, halign: 'right', textColor: COR.muted },
                },
          ]
        : []
    return [
      { content: '', styles: { ...base, minCellHeight: altura } },
      { content: no.nivel === 'secao' ? '' : formatarVotos2026(no.secoes), styles: { ...base, halign: 'right' } },
      ...no.votos.map(
        (v, i): CellDef => ({
          content: formatarVotos2026(v),
          styles: {
            ...base,
            halign: 'right',
            fontStyle: no.lider === i ? 'bold' : 'normal',
            textColor: v ? COR.text : COR.muted,
          },
        }),
      ),
      { content: '', styles: base },
      ...diferenca,
      { content: formatarVotos2026(no.total), styles: { ...base, halign: 'right', fontStyle: 'bold' } },
    ]
  })

  const columnStyles: Record<number, Partial<Styles>> = { 0: { cellWidth: wNome }, 1: { cellWidth: wSec } }
  o.candidatos.forEach((_, i) => {
    columnStyles[2 + i] = { cellWidth: wCand }
  })
  columnStyles[colDivisao] = { cellWidth: wDiv }
  if (n === 2) columnStyles[colDivisao + 1] = { cellWidth: wDif }
  columnStyles[colDivisao + (n === 2 ? 2 : 1)] = { cellWidth: wSoma }

  const desenharNome = (d: CellHookData) => {
    const p = preparadas[d.row.index]
    const { no, profundidade } = p.linha
    const f = FONTE_NIVEL[no.nivel]
    const c = d.cell
    const x0 = c.x + recuo(profundidade)
    const meioPrimeiraLinha = c.y + PAD_V + alturaLinha(f.tam) / 2

    if (no.filhos.length) {
      preencher(COR.goldText)
      if (p.aberto) {
        doc.triangle(x0 - 0.2, meioPrimeiraLinha - 0.7, x0 + 2.2, meioPrimeiraLinha - 0.7, x0 + 1, meioPrimeiraLinha + 0.9, 'F')
      } else {
        doc.triangle(x0 + 0.3, meioPrimeiraLinha - 1.2, x0 + 0.3, meioPrimeiraLinha + 1.2, x0 + 1.9, meioPrimeiraLinha, 'F')
      }
    }

    fonte(f.tam, f.estilo)
    tinta(f.cor)
    doc.text(p.nomeLinhas, x0 + 4, c.y + PAD_V, { baseline: 'top' })
    if (p.detalheLinhas.length) {
      fonte(FONTE_DETALHE)
      tinta(COR.muted)
      doc.text(p.detalheLinhas, x0 + 4, c.y + PAD_V + p.nomeLinhas.length * alturaLinha(f.tam) + 0.4, {
        baseline: 'top',
      })
    }

    const rotulo = NIVEL_ARVORE_ROTULO[no.nivel]
    fonte(5.5, 'bold')
    const wc = doc.getTextWidth(rotulo) + 2.4
    const xc = c.x + c.width - 2 - wc
    preencher(COR.bg)
    doc.roundedRect(xc, meioPrimeiraLinha - 1.5, wc, 3, 0.6, 0.6, 'F')
    tinta(COR.muted)
    doc.text(rotulo, xc + wc / 2, meioPrimeiraLinha, { align: 'center', baseline: 'middle' })
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM, right: MARGEM, top: 12, bottom: 12 },
    head: [head],
    body,
    theme: 'plain',
    rowPageBreak: 'avoid',
    tableLineColor: COR.trilho,
    tableLineWidth: 0.6,
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      textColor: COR.text,
      valign: 'middle',
      cellPadding: { top: PAD_V, bottom: PAD_V, left: 2, right: 2 },
      lineColor: COR.trilho,
      lineWidth: { top: 0.2 },
    },
    headStyles: {
      fillColor: COR.bar,
      textColor: COR.muted,
      fontStyle: 'bold',
      fontSize: 6.5,
      lineWidth: 0,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
    },
    columnStyles,
    willDrawPage: (d) => {
      if (d.pageNumber > 1) desenharFaixaSuperior(doc, fonteDados, o.meta)
    },
    didDrawCell: (d) => {
      const col = d.column.index
      const c = d.cell
      const cy = c.y + c.height / 2
      if (d.section === 'head') {
        if (col >= 2 && col < colDivisao) {
          preencher(cores[col - 2])
          doc.circle(c.x + 2.6, cy, 0.9, 'F')
        }
        return
      }
      if (col === 0) {
        desenharNome(d)
        return
      }
      const { no, maxIrmaos } = preparadas[d.row.index].linha
      if (col >= 2 && col < colDivisao) {
        const i = col - 2
        barra(c.x + 2, cy - 0.8, c.width - 4 - RESERVA_NUMERO, 1.6, maxIrmaos ? no.votos[i] / maxIrmaos : 0, cores[i], COR.trilho)
      } else if (col === colDivisao) {
        barraEmpilhada(c.x + 2, cy - 1.1, c.width - 4, 2.2, no.votos)
      }
    },
  })

  numerarPaginas(doc, 'Resultado 2026 · Comparativo por local')
  return doc
}

export function exportarComparativoPdf2026(o: OpcoesComparativoPdf2026): void {
  const escopo = slugEscopo(o.escopoLabel)
  const ids = o.candidatos.map((c) => c.id).join('-x-')
  montarComparativoPdf2026(o).save(`comparativo-${ids}-${escopo}-${o.modo}.pdf`)
}
