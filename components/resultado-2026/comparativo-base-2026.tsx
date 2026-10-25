'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileText, X } from 'lucide-react'
import {
  TseCard,
  TseSegmentado,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseTabela,
} from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'
import {
  compararBaseCandidatos2026,
  matrizComparativoBase2026,
  type BaseProporcao,
  type ModoComparativoBase,
  type RecorteComparativoBase,
} from '@/lib/comparativo-base-2026'
import { formatarPct2026, formatarVotos2026, type ResultadoSecao2026Payload } from '@/lib/resultado-secao-2026'
import { nomeProprio } from './tse-ui'

const MODOS: { id: ModoComparativoBase; label: string }[] = [
  { id: 'proporcao', label: 'Maior proporção' },
  { id: 'votos', label: 'Mais votos' },
  { id: 'minimo', label: 'Mínimo de votos' },
]

const BASES: { id: BaseProporcao; label: string }[] = [
  { id: 'eleitorado', label: 'Eleitorado' },
  { id: 'votantes', label: 'Votantes' },
]

const MAX_CANDIDATOS = 4

function quantidadeInicial(modo: ModoComparativoBase): number {
  if (modo === 'minimo') return 1000
  if (modo === 'votos') return 30
  return 50
}

function descreverRecorte(recorte: RecorteComparativoBase): string {
  if (recorte.modo === 'minimo') return `cidades com pelo menos ${formatarVotos2026(recorte.quantidade)} votos de cada um`
  if (recorte.modo === 'votos') return `as ${formatarVotos2026(recorte.quantidade)} cidades com mais votos de cada um`
  const base = recorte.base === 'eleitorado' ? 'o eleitorado' : 'os votantes'
  return `as ${formatarVotos2026(recorte.quantidade)} cidades em que cada um teve a maior fatia sobre ${base}`
}

const pct = (n: number | null): string => (n == null ? '—' : formatarPct2026(n, 1))

export function ComparativoBase2026({
  payload,
  cargo,
}: {
  payload: ResultadoSecao2026Payload
  cargo: string
}) {
  const [modo, setModo] = useState<ModoComparativoBase>('proporcao')
  const [quantidade, setQuantidade] = useState<number>(50)
  const [base, setBase] = useState<BaseProporcao>('eleitorado')
  const [escolhidos, setEscolhidos] = useState<number[]>([])
  const [cidadesAbertas, setCidadesAbertas] = useState<boolean>(false)
  const [exportando, setExportando] = useState<boolean>(false)

  const quantidadeRecorte = Number.isFinite(quantidade) && quantidade > 0 ? Math.round(quantidade) : 1
  const recorte: RecorteComparativoBase = { modo, quantidade: quantidadeRecorte, base }

  useEffect(() => {
    setEscolhidos([])
  }, [cargo])

  const opcoes = useMemo(
    () =>
      payload.candidatos
        .map((c, indice) => ({ c, indice }))
        .filter(({ c, indice }) => c.cargo === cargo && !escolhidos.includes(indice))
        .sort((a, b) => b.c.totalVotos - a.c.totalVotos || a.c.nome.localeCompare(b.c.nome, 'pt-BR')),
    [payload, cargo, escolhidos],
  )

  const matriz = useMemo(() => matrizComparativoBase2026(payload, cargo), [payload, cargo])
  const colunas = useMemo(
    () => compararBaseCandidatos2026(matriz, escolhidos, { modo, quantidade: quantidadeRecorte, base }),
    [matriz, escolhidos, modo, quantidadeRecorte, base],
  )

  const definirModo = (proximo: ModoComparativoBase) => {
    setModo(proximo)
    setQuantidade(quantidadeInicial(proximo))
  }

  const adicionar = (indice: number) => {
    setEscolhidos((atual) => (atual.includes(indice) || atual.length >= MAX_CANDIDATOS ? atual : [...atual, indice]))
  }

  const exportar = async () => {
    setExportando(true)
    try {
      const { exportarComparativoBasePdf2026 } = await import('./comparativo-base-pdf-2026')
      exportarComparativoBasePdf2026({
        meta: payload.meta,
        fonteDados: payload.candidatos[0]?.fonte ?? '',
        cargo,
        recorte,
        descricao: descreverRecorte(recorte),
        colunas: colunas.map((dados) => {
          const c = payload.candidatos[dados.indice]
          return { nome: nomeProprio(c?.nome ?? ''), partido: c?.partido ?? '', dados }
        }),
      })
    } finally {
      setExportando(false)
    }
  }

  const linhas = [
    { rotulo: 'Cidades', valor: (d: (typeof colunas)[number]) => formatarVotos2026(d.cidades.length) },
    { rotulo: 'Votos nessas cidades', valor: (d: (typeof colunas)[number]) => formatarVotos2026(d.votos) },
    { rotulo: 'Eleitores', valor: (d: (typeof colunas)[number]) => formatarVotos2026(d.eleitores) },
    { rotulo: 'Votantes', valor: (d: (typeof colunas)[number]) => formatarVotos2026(d.votantes) },
    { rotulo: '% dos eleitores', valor: (d: (typeof colunas)[number]) => pct(d.pctEleitores), destaque: true },
    { rotulo: '% dos votantes', valor: (d: (typeof colunas)[number]) => pct(d.pctVotantes), destaque: true },
  ]

  return (
    <TseCard
      titulo="Comparativo de base"
      subtitulo={`Cada candidato no próprio recorte · ${descreverRecorte(recorte)} · votantes são os votos nominais de todos os candidatos do cargo`}
      acao={
        <button
          type="button"
          onClick={() => void exportar()}
          disabled={colunas.length === 0 || exportando}
          className={tseBotaoCinzaClass}
        >
          <FileText className={tseBotaoIconeClass} />
          {exportando ? 'Gerando…' : 'PDF'}
        </button>
      }
    >
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <TseSegmentado opcoes={MODOS} valor={modo} onChange={definirModo} />
        <label className="flex items-center gap-2 text-[12px] text-[var(--tse-muted)]">
          {modo === 'minimo' ? 'Mínimo de votos' : 'Cidades'}
          <input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(Number(e.target.value))}
            className="h-8 w-24 rounded-md border border-[var(--tse-border)] bg-white px-2 text-[13px] text-[var(--tse-text)] outline-none focus:border-[var(--tse-yellow)]"
          />
        </label>
        {modo === 'proporcao' ? (
          <div className="flex items-center gap-2 text-[12px] text-[var(--tse-muted)]">
            Ordenar por
            <TseSegmentado opcoes={BASES} valor={base} onChange={setBase} />
          </div>
        ) : null}
        {escolhidos.length < MAX_CANDIDATOS ? (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) adicionar(Number(e.target.value))
            }}
            aria-label="Adicionar candidato ao comparativo"
            className="h-8 max-w-[240px] rounded-md border border-[var(--tse-border)] bg-white px-2 text-[13px] text-[var(--tse-text)] outline-none focus:border-[var(--tse-yellow)]"
          >
            <option value="">Adicionar candidato…</option>
            {opcoes.map(({ c, indice }) => (
              <option key={c.id} value={indice}>
                {nomeProprio(c.nome)}
                {c.partido ? ` · ${c.partido}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[12px] text-[var(--tse-muted)]">Máximo de {MAX_CANDIDATOS} candidatos</span>
        )}
      </div>

      {escolhidos.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {escolhidos.map((indice) => {
            const c = payload.candidatos[indice]
            return (
              <li key={indice}>
                <button
                  type="button"
                  onClick={() => setEscolhidos((atual) => atual.filter((i) => i !== indice))}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--tse-yellow-soft)] px-2.5 py-0.5 text-[12px] font-semibold"
                >
                  {nomeProprio(c?.nome ?? '')}
                  {c?.partido ? <span className="font-normal text-[var(--tse-muted)]">{c.partido}</span> : null}
                  <X className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">Remover</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-[var(--tse-muted)]">Escolha os candidatos para montar o comparativo.</p>
      )}

      {colunas.length > 0 ? (
        <div className={cn(tseTabela.container, 'mt-3 shadow-none ring-1 ring-[#EEEEEE]')}>
          <table className={tseTabela.table} data-tse-tabela>
            <thead className={tseTabela.thead}>
              <tr>
                <th className={tseTabela.th} />
                {colunas.map((coluna) => {
                  const c = payload.candidatos[coluna.indice]
                  return (
                    <th key={coluna.indice} className={cn(tseTabela.th, 'text-right')}>
                      {nomeProprio(c?.nome ?? '')}
                      {c?.partido ? <span className="mt-0.5 block font-semibold normal-case tracking-normal text-[var(--tse-muted)]">{c.partido}</span> : null}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.rotulo} className={cn(tseTabela.tr, linha.destaque && 'bg-[var(--tse-yellow-soft)]')}>
                  <td className={cn(tseTabela.td, 'font-semibold')}>{linha.rotulo}</td>
                  {colunas.map((coluna) => (
                    <td key={coluna.indice} className={cn(tseTabela.td, 'text-right font-bold tabular-nums')}>
                      {linha.valor(coluna)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {colunas.length > 0 ? (
        <div className="mt-3">
          <button type="button" onClick={() => setCidadesAbertas((v) => !v)} className="text-[12px] font-bold text-[var(--tse-olive)] hover:underline">
            {cidadesAbertas ? 'Ocultar cidades' : 'Ver cidades do recorte'}
          </button>
          {cidadesAbertas ? (
            <div className="mt-2 grid gap-4 lg:grid-cols-2">
              {colunas.map((coluna) => {
                const c = payload.candidatos[coluna.indice]
                return (
                  <div key={coluna.indice} className="min-w-0">
                    <p className="text-[12px] font-bold">{nomeProprio(c?.nome ?? '')}</p>
                    <div className={cn(tseTabela.container, 'mt-1 max-h-64 shadow-none ring-1 ring-[#EEEEEE]')}>
                      <table className={tseTabela.table} data-tse-tabela>
                        <thead className={cn(tseTabela.thead, 'sticky top-0')}>
                          <tr>
                            <th className={tseTabela.th}>Município</th>
                            <th className={cn(tseTabela.th, 'text-right')}>Votos</th>
                            <th className={cn(tseTabela.th, 'text-right')}>% eleitores</th>
                            <th className={cn(tseTabela.th, 'text-right')}>% votantes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {coluna.cidades.map((cidade) => (
                            <tr key={cidade.nome} className={tseTabela.tr}>
                              <td className={cn(tseTabela.td, 'uppercase')}>{cidade.nome}</td>
                              <td className={cn(tseTabela.td, 'text-right tabular-nums')}>{formatarVotos2026(cidade.votos)}</td>
                              <td className={cn(tseTabela.td, 'text-right tabular-nums')}>{pct(cidade.pctEleitores)}</td>
                              <td className={cn(tseTabela.td, 'text-right tabular-nums')}>{pct(cidade.pctVotantes)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </TseCard>
  )
}
