import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { applyPlugin, type UserOptions } from 'jspdf-autotable'
import type { PlanoAmostragemPublico } from '@/lib/plano-amostragem-publico-types'
import {
  montarRoteiroCampo,
  type ContextoRoteiroCampo,
  type FichaCampoEntrevista,
} from '@/lib/plano-amostragem-campo'

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

const COLUNAS_FICHA = [
  'ID ficha',
  'Entrevistador',
  'Seq. global',
  'Seq. entrevistador',
  'Turno recomendado',
  'Bloco sugerido',
  'Tipo bloco',
  'Local sugerido',
  'Bairro / recorte',
  'Instrução de campo',
  'Data',
  'Horário início',
  'Sexo (M/F)',
  'Faixa etária',
  'Endereço / ponto',
  'Latitude',
  'Longitude',
  'Resultado',
  'Observações',
  'Auditoria OK',
] as const

function fichaParaLinhaExport(f: FichaCampoEntrevista) {
  return {
    'ID ficha': f.id,
    Entrevistador: f.entrevistador,
    'Seq. global': f.sequencia,
    'Seq. entrevistador': f.sequenciaEntrevistador,
    'Turno recomendado': f.turnoRecomendado,
    'Bloco sugerido': f.blocoSugerido,
    'Tipo bloco': f.tipoBloco,
    'Local sugerido': f.localCampo,
    'Bairro / recorte': f.bairroRecorte ?? '',
    'Instrução de campo': f.instrucaoCampo,
    Data: '',
    'Horário início': '',
    'Sexo (M/F)': '',
    'Faixa etária': '',
    'Endereço / ponto': f.enderecoSugerido ?? '',
    Latitude: f.latitudeSugerida ?? '',
    Longitude: f.longitudeSugerida ?? '',
    Resultado: '',
    Observações: '',
    'Auditoria OK': '',
  }
}

export function exportarRoteiroCampoExcel(
  plano: PlanoAmostragemPublico,
  ctx: ContextoRoteiroCampo = {},
): void {
  const roteiro = montarRoteiroCampo(plano, ctx)
  const wb = XLSX.utils.book_new()

  const capa = [
    ['Roteiro de campo — pesquisa'],
    ['Município', plano.municipio],
    ['IBGE', plano.codigoIbge],
    ['Tipo', plano.tipoPesquisa === 'eleitoral' ? 'Eleitoral' : 'Opinião pública'],
    ['Instituto', plano.institutoDestino ?? '—'],
    ['Amostra (N)', plano.amostraTotal],
    ['Entrevistadores', roteiro.totalEntrevistadores],
    ['Fichas geradas', roteiro.fichas.length],
    ['Fonte pontos', ctx.usarSetoresIbge ? 'Setores censitários IBGE' : 'Locais de votação TSE'],
    [],
    ['Instruções'],
    ['1. Cada ficha indica ONDE ir (local TSE ou setor IBGE) dentro do bloco territorial.'],
    ['2. Preencher uma linha por entrevista realizada.'],
    ['3. Registrar sexo, idade e horário para conferência de cotas.'],
    ['4. GPS sugerido é ponto de partida — anotar coordenada real se diferente.'],
    ['5. Resultado: completa | recusa | ausente | inelegivel'],
    ['6. Auditoria mínima 10% · recomendada 20% · dirigida 100% nos casos suspeitos.'],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(capa), 'Capa')

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      plano.equipeCampo.map((e) => ({
        Entrevistador: e.entrevistador,
        'Meta entrevistas': e.entrevistas,
        'Blocos sugeridos': e.blocosSugeridos,
      })),
    ),
    'Roteiro equipe',
  )

  const pontosGuia = roteiro.pontosPorBloco
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      pontosGuia.map((p) => ({
        Bloco: p.blocoNome,
        'Local / setor': p.titulo,
        'Bairro / recorte': p.bairroRecorte ?? '',
        Endereço: p.endereco ?? '',
        Latitude: p.lat ?? '',
        Longitude: p.lng ?? '',
        Fonte: p.fonte === 'tse' ? 'TSE 2024' : p.fonte === 'ibge' ? 'IBGE 2022' : 'Genérico',
        Instrução: p.instrucao,
      })),
    ),
    'Guia pontos',
  )

  if (roteiro.validacao.checklist.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        roteiro.validacao.checklist.map((c) => ({
          Item: c.label,
          Status: c.status === 'ok' ? 'OK' : c.status === 'warn' ? 'Revisar' : 'Erro',
          Detalhe: c.detalhe ?? '',
        })),
      ),
      'Checklist',
    )
  }

  if (roteiro.validacao.avisos.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Validação do roteiro'],
        ['Status', roteiro.validacao.ok ? 'OK' : 'Revisar'],
        [],
        ...roteiro.validacao.avisos.map((a) => [a]),
      ]),
      'Validação',
    )
  }

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      roteiro.monitorCotas.map((c) => ({
        Categoria: c.categoria,
        Perfil: c.perfil,
        Meta: c.meta,
        '%': c.pct,
        Realizado: c.realizado,
        Pendente: c.pendente,
      })),
    ),
    'Monitor cotas',
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(roteiro.fichas.map(fichaParaLinhaExport)),
    'Fichas campo',
  )

  for (const membro of plano.equipeCampo) {
    const fichasMembro = roteiro.fichas.filter((f) => f.entrevistador === membro.entrevistador)
    if (fichasMembro.length === 0) continue
    const nomeAba = `Ent_${String(membro.entrevistador).padStart(2, '0')}`.slice(0, 31)
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(fichasMembro.map(fichaParaLinhaExport)),
      nomeAba,
    )
  }

  const dia = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `roteiro-campo-${slugArquivo(plano.municipio)}-${dia}.xlsx`)
}

export function exportarRoteiroCampoPdf(
  plano: PlanoAmostragemPublico,
  ctx: ContextoRoteiroCampo = {},
): void {
  ensureJspdfAutotable()
  const roteiro = montarRoteiroCampo(plano, ctx)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable

  for (const membro of plano.equipeCampo) {
    const fichasMembro = roteiro.fichas.filter((f) => f.entrevistador === membro.entrevistador)

    doc.setFontSize(13)
    doc.text(`Roteiro de campo — Entrevistador ${membro.entrevistador}`, 14, 16)
    doc.setFontSize(9)
    doc.text(
      `${plano.municipio} (PI) · N=${plano.amostraTotal} · ${plano.tipoPesquisa === 'eleitoral' ? 'Eleitoral' : 'Opinião'}`,
      14,
      22,
    )
    doc.text(`Blocos: ${membro.blocosSugeridos}`, 14, 28)

    doc.autoTable({
      startY: 34,
      head: [['#', 'Turno', 'Bloco', 'Onde ir (local/setor)', 'Bairro', 'GPS', 'Data', 'Resultado']],
      body: fichasMembro.map((f) => [
        String(f.sequenciaEntrevistador),
        f.turnoRecomendado,
        f.blocoSugerido,
        f.localCampo,
        f.bairroRecorte ?? '',
        f.latitudeSugerida != null && f.longitudeSugerida != null
          ? `${f.latitudeSugerida.toFixed(5)}, ${f.longitudeSugerida.toFixed(5)}`
          : '',
        '',
        '',
      ]),
      styles: { fontSize: 6.5, cellPadding: 1.2 },
      headStyles: { fillColor: [30, 58, 74] },
      columnStyles: {
        0: { cellWidth: 7 },
        1: { cellWidth: 12 },
        2: { cellWidth: 24 },
        3: { cellWidth: 38 },
        4: { cellWidth: 18 },
        5: { cellWidth: 24 },
        6: { cellWidth: 12 },
        7: { cellWidth: 14 },
      },
    })

    const y =
      (doc.lastAutoTable && typeof doc.lastAutoTable === 'object'
        ? doc.lastAutoTable.finalY
        : 34) + 6

    doc.setFontSize(7)
    doc.text(
      'Instruções por ficha no Excel (aba Fichas campo). GPS = ponto de partida sugerido. Auditoria: mín. 10%, recom. 20%.',
      14,
      y,
    )

    if (membro.entrevistador < plano.equipeCampo.length) {
      doc.addPage()
    }
  }

  const dia = new Date().toISOString().slice(0, 10)
  doc.save(`roteiro-campo-${slugArquivo(plano.municipio)}-${dia}.pdf`)
}

export { COLUNAS_FICHA }
