import { jsPDF } from 'jspdf'
import autoTable, { type CellDef, type RowInput, type Styles } from 'jspdf-autotable'
import { formatarPct2026, formatarVotos2026, type ResultadoSecao2026Meta } from '@/lib/resultado-secao-2026'
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

export type MunicipioTerritorioPdf = {
  nome: string
  /** Quem venceu no município (útil na visão por partido). */
  vencedor: string
  votos: number
  /** Fatia dos votos nominais do cargo no município. */
  pctMunicipio: number
  /** Fatia do total do candidato/partido no estado que veio deste município. */
  pctTotal: number
  segundo: string
  votosSegundo: number | null
  terceiro: string
  votosTerceiro: number | null
}

export type GrupoTerritorioPdf = {
  rotulo: string
  detalhe: string
  cor: string
  votosEstado: number
  municipios: MunicipioTerritorioPdf[]
}

export type ConquistaTerritorioPdf = {
  vencedor: string
  detalhe: string
  cor: string
  mantidas: string[]
  origens: { de: string; detalhe: string; cor: string; cidades: string[] }[]
}

export type PodioTerritorioPdf = {
  rotulo: string
  detalhe: string
  /** Cor no mapa; só quem venceu algum município tem. */
  cor: string | null
  primeiros: number
  segundos: number
  terceiros: number
  votosEstado: number
}

export type OpcoesTerritorioPdf2026 = {
  meta: ResultadoSecao2026Meta
  fonteDados: string
  cargo: string
  modo: 'candidato' | 'partido'
  grupos: GrupoTerritorioPdf[]
  totalMunicipios: number
  /** Quantas vezes cada um ficou em 1º, 2º e 3º nos municípios. */
  podio: PodioTerritorioPdf[]
  /** Vencedores de 2026 e de quem tomaram cidades em relação a 2022 (só Deputado Federal). */
  conquistas?: ConquistaTerritorioPdf[]
}

export function montarTerritorioPdf2026(o: OpcoesTerritorioPdf2026): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const sw = doc.internal.pageSize.getWidth() - 2 * MARGEM
  const { preencher } = ferramentasPdf(doc)
  const porPartido = o.modo === 'partido'
  const sujeito = porPartido ? 'PARTIDO' : 'CANDIDATO'

  const descricao = [
    o.cargo,
    `Vencedores por votos no estado · colorido por ${o.modo}`,
    `${o.grupos.length} ${porPartido ? 'partidos' : 'candidatos'} venceram em ${o.totalMunicipios} municípios`,
  ].join('  ·  ')
  const yCabecalho = desenharCabecalho(doc, {
    titulo: 'Domínio territorial',
    descricao,
    fonteDados: o.fonteDados,
    meta: o.meta,
  })
  const yPodio = o.podio.length ? desenharPodio(doc, o, yCabecalho) : yCabecalho
  const y = tituloSecao(doc, o, 'Municípios de cada vencedor', yPodio)

  const wVotosColocado = porPartido ? 14 : 15
  const colunas: { titulo: string; largura: number; direita?: boolean }[] = [
    { titulo: 'MUNICÍPIO', largura: porPartido ? 36 : 43 },
    ...(porPartido ? [{ titulo: 'VENCEDOR', largura: 26 }] : []),
    { titulo: 'VOTOS', largura: porPartido ? 15 : 16, direita: true },
    { titulo: '% NO MUNICÍPIO', largura: 16, direita: true },
    { titulo: `% DO TOTAL DO ${sujeito}`, largura: porPartido ? 18 : 19, direita: true },
  ]
  const wColocado = (sw - colunas.reduce((a, c) => a + c.largura, 0) - 2 * wVotosColocado) / 2
  colunas.push(
    { titulo: '2º COLOCADO', largura: wColocado },
    { titulo: 'VOTOS DO 2º', largura: wVotosColocado, direita: true },
    { titulo: '3º COLOCADO', largura: wColocado },
    { titulo: 'VOTOS DO 3º', largura: wVotosColocado, direita: true },
  )
  const colocado = (nome: string, votos: number | null): CellDef[] => [
    { content: nome || '—', styles: { fontSize: 6.8, textColor: nome ? COR.text : COR.muted } },
    {
      content: votos == null ? '—' : formatarVotos2026(votos),
      styles: { halign: 'right', textColor: votos == null ? COR.muted : COR.text },
    },
  ]

  const head: RowInput[] = [
    colunas.map((c): CellDef => ({ content: c.titulo, styles: { halign: c.direita ? 'right' : 'left' } })),
  ]

  const coresGrupo = new Map<number, Rgb>()
  const body: RowInput[] = []
  for (const g of o.grupos) {
    const votosVencidos = g.municipios.reduce((a, m) => a + m.votos, 0)
    coresGrupo.set(body.length, rgb(g.cor))
    body.push([
      {
        content: `${g.rotulo.toUpperCase()}${g.detalhe ? `  (${g.detalhe})` : ''}   ·   ${formatarVotos2026(
          g.votosEstado,
        )} votos no estado   ·   ${g.municipios.length} ${
          g.municipios.length === 1 ? 'município' : 'municípios'
        }   ·   ${formatarVotos2026(votosVencidos)} votos onde venceu (${formatarPct2026(
          g.votosEstado ? (votosVencidos / g.votosEstado) * 100 : 0,
          1,
        )} do total)`,
        colSpan: colunas.length,
        styles: {
          fontStyle: 'bold',
          fontSize: 8,
          fillColor: COR.bg,
          cellPadding: { top: 2.2, bottom: 2.2, left: 7, right: 2 },
        },
      },
    ])
    for (const m of g.municipios) {
      body.push([
        { content: m.nome.toUpperCase(), styles: { fontStyle: 'bold' } },
        ...(porPartido ? [{ content: m.vencedor }] : []),
        { content: formatarVotos2026(m.votos), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatarPct2026(m.pctMunicipio, 1), styles: { halign: 'right' } },
        { content: formatarPct2026(m.pctTotal, 1), styles: { halign: 'right' } },
        ...colocado(m.segundo, m.votosSegundo),
        ...colocado(m.terceiro, m.votosTerceiro),
      ])
    }
  }

  const columnStyles: Record<number, Partial<Styles>> = {}
  colunas.forEach((c, i) => {
    columnStyles[i] = { cellWidth: c.largura }
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
      if (d.pageNumber > 1) desenharFaixaSuperior(doc, o.fonteDados, o.meta)
    },
    didDrawCell: (d) => {
      if (d.section !== 'body' || d.column.index !== 0) return
      const cor = coresGrupo.get(d.row.index)
      if (!cor) return
      preencher(cor)
      doc.roundedRect(d.cell.x + 2, d.cell.y + d.cell.height / 2 - 1.6, 3.2, 3.2, 0.6, 0.6, 'F')
    },
  })

  if (o.conquistas?.length) desenharConquistas(doc, o, o.conquistas)

  numerarPaginas(doc, `Resultado 2026 · Território · ${o.cargo}`)
  return doc
}

const fimDaUltimaTabela = (doc: jsPDF, padrao: number): number =>
  (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? padrao

/** Título de seção; abre página nova se não couber ao menos o começo de uma tabela. */
function tituloSecao(doc: jsPDF, o: OpcoesTerritorioPdf2026, texto: string, y: number): number {
  const { tinta, fonte } = ferramentasPdf(doc)
  let topo = y
  if (topo > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage()
    desenharFaixaSuperior(doc, o.fonteDados, o.meta)
    topo = 14
  }
  fonte(10, 'bold')
  tinta(COR.text)
  doc.text(texto, MARGEM, topo + 3.5)
  return topo + 6
}

function desenharPodio(doc: jsPDF, o: OpcoesTerritorioPdf2026, y: number): number {
  const { preencher } = ferramentasPdf(doc)
  const sw = doc.internal.pageSize.getWidth() - 2 * MARGEM
  const sujeito = o.modo === 'partido' ? 'PARTIDO' : 'CANDIDATO'
  const topo = tituloSecao(doc, o, 'Quadro-resumo: colocações nos municípios', y)

  const wNum = 18
  const wVotos = 26
  const wPos = 8
  const wNome = sw - wPos - 4 * wNum - wVotos
  const cores = new Map<number, Rgb>()
  const numero = (n: number, destaque = false): CellDef => ({
    content: n ? formatarVotos2026(n) : '—',
    styles: {
      halign: 'right',
      fontStyle: destaque && n ? 'bold' : 'normal',
      textColor: n ? COR.text : COR.muted,
    },
  })
  const body: RowInput[] = o.podio.map((p, i) => {
    if (p.cor) cores.set(i, rgb(p.cor))
    return [
      { content: `${i + 1}º`, styles: { textColor: COR.muted } },
      {
        content: `${p.rotulo.toUpperCase()}${p.detalhe ? `  (${p.detalhe})` : ''}`,
        styles: { fontStyle: 'bold', cellPadding: { top: 1.1, bottom: 1.1, left: 7, right: 2 } },
      },
      numero(p.primeiros, true),
      numero(p.segundos),
      numero(p.terceiros),
      numero(p.primeiros + p.segundos + p.terceiros),
      { content: formatarVotos2026(p.votosEstado), styles: { halign: 'right', textColor: COR.muted } },
    ]
  })

  autoTable(doc, {
    startY: topo,
    margin: { left: MARGEM, right: MARGEM, top: 12, bottom: 12 },
    head: [
      [
        { content: '#' },
        { content: sujeito },
        { content: '1º LUGAR', styles: { halign: 'right' } },
        { content: '2º LUGAR', styles: { halign: 'right' } },
        { content: '3º LUGAR', styles: { halign: 'right' } },
        { content: 'NO PÓDIO', styles: { halign: 'right' } },
        { content: 'VOTOS NO ESTADO', styles: { halign: 'right' } },
      ],
    ],
    body,
    theme: 'plain',
    rowPageBreak: 'avoid',
    tableLineColor: COR.trilho,
    tableLineWidth: 0.6,
    styles: {
      font: 'helvetica',
      fontSize: 7.3,
      textColor: COR.text,
      valign: 'middle',
      cellPadding: { top: 1.1, bottom: 1.1, left: 2, right: 2 },
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
    columnStyles: {
      0: { cellWidth: wPos },
      1: { cellWidth: wNome },
      2: { cellWidth: wNum },
      3: { cellWidth: wNum },
      4: { cellWidth: wNum },
      5: { cellWidth: wNum },
      6: { cellWidth: wVotos },
    },
    willDrawPage: (d) => {
      if (d.pageNumber > 1) desenharFaixaSuperior(doc, o.fonteDados, o.meta)
    },
    didDrawCell: (d) => {
      if (d.section !== 'body' || d.column.index !== 1) return
      const cor = cores.get(d.row.index)
      if (!cor) return
      preencher(cor)
      doc.roundedRect(d.cell.x + 2, d.cell.y + d.cell.height / 2 - 1.4, 2.8, 2.8, 0.5, 0.5, 'F')
    },
  })
  return fimDaUltimaTabela(doc, topo) + 7
}

function desenharConquistas(doc: jsPDF, o: OpcoesTerritorioPdf2026, conquistas: ConquistaTerritorioPdf[]): void {
  const { preencher, tinta, fonte } = ferramentasPdf(doc)
  const sw = doc.internal.pageSize.getWidth() - 2 * MARGEM
  doc.addPage()
  desenharFaixaSuperior(doc, o.fonteDados, o.meta)
  const tomadas = conquistas.reduce((a, c) => a + c.origens.reduce((s, x) => s + x.cidades.length, 0), 0)
  fonte(13, 'bold')
  tinta(COR.text)
  doc.text('De quem cada vencedor de 2026 tomou cidades', MARGEM, 17)
  fonte(8)
  tinta(COR.muted)
  const subtitulo = doc.splitTextToSize(
    `${o.cargo} · vencedor de cada município em 2022 × 2026 · ${conquistas.length} vencedores · ${tomadas} cidades mudaram de mãos · mesma pessoa reconhecida pelo nome civil`,
    sw,
  ) as string[]
  doc.text(subtitulo, MARGEM, 22)

  const wOrigem = 58
  const wQtd = 16
  const coresLinha = new Map<number, { cor: Rgb; tamanho: number }>()
  const body: RowInput[] = []
  for (const c of conquistas) {
    const nTomadas = c.origens.reduce((a, x) => a + x.cidades.length, 0)
    const total = nTomadas + c.mantidas.length
    coresLinha.set(body.length, { cor: rgb(c.cor), tamanho: 3.2 })
    body.push([
      {
        content: `${c.vencedor.toUpperCase()}${c.detalhe ? `  (${c.detalhe})` : ''}   ·   ${total} ${
          total === 1 ? 'cidade' : 'cidades'
        } em 2026   ·   ${nTomadas} tomadas   ·   ${c.mantidas.length} mantidas de 2022`,
        colSpan: 3,
        styles: {
          fontStyle: 'bold',
          fontSize: 8,
          fillColor: COR.bg,
          cellPadding: { top: 2.2, bottom: 2.2, left: 7, right: 2 },
        },
      },
    ])
    const linha = (rotulo: string, cor: string, cidades: string[], destaque: boolean) => {
      coresLinha.set(body.length, { cor: rgb(cor), tamanho: 2.4 })
      body.push([
        {
          content: rotulo,
          styles: { fontStyle: destaque ? 'bold' : 'normal', cellPadding: { top: 1.3, bottom: 1.3, left: 7, right: 2 } },
        },
        { content: String(cidades.length), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: cidades.map((m) => m.toUpperCase()).join(', '), styles: { fontSize: 6.8, textColor: COR.muted } },
      ])
    }
    for (const x of c.origens) linha(`de ${x.de}${x.detalhe ? ` (${x.detalhe})` : ''}`, x.cor, x.cidades, true)
    if (c.mantidas.length) linha('manteve de 2022', c.cor, c.mantidas, false)
  }

  autoTable(doc, {
    startY: 25 + subtitulo.length * 3.5,
    margin: { left: MARGEM, right: MARGEM, top: 12, bottom: 12 },
    head: [
      [
        { content: 'TOMOU DE' },
        { content: 'CIDADES', styles: { halign: 'right' } },
        { content: 'MUNICÍPIOS' },
      ],
    ],
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
    columnStyles: {
      0: { cellWidth: wOrigem },
      1: { cellWidth: wQtd },
      2: { cellWidth: sw - wOrigem - wQtd },
    },
    willDrawPage: () => desenharFaixaSuperior(doc, o.fonteDados, o.meta),
    didDrawCell: (d) => {
      if (d.section !== 'body' || d.column.index !== 0) return
      const marca = coresLinha.get(d.row.index)
      if (!marca) return
      preencher(marca.cor)
      const x = d.cell.x + 2.4 + (3.2 - marca.tamanho) / 2
      doc.roundedRect(x, d.cell.y + d.cell.height / 2 - marca.tamanho / 2, marca.tamanho, marca.tamanho, 0.5, 0.5, 'F')
    },
  })
}

export function exportarTerritorioPdf2026(o: OpcoesTerritorioPdf2026): void {
  montarTerritorioPdf2026(o).save(`territorio-${slugEscopo(o.cargo)}-por-${o.modo}.pdf`)
}
