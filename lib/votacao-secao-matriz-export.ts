import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { applyPlugin, type UserOptions } from 'jspdf-autotable'
import {
  paresSemelhantesAgregados,
  type ParSemelhanteSecao,
} from '@/lib/votacao-secao-correlacao'
import {
  agruparMatrizPorBairro,
  agruparMatrizPorLocal,
  type CandidatoMatrizColuna,
  type GrupoLocalMatriz,
  type LinhaMatrizSecao,
  type MatrizVotacaoSecao,
} from '@/lib/votacao-secao-matriz'

applyPlugin(jsPDF)

type JsPdfWithAutoTable = InstanceType<typeof jsPDF> & {
  autoTable: (options: UserOptions) => InstanceType<typeof jsPDF>
}

export type AgrupamentoExportMatriz = 'bairro' | 'local'

export type OpcoesExportMatrizSecao = {
  matriz: MatrizVotacaoSecao
  agrupamento: AgrupamentoExportMatriz
  municipio?: string
  filtroSoSemelhantes?: boolean
  destacarSemelhanca?: boolean
  paresPorSecao?: Map<string, ParSemelhanteSecao[]>
  margemSemelhancaPct?: number
}

function slugArquivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 48)
}

function dataArquivo(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rotuloCandidatoColuna(c: CandidatoMatrizColuna): string {
  const ano = c.anoEleicao != null ? ` ${c.anoEleicao}` : ''
  return `${c.dsCargo}${ano} · ${c.nmVotavel} (${c.nrVotavel})`
}

function textoSemelhancas(
  secoes: LinhaMatrizSecao[],
  paresPorSecao: Map<string, ParSemelhanteSecao[]> | undefined,
  destacar: boolean
): string {
  if (!destacar || !paresPorSecao) return ''
  const pares = paresSemelhantesAgregados(secoes, paresPorSecao)
  if (pares.length === 0) return ''
  return pares.map((p) => `${p.nomeA}≈${p.nomeB}`).join('; ')
}

function grupoTemSemelhanca(
  secoes: LinhaMatrizSecao[],
  paresPorSecao: Map<string, ParSemelhanteSecao[]> | undefined
): boolean {
  if (!paresPorSecao) return false
  return secoes.some((s) => (paresPorSecao.get(s.localId)?.length ?? 0) > 0)
}

function votosParaColunas(
  votos: Record<string, number>,
  candidatos: CandidatoMatrizColuna[]
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of candidatos) {
    out[rotuloCandidatoColuna(c)] = votos[c.id] ?? 0
  }
  return out
}

function secoesDoLocal(
  local: GrupoLocalMatriz,
  filtroSoSemelhantes: boolean,
  destacar: boolean,
  paresPorSecao: Map<string, ParSemelhanteSecao[]> | undefined
): LinhaMatrizSecao[] {
  if (!filtroSoSemelhantes || !destacar || !paresPorSecao) return local.secoes
  return local.secoes.filter((s) => (paresPorSecao.get(s.localId)?.length ?? 0) > 0)
}

function linhaBase(opts: {
  nivel: string
  bairro: string
  local: string
  zona: number | ''
  secao: number | ''
  votos: Record<string, number>
  candidatos: CandidatoMatrizColuna[]
  semelhancas: string
}): Record<string, string | number> {
  return {
    Nível: opts.nivel,
    Bairro: opts.bairro,
    Local: opts.local,
    Zona: opts.zona,
    Seção: opts.secao,
    ...votosParaColunas(opts.votos, opts.candidatos),
    Semelhanças: opts.semelhancas,
  }
}

/** Flatten hierárquico da matriz (respeita filtro “só semelhantes”). */
export function buildLinhasExportMatrizSecao(
  opts: OpcoesExportMatrizSecao
): Record<string, string | number>[] {
  const {
    matriz,
    agrupamento,
    filtroSoSemelhantes = false,
    destacarSemelhanca = false,
    paresPorSecao,
  } = opts
  const candidatos = matriz.candidatos
  const linhas: Record<string, string | number>[] = []

  if (candidatos.length === 0) return linhas

  if (agrupamento === 'bairro') {
    let bairros = agruparMatrizPorBairro(matriz.linhas)
    if (filtroSoSemelhantes && destacarSemelhanca) {
      bairros = bairros.filter((b) =>
        b.locais.some((l) => grupoTemSemelhanca(l.secoes, paresPorSecao))
      )
    }
    for (const bairro of bairros) {
      const secoesBairro = bairro.locais.flatMap((l) =>
        secoesDoLocal(l, filtroSoSemelhantes, destacarSemelhanca, paresPorSecao)
      )
      linhas.push(
        linhaBase({
          nivel: 'Bairro',
          bairro: bairro.nmBairro,
          local: `${bairro.totalLocais} locais · ${bairro.totalSecoes} seções`,
          zona: '',
          secao: '',
          votos: bairro.votos,
          candidatos,
          semelhancas: textoSemelhancas(secoesBairro, paresPorSecao, destacarSemelhanca),
        })
      )
      for (const local of bairro.locais) {
        if (
          filtroSoSemelhantes &&
          destacarSemelhanca &&
          !grupoTemSemelhanca(local.secoes, paresPorSecao)
        ) {
          continue
        }
        const secoes = secoesDoLocal(
          local,
          filtroSoSemelhantes,
          destacarSemelhanca,
          paresPorSecao
        )
        linhas.push(
          linhaBase({
            nivel: 'Local',
            bairro: bairro.nmBairro,
            local: local.nmLocalVotacao?.trim() || `Local ${local.nrLocalVotacao ?? '—'}`,
            zona: local.nrZona,
            secao: '',
            votos: local.votos,
            candidatos,
            semelhancas: textoSemelhancas(secoes, paresPorSecao, destacarSemelhanca),
          })
        )
        for (const secao of secoes) {
          linhas.push(
            linhaBase({
              nivel: 'Seção',
              bairro: bairro.nmBairro,
              local: local.nmLocalVotacao?.trim() || `Local ${local.nrLocalVotacao ?? '—'}`,
              zona: secao.nrZona,
              secao: secao.nrSecao,
              votos: secao.votos,
              candidatos,
              semelhancas: textoSemelhancas([secao], paresPorSecao, destacarSemelhanca),
            })
          )
        }
      }
    }
  } else {
    let locais = agruparMatrizPorLocal(matriz.linhas)
    if (filtroSoSemelhantes && destacarSemelhanca) {
      locais = locais.filter((l) => grupoTemSemelhanca(l.secoes, paresPorSecao))
    }
    for (const local of locais) {
      const secoes = secoesDoLocal(
        local,
        filtroSoSemelhantes,
        destacarSemelhanca,
        paresPorSecao
      )
      linhas.push(
        linhaBase({
          nivel: 'Local',
          bairro: local.nmBairro?.trim() || '—',
          local: local.nmLocalVotacao?.trim() || `Local ${local.nrLocalVotacao ?? '—'}`,
          zona: local.nrZona,
          secao: '',
          votos: local.votos,
          candidatos,
          semelhancas: textoSemelhancas(secoes, paresPorSecao, destacarSemelhanca),
        })
      )
      for (const secao of secoes) {
        linhas.push(
          linhaBase({
            nivel: 'Seção',
            bairro: local.nmBairro?.trim() || '—',
            local: local.nmLocalVotacao?.trim() || `Local ${local.nrLocalVotacao ?? '—'}`,
            zona: secao.nrZona,
            secao: secao.nrSecao,
            votos: secao.votos,
            candidatos,
            semelhancas: textoSemelhancas([secao], paresPorSecao, destacarSemelhanca),
          })
        )
      }
    }
  }

  const totais: Record<string, number> = {}
  for (const c of candidatos) totais[c.id] = c.totalVotos
  linhas.push(
    linhaBase({
      nivel: 'Total',
      bairro: 'Total no município',
      local: '',
      zona: '',
      secao: '',
      votos: totais,
      candidatos,
      semelhancas: '',
    })
  )

  return linhas
}

function nomeArquivoBase(municipio?: string): string {
  const mun = municipio?.trim() ? slugArquivo(municipio) : 'municipio'
  return `votacao-secao-${mun}-${dataArquivo()}`
}

export function exportarMatrizSecaoXls(opts: OpcoesExportMatrizSecao): void {
  const rows = buildLinhasExportMatrizSecao(opts)
  const ws = XLSX.utils.json_to_sheet(
    rows.length
      ? rows
      : [{ Nível: 'Sem dados', Bairro: '', Local: '', Zona: '', Seção: '', Semelhanças: '' }]
  )
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Matriz seções')
  XLSX.writeFile(wb, `${nomeArquivoBase(opts.municipio)}.xlsx`)
}

export function exportarMatrizSecaoPdf(opts: OpcoesExportMatrizSecao): void {
  const rows = buildLinhasExportMatrizSecao(opts)
  const candidatos = opts.matriz.candidatos
  const head = [
    'Nível',
    'Bairro',
    'Local',
    'Zona',
    'Seção',
    ...candidatos.map((c) => {
      const primeiro = c.nmVotavel.trim().split(/\s+/)[0] ?? c.nmVotavel
      return `${primeiro}`
    }),
    ...(opts.destacarSemelhanca ? ['Semelh.'] : []),
  ]

  const body = rows.map((r) => {
    const base = [
      String(r['Nível'] ?? ''),
      String(r['Bairro'] ?? ''),
      String(r['Local'] ?? ''),
      r['Zona'] === '' ? '' : String(r['Zona']),
      r['Seção'] === '' ? '' : String(r['Seção']),
      ...candidatos.map((c) => {
        const v = r[rotuloCandidatoColuna(c)]
        return typeof v === 'number' ? v.toLocaleString('pt-BR') : String(v ?? '0')
      }),
    ]
    if (opts.destacarSemelhanca) base.push(String(r['Semelhanças'] ?? ''))
    return base
  })

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  }) as JsPdfWithAutoTable

  const municipio = opts.municipio?.trim() || 'Município'
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`Votação por seção — ${municipio}`, 10, 12)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const filtro = opts.filtroSoSemelhantes ? ' · só seções semelhantes' : ''
  const agrup = opts.agrupamento === 'bairro' ? 'por bairro' : 'por local'
  doc.text(
    `Matriz comparativa (${agrup})${filtro} · gerado em ${new Date().toLocaleString('pt-BR')}`,
    10,
    17
  )

  doc.autoTable({
    startY: 21,
    head: [head],
    body,
    styles: { fontSize: 6.5, cellPadding: 1.2 },
    headStyles: { fillColor: [245, 158, 11], textColor: 20, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    margin: { left: 8, right: 8 },
  })

  doc.save(`${nomeArquivoBase(opts.municipio)}.pdf`)
}
