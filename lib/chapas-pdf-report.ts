/**
 * Relatório de Chapas em PDF (jsPDF puro) — uma página por partido, sem captura de tela.
 */
import { jsPDF } from 'jspdf'

export type ChapasPdfTipo = 'federais' | 'estaduais'

export interface ChapasPdfCandidatoLinha {
  ordem: number
  nome: string
  votos: number
}

export interface ChapasPdfPartidoDetalhe {
  nome: string
  elegivel: boolean
  votosProjetados: number
  projecaoEleitos: string
  votosLegenda: number
  homens: ChapasPdfCandidatoLinha[]
  mulheres: ChapasPdfCandidatoLinha[]
  disputaLinha1: string
  disputaLinha2?: string
  disputaNotasLinhas: string[]
}

export interface ChapasPdfSobraLinha {
  partido: string
  votosTotal: number
  vagasDiretas: number
  projecaoEleitos: string
  qp: string
}

export interface ChapasPdfEleitoLinha {
  partido: string
  posicao: number
  nome: string
  votos: number
  tipoEleicao: 'direta' | 'sobra'
}

export interface ChapasPdfInput {
  tipo: ChapasPdfTipo
  cenarioNome: string
  quociente: number
  quocienteMinimo: number
  numVagas: number
  totalVotos: number
  numElegiveis: number
  numPartidosVisiveis: number
  partidosDetalhe: ChapasPdfPartidoDetalhe[]
  tabelaSobras: ChapasPdfSobraLinha[]
  eleitos: ChapasPdfEleitoLinha[]
  distribuicao: {
    vagasDiretas: number
    vagasSobras: number
    vagasPorPartido: { partido: string; vagas: number }[]
  }
}

const M = 14
const LH = 5.2
const LH_SM = 4.6

function pw(pdf: jsPDF) {
  return pdf.internal.pageSize.getWidth()
}

function ph(pdf: jsPDF) {
  return pdf.internal.pageSize.getHeight()
}

function innerW(pdf: jsPDF) {
  return pw(pdf) - 2 * M
}

function yMax(pdf: jsPDF) {
  return ph(pdf) - M
}

function footer(pdf: jsPDF, sectionHint: string) {
  const pageNum = pdf.getNumberOfPages()
  pdf.setFontSize(7)
  pdf.setTextColor(110)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Chapas · ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`, M, ph(pdf) - 5)
  pdf.text(
    `Pag. ${pageNum}${sectionHint ? ` · ${sectionHint}` : ''}`,
    pw(pdf) - M,
    ph(pdf) - 5,
    { align: 'right' }
  )
  pdf.setTextColor(0)
}

function needSpace(pdf: jsPDF, y: number, h: number): number {
  if (y + h > yMax(pdf) - 8) {
    pdf.addPage()
    return M
  }
  return y
}

function drawWrapped(pdf: jsPDF, text: string, x: number, y: number, maxW: number, lineH: number): number {
  const lines = pdf.splitTextToSize(text, maxW)
  let yy = y
  for (const line of lines) {
    yy = needSpace(pdf, yy, lineH + 1)
    pdf.text(line, x, yy)
    yy += lineH
  }
  return yy
}

/** Cabecalho do relatorio; retorna Y (mm) para iniciar o primeiro partido na mesma pagina. */
function renderCapa(pdf: jsPDF, data: ChapasPdfInput): number {
  let y = M + 6
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('Simulador de Chapas', M, y)
  y += 8
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text(data.tipo === 'estaduais' ? 'Eleicoes estaduais' : 'Eleicoes federais', M, y)
  y += 10

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Resumo do cenario', M, y)
  y += 6
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9.5)

  const linhas = [
    `Cenario: ${data.cenarioNome}`,
    `QE: ${data.quociente.toLocaleString('pt-BR')} · Minimo (80%): ${data.quocienteMinimo.toLocaleString('pt-BR')}`,
    `Vagas em disputa: ${data.numVagas}`,
    `Total de votos (partidos visiveis): ${data.totalVotos.toLocaleString('pt-BR')}`,
    `Partidos elegiveis: ${data.numElegiveis} / ${data.numPartidosVisiveis}`,
    `Distribuicao D'Hondt: ${data.distribuicao.vagasDiretas} diretas + ${data.distribuicao.vagasSobras} sobras`,
  ]
  for (const L of linhas) {
    y = needSpace(pdf, y, LH)
    pdf.text(L, M, y)
    y += LH_SM
  }

  return y + 5
}

/** yContinuacao: quando definido, o partido comeca na mesma pagina apos o cabecalho (sem nova folha). */
function renderPartido(
  pdf: jsPDF,
  p: ChapasPdfPartidoDetalhe,
  quociente: number,
  yContinuacao?: number
): void {
  let y = typeof yContinuacao === 'number' ? yContinuacao : M + 4
  const w = innerW(pdf)

  if (typeof yContinuacao === 'number') {
    pdf.setDrawColor(210)
    pdf.setLineWidth(0.3)
    pdf.line(M, y, pw(pdf) - M, y)
    pdf.setLineWidth(0.2)
    y += 6
  }

  pdf.setFillColor(31, 95, 166)
  pdf.rect(M, y - 4, w, 10, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text(p.nome, M + 3, y + 2.5)
  pdf.setTextColor(0, 0, 0)
  y += 14

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  y = needSpace(pdf, y, LH * 5)
  pdf.text(`Elegivel (minimo QE): ${p.elegivel ? 'Sim' : 'Nao'}`, M, y)
  y += LH
  pdf.text(`Votos projetados: ${p.votosProjetados.toLocaleString('pt-BR')}`, M, y)
  y += LH
  pdf.text(`Projecao (votos / QE): ${p.projecaoEleitos}`, M, y)
  y += LH
  pdf.text(`Votos de legenda: ${p.votosLegenda.toLocaleString('pt-BR')}`, M, y)
  y += LH + 4

  const drawLista = (titulo: string, lista: ChapasPdfCandidatoLinha[]) => {
    if (lista.length === 0) return
    y = needSpace(pdf, y, 12)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10.5)
    pdf.text(titulo, M, y)
    y += 6
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(70)
    pdf.text('Nome', M + 6, y)
    pdf.text('Votos', pw(pdf) - M - 2, y, { align: 'right' })
    pdf.setTextColor(0)
    y += 4
    pdf.line(M, y, pw(pdf) - M, y)
    y += 5
    for (const c of lista) {
      const linha = `${c.ordem}. ${c.nome}`
      const wrapped = pdf.splitTextToSize(linha, w - 38)
      for (let i = 0; i < wrapped.length; i++) {
        y = needSpace(pdf, y, LH_SM + 1)
        pdf.text(wrapped[i]!, M + 6, y)
        if (i === wrapped.length - 1) {
          pdf.text(c.votos.toLocaleString('pt-BR'), pw(pdf) - M - 2, y, { align: 'right' })
        }
        y += LH_SM
      }
    }
    y += 4
  }

  drawLista('Candidatos (titulares / homens)', p.homens)
  drawLista('Candidatos (mulheres)', p.mulheres)

  y = needSpace(pdf, y, 14)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10.5)
  pdf.text('Disputa de sobras e observacoes', M, y)
  y += 7
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9.5)
  y = drawWrapped(pdf, p.disputaLinha1, M, y, w, LH_SM)
  if (p.disputaLinha2) {
    y += 2
    pdf.setFont('helvetica', 'bold')
    y = drawWrapped(pdf, p.disputaLinha2, M, y, w, LH_SM)
    pdf.setFont('helvetica', 'normal')
  }
  for (const nota of p.disputaNotasLinhas) {
    y += 2
    y = drawWrapped(pdf, nota, M, y, w, LH_SM)
  }

  y += 6
  y = needSpace(pdf, y, LH)
  pdf.setFontSize(8.5)
  pdf.setTextColor(100)
  pdf.text(
    `Conta: ${p.votosProjetados.toLocaleString('pt-BR')} / ${quociente.toLocaleString('pt-BR')} = ${p.projecaoEleitos}`,
    M,
    y
  )
  pdf.setTextColor(0)

  footer(pdf, p.nome)
}

/** Anexos A, B e C na mesma folha (quebra automatica se faltar espaco). */
function renderAnexosABC(pdf: jsPDF, data: ChapasPdfInput): void {
  let y = M + 4
  const w = innerW(pdf)

  const blocoEntreSecoes = () => {
    y += 4
    pdf.setDrawColor(220)
    pdf.setLineWidth(0.2)
    y = needSpace(pdf, y, 4)
    pdf.line(M, y, pw(pdf) - M, y)
    y += 8
  }

  // --- Anexo A ---
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  y = needSpace(pdf, y, 12)
  pdf.text('Anexo A — Quociente partidario (proxima sobra)', M, y)
  y += 7
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  y = needSpace(pdf, y, 6)
  pdf.text('QP = Votos / (vagas diretas + 1). Ordenacao por QP decrescente.', M, y)
  y += 6

  const x0 = M
  const x1 = M + 42
  const x2 = M + 82
  const x3 = M + 104
  const x4 = M + 126
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  y = needSpace(pdf, y, 10)
  pdf.text('Partido', x0, y)
  pdf.text('Votos', x1, y)
  pdf.text('V.dir.', x2, y)
  pdf.text('Proj.', x3, y)
  pdf.text('QP', x4, y)
  y += 3
  pdf.line(M, y, pw(pdf) - M, y)
  y += 4
  pdf.setFont('helvetica', 'normal')
  for (const r of data.tabelaSobras) {
    y = needSpace(pdf, y, LH)
    const nome = r.partido.length > 18 ? `${r.partido.slice(0, 16)}…` : r.partido
    pdf.text(nome, x0, y)
    pdf.text(r.votosTotal.toLocaleString('pt-BR'), x1, y)
    pdf.text(String(r.vagasDiretas), x2, y)
    pdf.text(r.projecaoEleitos, x3, y)
    pdf.text(r.qp, x4, y)
    y += LH_SM
  }

  blocoEntreSecoes()

  // --- Anexo B ---
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  y = needSpace(pdf, y, 10)
  pdf.text('Anexo B — Candidatos eleitos (projecao D-Hondt)', M, y)
  y += 7
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)

  const porPartido = new Map<string, ChapasPdfEleitoLinha[]>()
  for (const e of data.eleitos) {
    const arr = porPartido.get(e.partido) ?? []
    arr.push(e)
    porPartido.set(e.partido, arr)
  }
  const partidosOrd = [...porPartido.keys()].sort((a, b) => a.localeCompare(b))

  if (data.eleitos.length === 0) {
    y = needSpace(pdf, y, LH)
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(8.5)
    pdf.text('Nenhum eleito projetado com os dados atuais.', M, y)
    y += LH_SM
    pdf.setFont('helvetica', 'normal')
  } else {
    for (const partido of partidosOrd) {
      const lista = porPartido.get(partido) ?? []
      y = needSpace(pdf, y, 12)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text(partido, M, y)
      y += 5
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      for (const e of lista.sort((a, b) => a.posicao - b.posicao)) {
        y = needSpace(pdf, y, LH_SM + 2)
        const tipo = e.tipoEleicao === 'direta' ? 'Direta' : 'Sobra'
        const linha = `#${e.posicao}  ${e.nome}  ·  ${e.votos.toLocaleString('pt-BR')} votos  ·  ${tipo}`
        y = drawWrapped(pdf, linha, M + 4, y, w - 4, LH_SM)
      }
      y += 3
    }
  }

  blocoEntreSecoes()

  // --- Anexo C ---
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  y = needSpace(pdf, y, 10)
  pdf.text('Anexo C — Vagas por partido (apos D-Hondt)', M, y)
  y += 7
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  for (const vp of data.distribuicao.vagasPorPartido) {
    y = needSpace(pdf, y, LH)
    pdf.text(`${vp.partido}: ${vp.vagas} vaga(s)`, M, y)
    y += LH_SM
  }

  footer(pdf, 'Anexos A-C')
}

export function gerarRelatorioChapasPdf(data: ChapasPdfInput, nomeArquivoBase?: string): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const yAposCabecalho = renderCapa(pdf, data)
  const detalhes = data.partidosDetalhe

  if (detalhes.length > 0) {
    renderPartido(pdf, detalhes[0]!, data.quociente, yAposCabecalho)
  }
  for (let i = 1; i < detalhes.length; i++) {
    pdf.addPage()
    renderPartido(pdf, detalhes[i]!, data.quociente)
  }

  pdf.addPage()
  renderAnexosABC(pdf, data)

  const dataStr = new Date().toISOString().slice(0, 10)
  const safe = (nomeArquivoBase ?? `Chapas-${dataStr}`).replace(/[^\w\-]+/g, '_')
  pdf.save(`${safe}.pdf`)
}
