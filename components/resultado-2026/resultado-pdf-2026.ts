import { jsPDF } from 'jspdf'
import autoTable, { type CellDef, type RowInput, type Styles } from 'jspdf-autotable'
import {
  formatarPct2026,
  formatarSecao2026,
  formatarVotos2026,
  formatarZona2026,
  type LocalResumo2026,
  type MunicipioResumo2026,
  type ResultadoSecao2026Candidato,
  type ResultadoSecao2026Meta,
  type ResumoGeral2026,
  type SecaoDetalhe2026,
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
import { nomeProprio } from './tse-ui'

export type ModoPdfResultado = 'tela' | 'completo'

type BaseResultadoPdf = {
  meta: ResultadoSecao2026Meta
  candidato: ResultadoSecao2026Candidato
  geral: ResumoGeral2026
  escopoLabel: string
  /** Texto abaixo do total ("no estado" ou "x% do total do candidato"). */
  legendaVotos: string
  ordemLabel: string
  busca: string
  modo: ModoPdfResultado
}

export type OpcoesResultadoPdf2026 = BaseResultadoPdf &
  (
    | { visao: 'municipios'; linhas: MunicipioResumo2026[]; rank: Map<string, number> }
    | { visao: 'locais'; linhas: LocalResumo2026[]; mostrarMunicipio: boolean }
    | { visao: 'secoes'; linhas: SecaoDetalhe2026[]; mostrarMunicipio: boolean; localLabel: string | null }
  )

const TITULO: Record<OpcoesResultadoPdf2026['visao'], string> = {
  municipios: 'Resultado por município',
  locais: 'Resultado por local de votação',
  secoes: 'Resultado por seção',
}

const VERDE = rgb('#9EB737')
const VERDE_TEXTO = rgb('#6A8421')
const TRILHO_BARRA = rgb('#EEEEEE')

export function montarResultadoPdf2026(o: OpcoesResultadoPdf2026): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const W = doc.internal.pageSize.getWidth()
  const sw = W - 2 * MARGEM
  const fonteDados = o.candidato.fonte
  const { preencher, contorno, tinta, fonte, pilula, barra } = ferramentasPdf(doc)

  const descricao = [
    o.escopoLabel,
    `Ordenação: ${o.ordemLabel}`,
    o.busca ? `Busca: "${o.busca}"` : null,
    o.visao === 'secoes' && o.localLabel ? `Local: ${o.localLabel}` : null,
    o.modo === 'completo' ? 'Lista completa' : 'Linhas carregadas na tela',
  ]
    .filter((t): t is string => Boolean(t))
    .join('  ·  ')
  let y = desenharCabecalho(doc, {
    titulo: `${TITULO[o.visao]} · ${nomeProprio(o.candidato.nome)}`,
    descricao,
    fonteDados,
    meta: o.meta,
  })

  // Card do candidato
  const ch = 30
  preencher(COR.branco)
  contorno(COR.trilho)
  doc.setLineWidth(0.4)
  doc.roundedRect(MARGEM, y, sw, ch, 2.5, 2.5, 'FD')

  const xt = MARGEM + 6
  fonte(14, 'bold')
  tinta(COR.text)
  doc.text(o.candidato.nome.toUpperCase(), xt, y + 9.5)
  fonte(9)
  tinta(COR.muted)
  doc.text(`${o.candidato.cargo} – ${o.candidato.numero}`, xt, y + 15)
  pilula(o.escopoLabel, xt, y + 19, VERDE, COR.branco)

  const estat: [string, string][] = [
    ['Municípios com voto', `${formatarVotos2026(o.geral.municipiosComVoto)} / ${formatarVotos2026(o.geral.municipios)}`],
    ['Locais', formatarVotos2026(o.geral.locais)],
    ['Seções com voto', `${formatarVotos2026(o.geral.secoesComVoto)} / ${formatarVotos2026(o.geral.secoes)}`],
    ['Média por seção', o.geral.mediaSecao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })],
  ]
  const xe = MARGEM + 125
  const we = 30
  estat.forEach(([rotulo, valor], i) => {
    const x = xe + i * we
    fonte(6.5)
    tinta(COR.muted)
    doc.text(rotulo, x, y + 12)
    fonte(10, 'bold')
    tinta(COR.text)
    doc.text(valor, x, y + 18)
  })

  fonte(24, 'bold')
  tinta(COR.text)
  doc.text(formatarVotos2026(o.geral.votos), W - MARGEM - 5, y + 14, { align: 'right' })
  fonte(8.5)
  tinta(COR.muted)
  doc.text(`votos ${o.legendaVotos}`, W - MARGEM - 5, y + 20, { align: 'right' })
  y += ch + 6

  fonte(7.5)
  tinta(COR.muted)
  const unidade = o.visao === 'municipios' ? 'municípios' : o.visao === 'locais' ? 'locais de votação' : 'seções'
  doc.text(`${formatarVotos2026(o.linhas.length)} ${unidade} · ${o.escopoLabel}`, MARGEM, y)
  y += 2.5

  // Tabela
  const W_BARRA = 52
  let head: CellDef[]
  let body: RowInput[]
  let votosDe: (i: number) => number
  const columnStyles: Record<number, Partial<Styles>> = {}
  let colBarra: number
  /** Coluna com nome em negrito + linha secundária em cinza, desenhada à mão. */
  let colDupla = -1
  let duplaDe: (i: number) => { titulo: string; sub: string } = () => ({ titulo: '', sub: '' })

  const numero = (content: string, extra: Partial<Styles> = {}): CellDef => ({
    content,
    styles: { halign: 'right', ...extra },
  })

  if (o.visao === 'municipios') {
    head = [
      { content: 'POS.', styles: { halign: 'center' } },
      { content: 'MUNICÍPIO' },
      { content: 'ZONA' },
      numero('LOCAIS'),
      numero('VOTOS'),
      numero('% DO TOTAL'),
    ]
    body = o.linhas.map((m) => [
      { content: `${o.rank.get(m.codigo) ?? 0}º`, styles: { halign: 'center', fontStyle: 'bold', textColor: COR.goldText } },
      { content: m.nome.toUpperCase(), styles: { fontStyle: 'bold' } },
      { content: m.zonas.map(formatarZona2026).join(', '), styles: { textColor: COR.muted } },
      numero(formatarVotos2026(m.locais)),
      numero(formatarVotos2026(m.votos), { fontStyle: 'bold' }),
      numero(formatarPct2026(m.pctTotal), { fontStyle: 'bold', textColor: VERDE_TEXTO }),
    ])
    votosDe = (i) => o.linhas[i].votos
    colBarra = 4
    Object.assign(columnStyles, {
      0: { cellWidth: 16 },
      2: { cellWidth: 40 },
      3: { cellWidth: 22 },
      4: { cellWidth: W_BARRA + 18 },
      5: { cellWidth: 26 },
    })
  } else if (o.visao === 'locais') {
    const mun = o.mostrarMunicipio
    head = [
      ...(mun ? [{ content: 'MUNICÍPIO' } as CellDef] : []),
      { content: 'LOCAL DE VOTAÇÃO' },
      { content: 'BAIRRO' },
      numero('ZONA'),
      numero('SEÇÕES'),
      numero('VOTOS'),
      numero('% DO ESCOPO'),
    ]
    body = o.linhas.map((l) => [
      ...(mun ? [{ content: nomeProprio(l.municipioNome), styles: { fontStyle: 'bold' } } as CellDef] : []),
      {
        content: `${(l.local?.nome ?? 'Local não identificado').toUpperCase()}${l.local?.endereco ? `\n${l.local.endereco}` : ''}`,
        styles: { fontStyle: 'bold' },
      },
      { content: l.local?.bairro ?? '—', styles: { textColor: COR.muted } },
      numero(formatarZona2026(l.zona)),
      numero(`${l.secoes.filter((s) => s.v > 0).length} / ${l.secoes.length}`),
      numero(formatarVotos2026(l.votos), { fontStyle: 'bold' }),
      numero(formatarPct2026(l.pctEscopo), { fontStyle: 'bold', textColor: VERDE_TEXTO }),
    ])
    votosDe = (i) => o.linhas[i].votos
    const off = mun ? 1 : 0
    colBarra = 4 + off
    colDupla = off
    duplaDe = (i) => ({
      titulo: (o.linhas[i].local?.nome ?? 'Local não identificado').toUpperCase(),
      sub: o.linhas[i].local?.endereco ?? '',
    })
    if (mun) columnStyles[0] = { cellWidth: 32 }
    Object.assign(columnStyles, {
      [1 + off]: { cellWidth: 45 },
      [2 + off]: { cellWidth: 16 },
      [3 + off]: { cellWidth: 20 },
      [4 + off]: { cellWidth: W_BARRA + 18 },
      [5 + off]: { cellWidth: 26 },
    })
  } else {
    const mun = o.mostrarMunicipio
    head = [
      ...(mun ? [{ content: 'MUNICÍPIO' } as CellDef] : []),
      numero('ZONA'),
      numero('SEÇÃO'),
      { content: 'LOCAL DE VOTAÇÃO' },
      { content: 'BAIRRO' },
      numero('VOTOS'),
    ]
    body = o.linhas.map((s) => [
      ...(mun ? [{ content: nomeProprio(s.municipioNome), styles: { fontStyle: 'bold' } } as CellDef] : []),
      numero(formatarZona2026(s.z)),
      numero(formatarSecao2026(s.s), { fontStyle: 'bold' }),
      { content: s.local?.nome ?? '—' },
      { content: s.local?.bairro ?? '—', styles: { textColor: COR.muted } },
      numero(formatarVotos2026(s.v), { fontStyle: 'bold', textColor: s.v ? COR.text : COR.muted }),
    ])
    votosDe = (i) => o.linhas[i].v
    const off = mun ? 1 : 0
    colBarra = 4 + off
    if (mun) columnStyles[0] = { cellWidth: 32 }
    Object.assign(columnStyles, {
      [off]: { cellWidth: 16 },
      [1 + off]: { cellWidth: 16 },
      [3 + off]: { cellWidth: 55 },
      [4 + off]: { cellWidth: W_BARRA + 18 },
    })
  }

  let maxVotos = 0
  for (let i = 0; i < o.linhas.length; i++) maxVotos = Math.max(maxVotos, votosDe(i))

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
      fontSize: 8,
      textColor: COR.text,
      valign: 'middle',
      overflow: 'linebreak',
      cellPadding: { top: 1.6, bottom: 1.6, left: 2.5, right: 2.5 },
      lineColor: COR.trilho,
      lineWidth: { top: 0.2 },
    },
    headStyles: {
      fillColor: COR.bar,
      textColor: COR.muted,
      fontStyle: 'bold',
      fontSize: 6.8,
      lineWidth: 0,
      cellPadding: { top: 2.4, bottom: 2.4, left: 2.5, right: 2.5 },
    },
    columnStyles,
    willDrawPage: (d) => {
      if (d.pageNumber > 1) desenharFaixaSuperior(doc, fonteDados, o.meta)
    },
    willDrawCell: (d) => {
      if (d.section === 'body' && d.column.index === colDupla) d.cell.text = []
    },
    didDrawCell: (d) => {
      if (d.section !== 'body') return
      const c = d.cell
      if (d.column.index === colDupla) {
        const { titulo, sub } = duplaDe(d.row.index)
        const largura = c.width - 5
        const x = c.x + 2.5
        let yl = c.y + 1.6
        fonte(8, 'bold')
        tinta(COR.text)
        const linhasTitulo = doc.splitTextToSize(titulo, largura) as string[]
        doc.text(linhasTitulo, x, yl, { baseline: 'top' })
        yl += linhasTitulo.length * ((8 * 1.15 * 25.4) / 72)
        if (sub) {
          fonte(7)
          tinta(COR.muted)
          doc.text(doc.splitTextToSize(sub, largura) as string[], x, yl + 0.2, { baseline: 'top' })
        }
        return
      }
      if (d.column.index !== colBarra) return
      barra(c.x + 2.5, c.y + c.height / 2 - 0.9, W_BARRA - 6, 1.8, maxVotos ? votosDe(d.row.index) / maxVotos : 0, VERDE, TRILHO_BARRA)
    },
  })

  numerarPaginas(doc, `Resultado 2026 · ${TITULO[o.visao]} · ${nomeProprio(o.candidato.nome)}`)
  return doc
}

export function exportarResultadoPdf2026(o: OpcoesResultadoPdf2026): void {
  montarResultadoPdf2026(o).save(`${o.candidato.id}-2026-${o.visao}-${slugEscopo(o.escopoLabel)}-${o.modo}.pdf`)
}
