'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CANDIDATO_FEDERAL_DESTAQUE,
  parseVotosEleicao,
  type ResultadoEleicao,
} from '@/lib/resumo-eleicoes-dados'
import {
  filtrarEmendasPorMunicipio,
  type EmendaRegistro,
} from '@/lib/emendas-filtro'
import type { PropostaFns } from '@/lib/fns-tetos-saldo'
import type { LimitesMunicipioResponse } from '@/lib/limites-tetos-types'
import type { ClassificacaoSuas } from '@/lib/suas-porte'
import {
  candidatoFotoLookupKey,
  resolverCargoFotoCandidato,
  type CargoFotoCandidato,
  type CandidatoFotoDivulgacand,
} from '@/lib/candidatos-foto-divulgacand'
import {
  formatarMoedaFicha,
  formatarSaldoFicha,
  montarDadosFichaLideranca,
  percentualVotosCandidato,
  rotuloCargoFicha,
  situacaoEleicaoCandidato,
  type TotaisEmendaExercicio,
} from '@/lib/ficha-lideranca-resumo'

const cell = 'border border-slate-300 px-2 py-1 text-xs'
const headCell = 'border border-slate-300 px-2 py-1 text-xs font-semibold bg-slate-100'

function CelulaDupla({
  label,
  mac,
  pap,
}: {
  label: string
  mac: string
  pap: string
}) {
  return (
    <tr>
      <td className={cn(cell, 'font-medium bg-slate-50')}>{label}</td>
      <td className={cn(cell, 'text-right tabular-nums')}>{mac}</td>
      <td className={cn(cell, 'text-right tabular-nums')}>{pap}</td>
    </tr>
  )
}

export interface FichaLiderancaResumoProps {
  open: boolean
  onClose: () => void
  municipio: string
  candidato: ResultadoEleicao | null
  cargo: CargoFotoCandidato
  foto?: CandidatoFotoDivulgacand | null
  limitesDb: LimitesMunicipioResponse | null
  propostasFns: PropostaFns[]
  emendasSuas: Array<{ valor_proposta: number; valor_pagar: number }>
  populacao: number | null
  classificacaoSuas: ClassificacaoSuas
  exercicioAtivo: number | null
  autoPrint?: boolean
  onPrinted?: () => void
}

export function FichaLiderancaResumo({
  open,
  onClose,
  municipio,
  candidato,
  cargo,
  foto,
  limitesDb,
  propostasFns,
  emendasSuas,
  populacao,
  classificacaoSuas,
  exercicioAtivo,
  autoPrint = false,
  onPrinted,
}: FichaLiderancaResumoProps) {
  const [loading, setLoading] = useState(false)
  const [resultadosEleicao, setResultadosEleicao] = useState<ResultadoEleicao[]>([])
  const [emendasTodas, setEmendasTodas] = useState<EmendaRegistro[]>([])
  const [fotoDb, setFotoDb] = useState<CandidatoFotoDivulgacand | null>(null)

  const carregarExtra = useCallback(async () => {
    if (!municipio.trim()) return
    setLoading(true)
    try {
      const [resEleicoes, resEmendas] = await Promise.all([
        fetch(`/api/resumo-eleicoes?cidade=${encodeURIComponent(municipio)}`),
        fetch('/api/emendas'),
      ])
      const jsonE = await resEleicoes.json().catch(() => ({}))
      const jsonM = await resEmendas.json().catch(() => ({}))
      setResultadosEleicao(resEleicoes.ok && Array.isArray(jsonE.resultados) ? jsonE.resultados : [])
      setEmendasTodas(resEmendas.ok && Array.isArray(jsonM.emendas) ? jsonM.emendas : [])
    } catch {
      setResultadosEleicao([])
      setEmendasTodas([])
    } finally {
      setLoading(false)
    }
  }, [municipio])

  useEffect(() => {
    if (!open || !candidato || !municipio) {
      setFotoDb(null)
      return
    }
    const cargoFoto = resolverCargoFotoCandidato(candidato, cargo)
    const key = candidatoFotoLookupKey(cargoFoto, candidato)
    fetch(
      `/api/candidatos-foto-divulgacand?municipio=${encodeURIComponent(municipio)}&cargo=${cargoFoto}&ano=2024`,
    )
      .then((r) => r.json())
      .then((json) => {
        const fotos = Array.isArray(json.fotos) ? json.fotos : []
        const found = fotos.find(
          (f: CandidatoFotoDivulgacand) =>
            candidatoFotoLookupKey(f.cargo, {
              numeroUrna: f.numero_urna,
              nomeUrnaCandidato: f.nome_urna,
            }) === key,
        )
        setFotoDb(found ?? null)
      })
      .catch(() => setFotoDb(null))
  }, [open, municipio, candidato, cargo])

  useEffect(() => {
    if (open && municipio) void carregarExtra()
  }, [open, municipio, carregarExtra])

  const totalSuasPropostas = emendasSuas.reduce((acc, e) => acc + (e.valor_proposta || 0), 0)
  const totalSuasPagar = emendasSuas.reduce((acc, e) => acc + (e.valor_pagar || 0), 0)

  const dados = useMemo(() => {
    if (!candidato) return null
    return montarDadosFichaLideranca({
      resultadosEleicao,
      limitesDb,
      propostasFns,
      emendasMunicipio: filtrarEmendasPorMunicipio(emendasTodas, municipio),
      classificacaoSuas,
      populacao,
      exercicioAtivo,
      totalSuasPropostas,
      totalSuasPagar,
    })
  }, [
    candidato,
    resultadosEleicao,
    limitesDb,
    propostasFns,
    emendasTodas,
    municipio,
    classificacaoSuas,
    populacao,
    exercicioAtivo,
    totalSuasPropostas,
    totalSuasPagar,
  ])

  useEffect(() => {
    if (!autoPrint || loading || !dados || !open || !candidato) return
    const t = window.setTimeout(() => {
      window.print()
      onPrinted?.()
    }, 400)
    return () => window.clearTimeout(t)
  }, [autoPrint, loading, dados, open, candidato, onPrinted])

  if (!open || !candidato) return null

  const cargoEfetivo = resolverCargoFotoCandidato(candidato, cargo)
  const tituloCargo = rotuloCargoFicha(cargoEfetivo, candidato)
  const listaCargo =
    cargoEfetivo === 'prefeito' ? dados?.prefeitos ?? [] : dados?.vereadores ?? []
  const votos = parseVotosEleicao(candidato.quantidadeVotosNominais)
  const pct = percentualVotosCandidato(candidato, listaCargo)
  const situacao = situacaoEleicaoCandidato(candidato)
  const depFed = dados?.depFederal[0]
  const depEst1 = dados?.depEstadual[0]
  const depEst2 = dados?.depEstadual[1]
  const exFns = dados?.exercicioAtivo ?? exercicioAtivo ?? 2025
  const emendasPorExercicio = dados?.totaisEmendasPorExercicio ?? []
  const propostasExAtivo = dados?.linhasFns ?? []

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative my-2 flex w-full max-w-4xl flex-col rounded-xl border border-card bg-white shadow-2xl print:my-0 print:max-w-none print:border-0 print:shadow-none">
        <div className="flex items-center justify-between gap-2 border-b border-card px-4 py-3 print:hidden">
          <h2 className="text-sm font-semibold text-text-primary truncate">
            Ficha de liderança — {tituloCargo}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-background"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
            <Loader2 className="h-6 w-6 animate-spin text-accent-gold" />
            Montando ficha…
          </div>
        )}

        {!loading && dados && (
          <div id="ficha-lideranca-print" className="p-4 sm:p-6 text-slate-900 font-sans">
            {/* Cabeçalho município */}
            <div className="mb-4 border-2 border-slate-800 bg-emerald-100/80 px-4 py-3 text-center">
              <h1 className="text-xl sm:text-2xl font-bold tracking-wide uppercase">
                {municipio}
              </h1>
            </div>

            {/* Perfil candidato */}
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 border border-slate-300">
              <div className="flex items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-300 bg-slate-50 p-3">
                {(foto?.url_imagem || fotoDb?.url_imagem) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={foto?.url_imagem || fotoDb?.url_imagem}
                    alt={candidato.nomeUrnaCandidato}
                    className="h-36 w-28 object-cover border border-slate-300"
                  />
                ) : (
                  <div className="h-36 w-28 flex items-center justify-center border border-dashed border-slate-400 text-[10px] text-slate-500 text-center px-2">
                    Sem foto
                    <br />
                    (DivulgaCand)
                  </div>
                )}
              </div>
              <div className="p-3 space-y-3 min-w-0">
                <p className="text-sm font-bold uppercase">
                  {tituloCargo}: {candidato.nomeUrnaCandidato}
                  {candidato.partido ? ` (${candidato.partido})` : ''}
                </p>
                {(foto?.url_divulgacand || fotoDb?.url_divulgacand) && (
                  <p className="text-[10px] text-slate-600 truncate">
                    DivulgaCand: {foto?.url_divulgacand || fotoDb?.url_divulgacand}
                  </p>
                )}

                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={headCell} />
                      <th className={cn(headCell, 'text-center')}>MAC</th>
                      <th className={cn(headCell, 'text-center')}>PAP</th>
                    </tr>
                  </thead>
                  <tbody>
                    <CelulaDupla
                      label="Limite (teto)"
                      mac={formatarMoedaFicha(dados.resumoMac.limite)}
                      pap={formatarMoedaFicha(dados.resumoPap.limite)}
                    />
                    <CelulaDupla
                      label="Propostas"
                      mac={formatarMoedaFicha(dados.resumoMac.propostas)}
                      pap={formatarMoedaFicha(dados.resumoPap.propostas)}
                    />
                    <CelulaDupla
                      label="Saldo"
                      mac={formatarSaldoFicha(dados.resumoMac.saldo)}
                      pap={formatarSaldoFicha(dados.resumoPap.saldo)}
                    />
                    <CelulaDupla
                      label="A pagar"
                      mac={formatarMoedaFicha(dados.resumoMac.valorPagar)}
                      pap={formatarMoedaFicha(dados.resumoPap.valorPagar)}
                    />
                  </tbody>
                </table>

                <table className="w-full border-collapse">
                  <tbody>
                    <tr>
                      <td className={cn(cell, 'font-medium bg-slate-50 w-[40%]')}>SUAS (porte)</td>
                      <td className={cell}>
                        {dados.classificacaoSuas.porte} — {dados.classificacaoSuas.valorFormatado}
                        {dados.populacao != null && (
                          <span className="text-slate-500">
                            {' '}
                            · pop. {dados.populacao.toLocaleString('pt-BR')}
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className={cn(cell, 'font-medium bg-slate-50')}>Saldo SUAS</td>
                      <td className={cell}>{formatarSaldoFicha(dados.resumoSuas.saldo)}</td>
                    </tr>
                    <tr>
                      <td className={cn(cell, 'font-medium bg-slate-50')}>Eleição 2024</td>
                      <td className={cell}>
                        {situacao} — {votos.toLocaleString('pt-BR')} votos ({pct})
                      </td>
                    </tr>
                    <tr>
                      <td className={cn(cell, 'font-medium bg-slate-50')}>Dep. Federal 2022</td>
                      <td className={cell}>
                        {depFed
                          ? `${depFed.nomeUrnaCandidato} (${depFed.partido || '—'})`
                          : '—'}
                        {depFed?.nomeUrnaCandidato?.toUpperCase().includes(
                          CANDIDATO_FEDERAL_DESTAQUE.split(' ')[0],
                        )
                          ? ' ★'
                          : ''}
                      </td>
                    </tr>
                    <tr>
                      <td className={cn(cell, 'font-medium bg-slate-50')}>Dep. Estadual 2022</td>
                      <td className={cell}>
                        {[depEst1, depEst2]
                          .filter(Boolean)
                          .map((d) => `${d!.nomeUrnaCandidato} (${d!.partido || '—'})`)
                          .join(' · ') || '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Emendas mandato — 2025 e 2026 */}
            {emendasPorExercicio.map((bloco) => (
              <SecaoRecursosEmendasExercicio key={bloco.exercicio} bloco={bloco} />
            ))}

            {/* Propostas FNS */}
            {propostasExAtivo.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-bold uppercase bg-sky-100 border border-slate-300 px-2 py-1.5 mb-1">
                  Propostas FNS ({exFns}) — MAC / PAP
                </h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={headCell}>Tipo</th>
                      <th className={headCell}>Recurso</th>
                      <th className={cn(headCell, 'text-right')}>Valor</th>
                      <th className={headCell}>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propostasExAtivo.slice(0, 15).map((p, i) => (
                      <tr key={`${p.descricao}-${i}`}>
                        <td className={cell}>{p.descricao}</td>
                        <td className={cell}>{p.tipoRecurso}</td>
                        <td className={cn(cell, 'text-right tabular-nums')}>
                          {formatarMoedaFicha(p.valor)}
                        </td>
                        <td className={cell}>{p.situacao}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold bg-slate-50">
                      <td className={cell} colSpan={2}>
                        Total propostas (exc. PROGRAMA)
                      </td>
                      <td className={cn(cell, 'text-right tabular-nums')}>
                        {formatarMoedaFicha(
                          propostasExAtivo.reduce((acc, p) => acc + p.valor, 0),
                        )}
                      </td>
                      <td className={cell} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <p className="text-[10px] text-slate-500 text-center pt-2 print:pt-4">
              Gerado pelo Cockpit — Ficha de Atendimento · {new Date().toLocaleString('pt-BR')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function SecaoRecursosEmendasExercicio({ bloco }: { bloco: TotaisEmendaExercicio }) {
  const temItens = bloco.itens.length > 0
  const temValores =
    bloco.valorIndicado > 0 || bloco.valorEmpenhado > 0 || bloco.valorPago > 0

  return (
    <div className="mb-4">
      <h3 className="text-xs font-bold uppercase bg-sky-100 border border-slate-300 px-2 py-1.5">
        Recursos destinados em {bloco.exercicio} (emendas mandato)
      </h3>
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className={cn(cell, 'font-medium bg-slate-50 w-[70%]')}>Valor indicado</td>
            <td className={cn(cell, 'text-right tabular-nums font-medium')}>
              {formatarMoedaFicha(bloco.valorIndicado)}
            </td>
          </tr>
          <tr>
            <td className={cn(cell, 'font-medium bg-slate-50')}>Valor empenhado</td>
            <td className={cn(cell, 'text-right tabular-nums font-medium')}>
              {formatarMoedaFicha(bloco.valorEmpenhado)}
            </td>
          </tr>
          <tr className="font-bold bg-slate-50">
            <td className={cell}>Valor pago</td>
            <td className={cn(cell, 'text-right tabular-nums')}>
              {formatarMoedaFicha(bloco.valorPago)}
            </td>
          </tr>
        </tbody>
      </table>

      {!temValores && !temItens ? (
        <p className="text-xs text-slate-500 mt-1 px-1">Nenhuma emenda do mandato neste exercício.</p>
      ) : null}

      {temItens ? (
        <table className="w-full border-collapse mt-2">
          <thead>
            <tr>
              <th className={headCell}>Emenda</th>
              <th className={headCell}>Objeto</th>
              <th className={cn(headCell, 'text-right')}>Indicado</th>
              <th className={cn(headCell, 'text-right')}>Empenhado</th>
              <th className={cn(headCell, 'text-right')}>Pago</th>
            </tr>
          </thead>
          <tbody>
            {bloco.itens.map((e) => (
              <tr key={e.id}>
                <td className={cell}>{e.emenda}</td>
                <td className={cn(cell, 'max-w-[10rem] truncate')} title={e.objeto || ''}>
                  {e.objeto || '—'}
                </td>
                <td className={cn(cell, 'text-right tabular-nums')}>
                  {formatarMoedaFicha(e.valor_indicado)}
                </td>
                <td className={cn(cell, 'text-right tabular-nums')}>
                  {formatarMoedaFicha(e.valor_empenhado)}
                </td>
                <td className={cn(cell, 'text-right tabular-nums')}>
                  {formatarMoedaFicha(e.valor_pago)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}
