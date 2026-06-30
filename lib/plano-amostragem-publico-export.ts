import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { applyPlugin, type UserOptions } from 'jspdf-autotable'
import type { PlanoAmostragemPublico } from '@/lib/plano-amostragem-publico-types'

let jspdfAutotableApplied = false

function ensureJspdfAutotable(): void {
  if (!jspdfAutotableApplied) {
    applyPlugin(jsPDF)
    jspdfAutotableApplied = true
  }
}

type JsPdfWithAutoTable = InstanceType<typeof jsPDF> & {
  autoTable: (options: UserOptions) => InstanceType<typeof jsPDF>
  lastAutoTable: false | { finalY: number }
}

function slugArquivo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function formatData(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function exportarPlanoAmostragemExcel(plano: PlanoAmostragemPublico): void {
  const wb = XLSX.utils.book_new()

  const resumoRows = [
    ['Plano de amostragem — público para pesquisa'],
    ['Município', plano.municipio],
    ['Código IBGE', plano.codigoIbge],
    ['Território de Desenvolvimento', plano.territorio ?? '—'],
    ['População Censo 2022', plano.populacaoCenso2022],
    ['População estimada', `${plano.populacaoEstimada} (${plano.anoEstimativa ?? '—'})`],
    ['Eleitorado (TRE)', plano.eleitorado ?? '—'],
    ['Taxa urbana / rural (%)', `${plano.taxaUrbanaPct}% / ${plano.taxaRuralPct}%`],
    ['Tipo de pesquisa', plano.tipoPesquisa === 'eleitoral' ? 'Eleitoral' : 'Opinião pública'],
    ['Instituto destino', plano.institutoDestino ?? '—'],
    ['Amostra (N)', plano.amostraTotal],
    ['Entrevistadores previstos', plano.entrevistadoresPrevistos],
    ['Gerado em', formatData(plano.geradoEm)],
    [],
    ['Metodologia', plano.metodologiaResumo],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumoRows), 'Resumo')

  const blocosSheet = XLSX.utils.json_to_sheet(
    plano.divisaoTerritorial.map((b) => ({
      Bloco: b.nome,
      Tipo: b.tipo,
      'Entrevistas (N)': b.entrevistas,
      '% no estrato': b.pesoPct,
      '% da amostra': b.pctAmostra,
      Observações: b.notas ?? '',
    })),
  )
  XLSX.utils.book_append_sheet(wb, blocosSheet, 'Blocos territoriais')

  const cotasSheet = XLSX.utils.json_to_sheet([
    ...plano.cotasSexo.map((c) => ({ Categoria: 'Sexo', Perfil: c.perfil, Meta: c.meta, '%': c.pct })),
    ...plano.cotasIdade.map((c) => ({ Categoria: 'Idade', Perfil: c.perfil, Meta: c.meta, '%': c.pct })),
    ...plano.cotasHorario.map((c) => ({ Categoria: 'Horário', Perfil: c.perfil, Meta: c.meta, '%': c.pct })),
  ])
  XLSX.utils.book_append_sheet(wb, cotasSheet, 'Cotas')

  const equipeSheet = XLSX.utils.json_to_sheet(
    plano.equipeCampo.map((e) => ({
      Entrevistador: e.entrevistador,
      Entrevistas: e.entrevistas,
      'Blocos sugeridos': e.blocosSugeridos,
    })),
  )
  XLSX.utils.book_append_sheet(wb, equipeSheet, 'Equipe campo')

  const regrasRows = [
    ['Regras de campo'],
    ...plano.regrasCampo.map((r, i) => [`${i + 1}.`, r]),
    [],
    ['Regras de sorteio / elegibilidade'],
    ...plano.regrasSorteio.map((r, i) => [`${i + 1}.`, r]),
    [],
    ['Auditoria'],
    ...plano.auditoria.map((r, i) => [`${i + 1}.`, r]),
    [],
    ['Avisos'],
    ...plano.avisos.map((r, i) => [`${i + 1}.`, r]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(regrasRows), 'Regras e avisos')

  const dia = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `plano-amostragem-${slugArquivo(plano.municipio)}-${dia}.xlsx`)
}

export function exportarPlanoAmostragemPdf(plano: PlanoAmostragemPublico): void {
  ensureJspdfAutotable()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable

  doc.setFontSize(14)
  doc.text('Plano de amostragem — público para pesquisa', 14, 18)
  doc.setFontSize(10)
  doc.text(`${plano.municipio} (PI) · N=${plano.amostraTotal} · ${formatData(plano.geradoEm)}`, 14, 26)

  doc.setFontSize(9)
  const linhasResumo = [
    `IBGE: ${plano.codigoIbge} · TD: ${plano.territorio ?? '—'}`,
    `População: ${plano.populacaoCenso2022.toLocaleString('pt-BR')} (Censo 2022) · Eleitorado: ${plano.eleitorado?.toLocaleString('pt-BR') ?? '—'}`,
    `Urbano/rural: ${plano.taxaUrbanaPct}% / ${plano.taxaRuralPct}% · Tipo: ${plano.tipoPesquisa === 'eleitoral' ? 'Eleitoral' : 'Opinião'}`,
    plano.institutoDestino ? `Instituto: ${plano.institutoDestino}` : '',
    plano.metodologiaResumo,
  ].filter(Boolean)

  let y = 32
  for (const linha of linhasResumo) {
    const wrapped = doc.splitTextToSize(linha, 182)
    doc.text(wrapped, 14, y)
    y += wrapped.length * 4.5 + 2
  }

  doc.autoTable({
    startY: y + 2,
    head: [['Bloco territorial', 'Tipo', 'N', '% estrato', '% amostra']],
    body: plano.divisaoTerritorial.map((b) => [
      b.nome,
      b.tipo,
      String(b.entrevistas),
      `${b.pesoPct}%`,
      `${b.pctAmostra}%`,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 74] },
  })

  const y2 = (doc.lastAutoTable && typeof doc.lastAutoTable === 'object'
    ? doc.lastAutoTable.finalY
    : y + 20) + 8

  doc.autoTable({
    startY: y2,
    head: [['Cota', 'Perfil', 'Meta', '%']],
    body: [
      ...plano.cotasSexo.map((c) => ['Sexo', c.perfil, String(c.meta), `${c.pct}%`]),
      ...plano.cotasIdade.map((c) => ['Idade', c.perfil, String(c.meta), `${c.pct}%`]),
      ...plano.cotasHorario.map((c) => ['Horário', c.perfil, String(c.meta), `${c.pct}%`]),
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 74] },
  })

  const y3 = (doc.lastAutoTable && typeof doc.lastAutoTable === 'object'
    ? doc.lastAutoTable.finalY
    : y2 + 20) + 8

  doc.setFontSize(9)
  doc.text('Avisos metodológicos', 14, y3)
  let yAviso = y3 + 6
  for (const aviso of plano.avisos) {
    const wrapped = doc.splitTextToSize(`• ${aviso}`, 182)
    if (yAviso + wrapped.length * 4 > 280) {
      doc.addPage()
      yAviso = 18
    }
    doc.text(wrapped, 14, yAviso)
    yAviso += wrapped.length * 4 + 2
  }

  const dia = new Date().toISOString().slice(0, 10)
  doc.save(`plano-amostragem-${slugArquivo(plano.municipio)}-${dia}.pdf`)
}
