import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatarPct2026, formatarVotos2026, type ResultadoSecao2026Meta } from '@/lib/resultado-secao-2026'
import type { ColunaComparativoBase, RecorteComparativoBase } from '@/lib/comparativo-base-2026'
import { COR, desenharCabecalho, numerarPaginas, slugEscopo } from './pdf-base-2026'

export function exportarComparativoBasePdf2026(o: {
  meta: ResultadoSecao2026Meta
  fonteDados: string
  cargo: string
  recorte: RecorteComparativoBase
  descricao: string
  colunas: { nome: string; partido: string; dados: ColunaComparativoBase }[]
}): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const y = desenharCabecalho(doc, {
    titulo: 'Comparativo de base',
    descricao: `${o.cargo} · ${o.descricao}`,
    fonteDados: o.fonteDados,
    meta: o.meta,
  })
  const pct = (n: number | null): string => (n == null ? '—' : formatarPct2026(n, 1))
  const head = ['', ...o.colunas.map((c) => c.nome)]
  const linha = (rotulo: string, valor: (c: ColunaComparativoBase) => string) => [
    rotulo,
    ...o.colunas.map((c) => valor(c.dados)),
  ]
  autoTable(doc, {
    startY: y,
    margin: { top: 12, left: 10, right: 10, bottom: 10 },
    head: [head],
    body: [
      linha('Cidades', (d) => formatarVotos2026(d.cidades.length)),
      linha('Votos nessas cidades', (d) => formatarVotos2026(d.votos)),
      linha('Eleitores', (d) => formatarVotos2026(d.eleitores)),
      linha('Votantes', (d) => formatarVotos2026(d.votantes)),
      linha('% dos eleitores', (d) => pct(d.pctEleitores)),
      linha('% dos votantes', (d) => pct(d.pctVotantes)),
    ],
    styles: { font: 'helvetica', fontSize: 9, textColor: COR.text, cellPadding: 2 },
    headStyles: { fillColor: COR.bar, textColor: COR.muted, fontStyle: 'bold' },
    columnStyles: Object.fromEntries(o.colunas.map((_, i) => [i + 1, { halign: 'right' as const, fontStyle: 'bold' as const }])),
  })

  let cursor = fimDaTabela(doc, y) + 8
  for (const coluna of o.colunas) {
    if (cursor > 180) {
      doc.addPage()
      cursor = 14
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...COR.text)
    doc.text(`${coluna.nome}${coluna.partido ? ` · ${coluna.partido}` : ''}`, 10, cursor)
    autoTable(doc, {
      startY: cursor + 2,
      margin: { left: 10, right: 10, bottom: 10 },
      head: [['Município', 'Votos', '% dos eleitores', '% dos votantes']],
      body: coluna.dados.cidades.map((c) => [
        c.nome,
        formatarVotos2026(c.votos),
        pct(c.pctEleitores),
        pct(c.pctVotantes),
      ]),
      styles: { font: 'helvetica', fontSize: 8, textColor: COR.text, cellPadding: 1.4 },
      headStyles: { fillColor: COR.bar, textColor: COR.muted, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    })
    cursor = fimDaTabela(doc, cursor) + 8
  }

  numerarPaginas(doc, `Comparativo de base · ${o.cargo}`)
  const dia = new Date().toISOString().slice(0, 10)
  doc.save(`${slugEscopo(`comparativo-base ${o.cargo}`) || 'comparativo-base'}-${dia}.pdf`)
}

const fimDaTabela = (doc: jsPDF, padrao: number): number =>
  (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? padrao
