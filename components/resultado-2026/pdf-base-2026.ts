import type { jsPDF } from 'jspdf'
import type { ResultadoSecao2026Meta } from '@/lib/resultado-secao-2026'
import { normalizarTexto } from './tse-ui'

export type Rgb = [number, number, number]

export function rgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export const COR = {
  yellow: rgb('#EBB402'),
  yellowSoft: rgb('#FFF8D6'),
  gold: rgb('#E2B41B'),
  goldText: rgb('#B8960B'),
  text: rgb('#333333'),
  muted: rgb('#717171'),
  bg: rgb('#F4F4F2'),
  bar: rgb('#F9F9F9'),
  zero: rgb('#D9D9D9'),
  trilho: rgb('#EEEEEE'),
  branco: [255, 255, 255] as Rgb,
}

export const MARGEM = 10

export function ferramentasPdf(doc: jsPDF) {
  const preencher = (c: Rgb) => doc.setFillColor(c[0], c[1], c[2])
  const contorno = (c: Rgb) => doc.setDrawColor(c[0], c[1], c[2])
  const tinta = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2])
  const fonte = (tam: number, estilo: 'bold' | 'normal' = 'normal') => {
    doc.setFont('helvetica', estilo)
    doc.setFontSize(tam)
  }

  const pilula = (texto: string, x: number, y: number, fundo: Rgb, cor: Rgb): number => {
    fonte(7, 'bold')
    const w = doc.getTextWidth(texto) + 5
    const h = 4.6
    preencher(fundo)
    doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F')
    tinta(cor)
    doc.text(texto, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' })
    return x + w
  }

  const barra = (x: number, y: number, w: number, h: number, frac: number, cor: Rgb, trilho: Rgb) => {
    const r = h / 2
    preencher(trilho)
    doc.roundedRect(x, y, w, h, r, r, 'F')
    const wf = Math.max(0, Math.min(1, frac)) * w
    if (wf > 0) {
      preencher(cor)
      doc.roundedRect(x, y, wf, h, Math.min(r, wf / 2), Math.min(r, wf / 2), 'F')
    }
  }

  /** Segmentos proporcionais a `valores`, cada um na cor de mesma posição. */
  const barraEmpilhada = (x: number, y: number, w: number, h: number, valores: number[], cores: Rgb[]) => {
    preencher(COR.zero)
    doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F')
    const total = valores.reduce((a, b) => a + b, 0)
    if (!total) return
    let xs = x
    valores.forEach((v, i) => {
      const ws = (v / total) * w
      if (ws <= 0) return
      preencher(cores[i])
      doc.rect(xs, y, ws, h, 'F')
      xs += ws
    })
  }

  return { preencher, contorno, tinta, fonte, pilula, barra, barraEmpilhada }
}

export function desenharFaixaSuperior(doc: jsPDF, fonteDados: string, meta: ResultadoSecao2026Meta): void {
  const { preencher, tinta, fonte } = ferramentasPdf(doc)
  const W = doc.internal.pageSize.getWidth()
  preencher(COR.yellow)
  doc.rect(0, 0, W, 7, 'F')
  fonte(7, 'bold')
  tinta(COR.branco)
  doc.text(`Fonte: ${fonteDados}   |   ${meta.eleicao} · ${meta.turno}º turno`, W - MARGEM, 4.6, { align: 'right' })
}

/** Desenha a faixa, o selo ELEIÇÕES 2026, título e descrição; devolve o Y livre abaixo do cabeçalho. */
export function desenharCabecalho(
  doc: jsPDF,
  o: { titulo: string; descricao: string; fonteDados: string; meta: ResultadoSecao2026Meta },
): number {
  const { contorno, tinta, fonte } = ferramentasPdf(doc)
  const W = doc.internal.pageSize.getWidth()
  desenharFaixaSuperior(doc, o.fonteDados, o.meta)
  let y = 12
  fonte(7, 'bold')
  tinta(COR.text)
  doc.text('ELEIÇÕES', MARGEM, y + 2.5)
  fonte(20, 'bold')
  tinta(COR.yellow)
  doc.text('2026', MARGEM, y + 10)
  const xTitulo = MARGEM + 26
  fonte(14, 'bold')
  tinta(COR.text)
  doc.text(o.titulo, xTitulo, y + 4.5)
  fonte(8)
  tinta(COR.muted)
  const linhas = doc.splitTextToSize(o.descricao, W - xTitulo - MARGEM - 50) as string[]
  doc.text(linhas.slice(0, 2), xTitulo, y + 9.5)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, W - MARGEM, y + 4.5, { align: 'right' })
  y += linhas.length > 1 ? 18 : 15
  contorno(COR.trilho)
  doc.setLineWidth(0.3)
  doc.line(MARGEM, y, W - MARGEM, y)
  return y + 5
}

export function numerarPaginas(doc: jsPDF, rotulo: string): void {
  const { tinta, fonte } = ferramentasPdf(doc)
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    fonte(7)
    tinta(COR.muted)
    doc.text(rotulo, MARGEM, H - 5)
    doc.text(`Página ${p} de ${paginas}`, W - MARGEM, H - 5, { align: 'right' })
  }
}

export const slugEscopo = (texto: string): string =>
  normalizarTexto(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
