import { jsPDF } from 'jspdf'
import autoTable, { type CellDef, type RowInput, type Styles } from 'jspdf-autotable'
import {
  formatarPct2026,
  formatarRazao2026,
  formatarSecao2026,
  formatarVotos2026,
  formatarZona2026,
  type FaixaDiferenca2026,
  type LinhaSecaoComparada2026,
  type ModoFaixa2026,
  type ResultadoSecao2026Candidato,
  type ResultadoSecao2026Meta,
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
} from './pdf-base-2026'
import { abreviarCargo, corCandidato, nomeProprio } from './tse-ui'

export type ModoPdfSecoes = 'tela' | 'completo'

export type BlocoFaixasPdf = {
  p: number
  comVoto: number
  distribuicao: { faixa: FaixaDiferenca2026; quantidade: number; geral: number; parceiro: number }[]
}

export type ResumoParPdf = {
  p: number
  geralFrente: number
  parceiroFrente: number
  empates: number
  difMediana: number
  razaoTotal: number | null
  razaoMediana: number | null
}

export type OpcoesSecoesPdf2026 = {
  meta: ResultadoSecao2026Meta
  /** Posição 0 é o geral; as demais são parceiros. */
  candidatos: ResultadoSecao2026Candidato[]
  modoFaixa: ModoFaixa2026
  /** Chaves `${parceiro}|${faixa.id}` marcadas na tela. */
  faixasSel: Set<string>
  /** Faixa personalizada por parceiro, já em texto ("de 10 até 20 votos de diferença"). */
  faixaCustom: Record<number, string>
  blocos: BlocoFaixasPdf[]
  votos: number[]
  porPar: ResumoParPdf[]
  linhas: LinhaSecaoComparada2026[]
  totalFiltro: number
  totalEscopo: number
  escopoLabel: string
  comMunicipio: boolean
  filtros: string[]
  ordemLabel: string
  modo: ModoPdfSecoes
}

const ROTULO_MODO: Record<ModoFaixa2026, string> = {
  votos: 'Faixas em votos',
  pct: 'Faixas em % da soma',
  razao: 'Faixas em % do geral',
}

export function montarComparativoSecoesPdf2026(o: OpcoesSecoesPdf2026): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const sw = W - 2 * MARGEM
  const n = o.candidatos.length
  const parceiros = Array.from({ length: Math.max(0, n - 1) }, (_, i) => i + 1)
  const cores = o.candidatos.map((_, i) => rgb(corCandidato(i)))
  const fonteDados = o.candidatos[0]?.fonte ?? ''
  const nome = (i: number) => nomeProprio(o.candidatos[i].nome)
  const primeiroNome = (i: number) => nome(i).split(' ')[0]
  const nomeGeral = primeiroNome(0)
  const { preencher, contorno, tinta, fonte, barraEmpilhada } = ferramentasPdf(doc)

  const novaPaginaSe = (y: number, altura: number): number => {
    if (y + altura <= H - 14) return y
    doc.addPage()
    desenharFaixaSuperior(doc, fonteDados, o.meta)
    return 14
  }

  const ponto = (x: number, y: number, cor: (typeof cores)[number], r = 1.1) => {
    preencher(cor)
    doc.circle(x, y, r, 'F')
  }

  const descricao = [
    o.escopoLabel,
    ROTULO_MODO[o.modoFaixa].replace('geral', nomeGeral),
    `Ordenação: ${o.ordemLabel}`,
    ...o.filtros,
    o.modo === 'completo' ? 'Todas as seções do filtro' : 'Seções carregadas na tela',
  ].join('  ·  ')
  let y = desenharCabecalho(doc, { titulo: 'Comparativo por seção', descricao, fonteDados, meta: o.meta })

  // Votos de cada candidato no filtro
  const gapCand = 4
  const wCand = (sw - gapCand * (n - 1)) / n
  const hCand = 15
  o.candidatos.forEach((c, i) => {
    const x = MARGEM + i * (wCand + gapCand)
    preencher(COR.branco)
    contorno(COR.trilho)
    doc.setLineWidth(0.4)
    doc.roundedRect(x, y, wCand, hCand, 2, 2, 'FD')
    preencher(cores[i])
    doc.rect(x + 2, y + 0.3, wCand - 4, 1.2, 'F')
    fonte(8.5, 'bold')
    tinta(COR.text)
    doc.text(`${c.nome.toUpperCase()}${i === 0 ? '  (GERAL)' : ''}`, x + 3.5, y + 6.5)
    fonte(6.5)
    tinta(COR.muted)
    doc.text(`${c.cargo} – ${c.numero}`, x + 3.5, y + 10.5)
    fonte(12, 'bold')
    tinta(COR.text)
    doc.text(formatarVotos2026(o.votos[i] ?? 0), x + wCand - 3.5, y + 7, { align: 'right' })
    fonte(6)
    tinta(COR.muted)
    doc.text('votos no filtro', x + wCand - 3.5, y + 10.8, { align: 'right' })
  })
  y += hCand + 5

  // Faixas por parceiro
  const gapCard = 2.5
  const nFaixas = o.blocos[0]?.distribuicao.length ?? 7
  const wCard = (sw - gapCard * (nFaixas - 1)) / nFaixas
  const hCard = 21
  for (const bloco of o.blocos) {
    y = novaPaginaSe(y, 7 + hCard + 4)
    const p = bloco.p
    ponto(MARGEM + 1.2, y + 1.6, cores[0])
    fonte(9, 'bold')
    tinta(COR.text)
    let x = MARGEM + 3.5
    doc.text(nomeGeral.toUpperCase(), x, y + 2.8)
    x += doc.getTextWidth(nomeGeral.toUpperCase()) + 1.5
    tinta(COR.muted)
    doc.text('×', x, y + 2.8)
    x += doc.getTextWidth('×') + 2.5
    ponto(x, y + 1.6, cores[p])
    x += 2.3
    tinta(COR.text)
    doc.text(nome(p).toUpperCase(), x, y + 2.8)
    x += doc.getTextWidth(nome(p).toUpperCase()) + 2
    fonte(7)
    tinta(COR.muted)
    doc.text(`(${abreviarCargo(o.candidatos[p].cargo)}) · ${formatarVotos2026(bloco.comVoto)} seções`, x, y + 2.8)
    if (o.faixaCustom[p]) {
      fonte(7, 'bold')
      tinta(COR.goldText)
      doc.text(`Faixa personalizada: ${o.faixaCustom[p]}`, W - MARGEM, y + 2.8, { align: 'right' })
    }
    y += 5

    bloco.distribuicao.forEach(({ faixa, quantidade, geral, parceiro }, k) => {
      const xc = MARGEM + k * (wCard + gapCard)
      const ativo = o.faixasSel.has(`${p}|${faixa.id}`)
      preencher(ativo ? COR.yellowSoft : COR.branco)
      contorno(ativo ? COR.yellow : COR.trilho)
      doc.setLineWidth(ativo ? 0.7 : 0.4)
      doc.roundedRect(xc, y, wCard, hCard, 2, 2, 'FD')
      fonte(6.5, 'bold')
      tinta(COR.muted)
      doc.text(faixa.rotulo, xc + 2.5, y + 4)
      fonte(12, 'bold')
      tinta(COR.text)
      doc.text(formatarVotos2026(quantidade), xc + 2.5, y + 9.8)
      fonte(6)
      tinta(COR.muted)
      doc.text(
        `${formatarPct2026(bloco.comVoto ? (quantidade / bloco.comVoto) * 100 : 0, 1)} das seções`,
        xc + 2.5,
        y + 13.2,
      )
      barraEmpilhada(xc + 2.5, y + 14.8, wCard - 5, 1.6, [geral, parceiro], [cores[0], cores[p]])
      if (!faixa.id.endsWith('-empate')) {
        fonte(5.8, 'bold')
        tinta(cores[0])
        const t1 = `${nomeGeral} ${formatarVotos2026(geral)}`
        doc.text(t1, xc + 2.5, y + 19.3)
        tinta(cores[p])
        doc.text(`${primeiroNome(p)} ${formatarVotos2026(parceiro)}`, xc + 2.5 + doc.getTextWidth(t1) + 2, y + 19.3)
      }
    })
    y += hCard + 5
  }

  // Resumo por par
  if (o.porPar.length) {
    const hRes = 17
    y = novaPaginaSe(y, hRes + 12)
    fonte(7.5)
    tinta(COR.muted)
    doc.text(
      `${formatarVotos2026(o.totalFiltro)} seções no filtro de ${formatarVotos2026(o.totalEscopo)} · ${o.escopoLabel}`,
      MARGEM,
      y,
    )
    y += 2.5
    const wRes = (sw - gapCand * (o.porPar.length - 1)) / o.porPar.length
    o.porPar.forEach((r, k) => {
      const x = MARGEM + k * (wRes + gapCand)
      preencher(COR.branco)
      contorno(COR.trilho)
      doc.setLineWidth(0.3)
      doc.roundedRect(x, y, wRes, hRes, 2, 2, 'FD')
      ponto(x + 3.5, y + 4.2, cores[0], 0.9)
      ponto(x + 6, y + 4.2, cores[r.p], 0.9)
      fonte(8, 'bold')
      tinta(COR.text)
      doc.text(`${nomeGeral} × ${nome(r.p)}`, x + 8, y + 5.2)
      fonte(7, 'bold')
      tinta(cores[0])
      const a = `${nomeGeral} à frente ${formatarVotos2026(r.geralFrente)}`
      doc.text(a, x + 3, y + 10)
      tinta(cores[r.p])
      const b = `${primeiroNome(r.p)} à frente ${formatarVotos2026(r.parceiroFrente)}`
      const xb = x + 3 + doc.getTextWidth(a) + 3
      doc.text(b, xb, y + 10)
      fonte(7)
      tinta(COR.muted)
      doc.text(`empates ${formatarVotos2026(r.empates)}`, xb + doc.getTextWidth(b) + 3, y + 10)
      doc.text(
        `Diferença mediana ${formatarVotos2026(r.difMediana)} votos · ${primeiroNome(r.p)} = ${formatarRazao2026(
          r.razaoTotal,
        )} de ${nomeGeral} (mediana ${formatarRazao2026(r.razaoMediana)})`,
        x + 3,
        y + 14.2,
      )
    })
    y += hRes + 4
  }

  // Tabela
  y = novaPaginaSe(y, 24)
  const wMun = o.comMunicipio ? 32 : 0
  const wZona = 12
  const wSecao = 12
  const wGeral = 20
  const wVotos = 16
  const wDif = 18
  const wRazao = 19
  const wBairro = sw - wMun - wZona - wSecao - wGeral - parceiros.length * (wVotos + wDif + wRazao)
  const colGeral = (o.comMunicipio ? 1 : 0) + 3
  const inicioPar = (p: number) => colGeral + 1 + (p - 1) * 3

  const fixo = (content: string, halign: 'left' | 'right' = 'left'): CellDef => ({
    content,
    rowSpan: 2,
    styles: { halign, valign: 'bottom' },
  })
  const head: RowInput[] = [
    [
      ...(o.comMunicipio ? [fixo('MUNICÍPIO')] : []),
      fixo('BAIRRO'),
      fixo('ZONA', 'right'),
      fixo('SEÇÃO', 'right'),
      fixo(nome(0).toUpperCase(), 'right'),
      ...parceiros.map(
        (p): CellDef => ({
          content: `${nome(p).toUpperCase()} (${abreviarCargo(o.candidatos[p].cargo)})`,
          colSpan: 3,
          styles: { halign: 'center', lineWidth: { left: 0.3 }, lineColor: COR.zero },
        }),
      ),
    ],
    parceiros.flatMap((): CellDef[] => [
      { content: 'VOTOS', styles: { halign: 'right', lineWidth: { left: 0.3 }, lineColor: COR.zero } },
      { content: 'DIFERENÇA', styles: { halign: 'right' } },
      { content: `% DE ${nomeGeral.toUpperCase()}`, styles: { halign: 'right' } },
    ]),
  ]

  const body: RowInput[] = o.linhas.map((l) => [
    ...(o.comMunicipio ? [{ content: l.municipioNome.toUpperCase(), styles: { fontStyle: 'bold' } } as CellDef] : []),
    { content: l.bairro.toUpperCase() },
    { content: formatarZona2026(l.zona), styles: { halign: 'right' } },
    { content: formatarSecao2026(l.secao), styles: { halign: 'right', fontStyle: 'bold' } },
    { content: formatarVotos2026(l.votos[0] ?? 0), styles: { halign: 'right', fontStyle: 'bold' } },
    ...l.pares.flatMap((par, k): CellDef[] => {
      const p = k + 1
      const supera = par.razaoPct != null && par.razaoPct >= 100
      const dif: CellDef = !par.total
        ? { content: '—', styles: { halign: 'right', textColor: COR.muted } }
        : par.lider == null
          ? { content: 'empate', styles: { halign: 'right', textColor: COR.muted } }
          : {
              content: `${par.saldo > 0 ? '+' : '-'}${formatarVotos2026(par.diferenca)}${
                o.modoFaixa === 'pct' ? `  (${formatarPct2026(par.margemPct, 0)})` : ''
              }`,
              styles: { halign: 'right', fontStyle: 'bold', textColor: cores[par.lider === 0 ? 0 : p] },
            }
      return [
        {
          content: formatarVotos2026(par.parceiro),
          styles: {
            halign: 'right',
            textColor: par.parceiro ? COR.text : COR.muted,
            lineWidth: { top: 0.2, left: 0.3 },
            lineColor: COR.trilho,
          },
        },
        dif,
        {
          content: formatarRazao2026(par.razaoPct),
          styles: { halign: 'right', fontStyle: supera ? 'bold' : 'normal', textColor: supera ? cores[p] : COR.text },
        },
      ]
    }),
  ])

  const columnStyles: Record<number, Partial<Styles>> = {}
  let col = 0
  if (o.comMunicipio) columnStyles[col++] = { cellWidth: wMun }
  columnStyles[col++] = { cellWidth: wBairro }
  columnStyles[col++] = { cellWidth: wZona }
  columnStyles[col++] = { cellWidth: wSecao }
  columnStyles[col++] = { cellWidth: wGeral }
  parceiros.forEach(() => {
    columnStyles[col++] = { cellWidth: wVotos }
    columnStyles[col++] = { cellWidth: wDif }
    columnStyles[col++] = { cellWidth: wRazao }
  })

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM, right: MARGEM, top: 12, bottom: 12 },
    head,
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
      overflow: 'linebreak',
      cellPadding: { top: 1.3, bottom: 1.3, left: 2, right: 2 },
      lineColor: COR.trilho,
      lineWidth: { top: 0.2 },
    },
    headStyles: {
      fillColor: COR.bar,
      textColor: COR.muted,
      fontStyle: 'bold',
      fontSize: 6.5,
      lineWidth: 0,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
    },
    columnStyles,
    willDrawPage: (d) => {
      if (d.pageNumber > 1) desenharFaixaSuperior(doc, fonteDados, o.meta)
    },
    didDrawCell: (d) => {
      if (d.section !== 'head' || d.row.index !== 0) return
      const c = d.cell
      const cy = c.y + c.height - 3.4
      if (d.column.index === colGeral) {
        fonte(6.5, 'bold')
        const wTexto = doc.getTextWidth(String(c.text[0] ?? ''))
        ponto(c.x + c.width - 2 - wTexto - 2, cy, cores[0], 0.9)
        return
      }
      const p = parceiros.find((q) => inicioPar(q) === d.column.index)
      if (p != null) {
        fonte(6.5, 'bold')
        const wTexto = doc.getTextWidth(String(c.text[0] ?? ''))
        ponto(c.x + c.width / 2 - wTexto / 2 - 2.2, c.y + c.height / 2, cores[p], 0.9)
      }
    },
  })

  numerarPaginas(doc, 'Resultado 2026 · Comparativo por seção')
  return doc
}

export function exportarComparativoSecoesPdf2026(o: OpcoesSecoesPdf2026): void {
  const ids = o.candidatos.map((c) => c.id).join('-x-')
  montarComparativoSecoesPdf2026(o).save(`comparativo-secao-${ids}-${slugEscopo(o.escopoLabel)}-${o.modo}.pdf`)
}
