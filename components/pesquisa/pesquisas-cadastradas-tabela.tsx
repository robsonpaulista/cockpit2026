'use client'

import { useMemo, useState } from 'react'
import { Edit2, FileText, Trash2 } from 'lucide-react'
import { TseCarregarMais, TseThOrdenavel, tseTabela } from '@/components/tse/tse-ui'
import {
  CARGO_PESQUISA_LABEL,
  TIPO_PESQUISA_LABEL,
  type Pesquisa,
} from '@/lib/services/pesquisa-client'
import { cn } from '@/lib/utils'

/** Datas `YYYY-MM-DD` são lidas como horário local para não voltar um dia por causa do fuso. */
export function dataPesquisaMs(data: string): number {
  if (!data) return 0
  if (data.includes('T')) {
    const t = new Date(data).getTime()
    return Number.isFinite(t) ? t : 0
  }
  const [ano, mes, dia] = data.split('-').map(Number)
  const t = new Date(ano, (mes || 1) - 1, dia || 1).getTime()
  return Number.isFinite(t) ? t : 0
}

export function formatarDataPesquisa(data: string): string {
  const ms = dataPesquisaMs(data)
  return ms ? new Date(ms).toLocaleDateString('pt-BR') : '—'
}

type Coluna = 'data' | 'instituto' | 'candidato' | 'cidade' | 'tipo' | 'cargo' | 'intencao' | 'rejeicao'

const POR_PAGINA = 50

function valorColuna(p: Pesquisa, col: Coluna): string | number {
  switch (col) {
    case 'data':
      return dataPesquisaMs(p.data)
    case 'instituto':
      return p.instituto ?? ''
    case 'candidato':
      return p.candidato_nome ?? ''
    case 'cidade':
      return p.cities?.name ?? ''
    case 'tipo':
      return TIPO_PESQUISA_LABEL[p.tipo] ?? p.tipo
    case 'cargo':
      return CARGO_PESQUISA_LABEL[p.cargo] ?? p.cargo
    case 'intencao':
      return Number.isFinite(p.intencao) ? p.intencao : 0
    case 'rejeicao':
      return Number.isFinite(p.rejeicao) ? p.rejeicao : 0
  }
}

const botaoAcao =
  'rounded-md p-1.5 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-text)]'

export function PesquisasCadastradasTabela({
  pesquisas,
  candidatoFoco,
  onRelatorio,
  onEditar,
  onExcluir,
}: {
  pesquisas: Pesquisa[]
  candidatoFoco: string
  onRelatorio: (p: Pesquisa) => void
  onEditar: (p: Pesquisa) => void
  onExcluir: (p: Pesquisa) => void
}) {
  const [sortCol, setSortCol] = useState<Coluna>('data')
  const [sortAsc, setSortAsc] = useState<boolean>(false)
  const [limite, setLimite] = useState<number>(POR_PAGINA)

  const ordenadas = useMemo(() => {
    const fator = sortAsc ? 1 : -1
    return [...pesquisas].sort((a, b) => {
      const va = valorColuna(a, sortCol)
      const vb = valorColuna(b, sortCol)
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' })
      return fator * cmp
    })
  }, [pesquisas, sortCol, sortAsc])

  const ordenar = (col: Coluna) => {
    if (col === sortCol) {
      setSortAsc((v) => !v)
      return
    }
    setSortCol(col)
    setSortAsc(col !== 'data' && col !== 'intencao' && col !== 'rejeicao')
  }

  const th = { sortCol, sortAsc, onSort: ordenar }

  return (
    <>
      <div className={tseTabela.container}>
        <table className={tseTabela.table} data-tse-tabela>
          <thead className={tseTabela.thead}>
            <tr>
              <TseThOrdenavel col="data" {...th}>
                Data
              </TseThOrdenavel>
              <TseThOrdenavel col="instituto" {...th}>
                Instituto
              </TseThOrdenavel>
              <TseThOrdenavel col="candidato" {...th}>
                Candidato
              </TseThOrdenavel>
              <TseThOrdenavel col="cidade" {...th}>
                Cidade
              </TseThOrdenavel>
              <TseThOrdenavel col="tipo" {...th}>
                Tipo
              </TseThOrdenavel>
              <TseThOrdenavel col="cargo" {...th}>
                Cargo
              </TseThOrdenavel>
              <TseThOrdenavel col="intencao" alinhar="right" {...th}>
                Intenção
              </TseThOrdenavel>
              <TseThOrdenavel col="rejeicao" alinhar="right" {...th}>
                Rejeição
              </TseThOrdenavel>
              <th className={cn(tseTabela.th, 'text-right')}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.slice(0, limite).map((p) => {
              const foco = Boolean(candidatoFoco) && p.candidato_nome === candidatoFoco
              return (
                <tr
                  key={p.id}
                  className={cn(
                    tseTabela.tr,
                    'hover:bg-[var(--tse-bar)]',
                    foco && 'shadow-[inset_3px_0_0_var(--tse-yellow)]',
                  )}
                >
                  <td className={cn(tseTabela.td, 'tabular-nums')}>{formatarDataPesquisa(p.data)}</td>
                  <td className={tseTabela.td}>{p.instituto}</td>
                  <td className={cn(tseTabela.td, 'font-semibold', foco && 'font-bold')}>{p.candidato_nome}</td>
                  <td className={cn(tseTabela.td, 'text-[var(--tse-muted)]')}>{p.cities?.name ?? 'Estado'}</td>
                  <td className={cn(tseTabela.td, 'text-[var(--tse-muted)]')}>{TIPO_PESQUISA_LABEL[p.tipo]}</td>
                  <td className={cn(tseTabela.td, 'text-[var(--tse-muted)]')}>{CARGO_PESQUISA_LABEL[p.cargo]}</td>
                  <td className={cn(tseTabela.td, 'text-right font-bold tabular-nums')}>{p.intencao.toFixed(1)}%</td>
                  <td className={cn(tseTabela.td, 'text-right tabular-nums text-red-700')}>{p.rejeicao.toFixed(1)}%</td>
                  <td className={cn(tseTabela.td, 'py-1')}>
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => onRelatorio(p)}
                        title="Anexar PDF e gerar análise"
                        aria-label={`Relatório da pesquisa ${p.instituto}`}
                        className={botaoAcao}
                      >
                        <FileText className="h-4 w-4 text-[var(--tse-gold-text)]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditar(p)}
                        title="Editar"
                        aria-label={`Editar pesquisa ${p.instituto}`}
                        className={botaoAcao}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onExcluir(p)}
                        title="Excluir"
                        aria-label={`Excluir pesquisa ${p.instituto}`}
                        className={cn(botaoAcao, 'hover:text-red-700')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <TseCarregarMais restantes={ordenadas.length - limite} onClick={() => setLimite((n) => n + POR_PAGINA)} />
    </>
  )
}
