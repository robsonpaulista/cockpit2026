'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Download, FileText, Loader2, Search } from 'lucide-react'
import {
  achatarArvore2026,
  comparativoSecoesParaCsv2026,
  compararCandidatos2026,
  formatarPct2026,
  formatarVotos2026,
  montarArvore2026,
  resumirComparativo2026,
  type NivelArvore2026,
  type NoArvore2026,
  type ResultadoSecao2026Payload,
  type ResultadoSecao2026SecaoMulti,
} from '@/lib/resultado-secao-2026'
import type { ModoPdfComparativo } from './comparativo-pdf-2026'
import {
  NIVEL_ARVORE_ROTULO,
  abreviarCargo,
  baixarCsv,
  corCandidato,
  nomeProprio,
  normalizarTexto,
  rotuloCorrelacao,
} from './tse-ui'

type OrdemComparativo = 'total' | 'diferenca' | 'alfabetica' | `c${number}`

const PAGE_SIZE = 40

const NIVEL_ESTILO: Record<NivelArvore2026, string> = {
  municipio: 'bg-[#FBFAF3] font-black uppercase',
  bairro: 'bg-[#FDFDFB] font-bold uppercase',
  local: 'font-semibold uppercase',
  zona: 'text-[var(--tse-text)]',
  secao: 'text-[12px] text-[var(--tse-muted)]',
}

/** Níveis abertos por "Expandir até locais". */
const NIVEIS_EXPANDIR_TUDO: ReadonlySet<NivelArvore2026> = new Set(['municipio', 'bairro'])

type Props = {
  payload: ResultadoSecao2026Payload
  secoes: ResultadoSecao2026SecaoMulti[]
  indices: number[]
  escopoLabel: string
  onSelecionarMunicipio: (codigo: string) => void
}

function contarNos(nos: NoArvore2026[]): number {
  return nos.reduce((acc, no) => acc + 1 + contarNos(no.filhos), 0)
}

function ordenarArvore(nos: NoArvore2026[], ordem: OrdemComparativo): NoArvore2026[] {
  const porNome = (a: NoArvore2026, b: NoArvore2026) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })
  const cmp = (a: NoArvore2026, b: NoArvore2026): number => {
    if (ordem === 'alfabetica') return porNome(a, b)
    if (ordem === 'total') return b.total - a.total || porNome(a, b)
    if (ordem === 'diferenca') {
      return Math.abs(b.votos[0] - b.votos[1]) - Math.abs(a.votos[0] - a.votos[1]) || porNome(a, b)
    }
    const i = Number(ordem.slice(1))
    return (b.votos[i] ?? 0) - (a.votos[i] ?? 0) || porNome(a, b)
  }
  return [...nos].sort(cmp).map((no) => (no.filhos.length ? { ...no, filhos: ordenarArvore(no.filhos, ordem) } : no))
}

/** Mantém nós que casam com o termo (com todos os filhos) e os ancestrais deles; devolve quem abrir. */
function filtrarArvore(nos: NoArvore2026[], termo: string, abrir: Set<string>): NoArvore2026[] {
  const out: NoArvore2026[] = []
  for (const no of nos) {
    if (normalizarTexto(`${no.nome} ${no.detalhe}`).includes(termo)) {
      out.push(no)
      continue
    }
    const filhos = filtrarArvore(no.filhos, termo, abrir)
    if (filhos.length) {
      abrir.add(no.key)
      out.push({ ...no, filhos })
    }
  }
  return out
}

function coletarChaves(nos: NoArvore2026[], niveis: ReadonlySet<NivelArvore2026>, out: Set<string>): Set<string> {
  for (const no of nos) {
    if (niveis.has(no.nivel) && no.filhos.length) out.add(no.key)
    coletarChaves(no.filhos, niveis, out)
  }
  return out
}

export function ComparativoLocais2026({ payload, secoes, indices, escopoLabel, onSelecionarMunicipio }: Props) {
  const [ordem, setOrdem] = useState<OrdemComparativo>('total')
  const [busca, setBusca] = useState<string>('')
  const [limite, setLimite] = useState<number>(PAGE_SIZE)
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set())
  const [menuPdf, setMenuPdf] = useState<boolean>(false)
  const [gerandoPdf, setGerandoPdf] = useState<ModoPdfComparativo | null>(null)

  const candidatos = useMemo(() => indices.map((i) => payload.candidatos[i]), [indices, payload])

  const linhasLocais = useMemo(() => compararCandidatos2026(payload, secoes, indices), [payload, secoes, indices])
  const resumo = useMemo(() => resumirComparativo2026(linhasLocais, indices.length), [linhasLocais, indices.length])

  const arvore = useMemo(() => montarArvore2026(payload, secoes, indices), [payload, secoes, indices])

  const termo = normalizarTexto(busca.trim())
  const ordemEfetiva: OrdemComparativo = ordem === 'diferenca' && indices.length !== 2 ? 'total' : ordem

  const { visivel, abertosBusca } = useMemo(() => {
    const abrir = new Set<string>()
    const filtrada = termo ? filtrarArvore(arvore, termo, abrir) : arvore
    return { visivel: ordenarArvore(filtrada, ordemEfetiva), abertosBusca: abrir }
  }, [arvore, termo, ordemEfetiva])

  const abertos = termo ? new Set([...expandidos, ...abertosBusca]) : expandidos
  const comMunicipio = arvore[0]?.nivel === 'municipio'
  const totalGeral = resumo.totais.reduce((a, b) => a + b, 0)

  const alternar = (key: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const linhasTela = achatarArvore2026(visivel.slice(0, limite), (no) => abertos.has(no.key))
  const linhasCompleto = useMemo(() => (menuPdf ? contarNos(visivel) : 0), [menuPdf, visivel])

  const rotuloOrdem =
    ordemEfetiva === 'total'
      ? 'soma dos votos'
      : ordemEfetiva === 'diferenca'
        ? 'maior diferença'
        : ordemEfetiva === 'alfabetica'
          ? 'alfabética'
          : nomeProprio(candidatos[Number(ordemEfetiva.slice(1))]?.nome ?? '')

  const exportar = () => {
    const escopo = normalizarTexto(escopoLabel).replace(/\s+/g, '-')
    baixarCsv(
      `comparativo-secoes-${candidatos.map((c) => c.id).join('-x-')}-${escopo}.csv`,
      comparativoSecoesParaCsv2026(payload, secoes, indices),
    )
  }

  const exportarPdf = async (modo: ModoPdfComparativo) => {
    setMenuPdf(false)
    setGerandoPdf(modo)
    try {
      const { exportarComparativoPdf2026 } = await import('./comparativo-pdf-2026')
      exportarComparativoPdf2026({
        meta: payload.meta,
        candidatos,
        resumo,
        linhas: achatarArvore2026(visivel, modo === 'completo' ? () => true : (no) => abertos.has(no.key)),
        escopoLabel,
        qtdRaiz: visivel.length,
        comMunicipio,
        ordemLabel: rotuloOrdem,
        busca: busca.trim(),
        modo,
      })
    } finally {
      setGerandoPdf(null)
    }
  }

  const renderLinhas = () =>
    linhasTela.map(({ no, profundidade, maxIrmaos }) => {
      const aberto = abertos.has(no.key)
      const temFilhos = no.filhos.length > 0
      const codigoMunicipio = no.nivel === 'municipio' ? no.key.slice(1) : null
      return (
        <tr key={no.key} className={`border-t border-[#EEEEEE] ${NIVEL_ESTILO[no.nivel]}`}>
          <td className="py-1.5 pr-3" style={{ paddingLeft: 10 + profundidade * 22 }}>
            <div className="flex items-start gap-1.5">
              {temFilhos ? (
                <button
                  type="button"
                  aria-expanded={aberto}
                  aria-label={`${aberto ? 'Recolher' : 'Expandir'} ${no.nome}`}
                  onClick={() => alternar(no.key)}
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-[var(--tse-yellow-soft)]"
                >
                  <ChevronRight
                    className={`h-4 w-4 text-[var(--tse-gold-text)] transition-transform ${aberto ? 'rotate-90' : ''}`}
                  />
                </button>
              ) : (
                <span className="h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => (temFilhos ? alternar(no.key) : undefined)}
                    className={`text-left leading-tight ${temFilhos ? 'hover:text-[var(--tse-olive)]' : 'cursor-default'}`}
                  >
                    {no.nome}
                  </button>
                  <span className="rounded bg-[var(--tse-bar)] px-1.5 py-px text-[10px] font-semibold normal-case text-[var(--tse-muted)]">
                    {NIVEL_ARVORE_ROTULO[no.nivel]}
                  </span>
                  {codigoMunicipio && (
                    <button
                      type="button"
                      onClick={() => onSelecionarMunicipio(codigoMunicipio)}
                      className="text-[10px] font-bold normal-case text-[var(--tse-olive)] hover:underline"
                    >
                      filtrar
                    </button>
                  )}
                </div>
                {no.detalhe && (
                  <p className="mt-0.5 text-[11px] font-normal normal-case text-[var(--tse-muted)]">{no.detalhe}</p>
                )}
              </div>
            </div>
          </td>
          <td className="px-3 py-1.5 text-right font-normal tabular-nums">
            {no.nivel === 'secao' ? '' : formatarVotos2026(no.secoes)}
          </td>
          {no.votos.map((v, i) => (
            <td key={candidatos[i].id} className="px-3 py-1.5">
              <div className="flex items-center gap-2">
                <div className="h-2 w-20 overflow-hidden rounded-full bg-[#EEEEEE]">
                  <div
                    className="h-full"
                    style={{ width: `${maxIrmaos ? (v / maxIrmaos) * 100 : 0}%`, backgroundColor: corCandidato(i) }}
                  />
                </div>
                <span
                  className={`w-14 text-right tabular-nums ${no.lider === i ? 'font-black' : 'font-semibold'} ${
                    v ? 'text-[var(--tse-text)]' : 'text-[var(--tse-muted)]'
                  }`}
                >
                  {formatarVotos2026(v)}
                </span>
              </div>
            </td>
          ))}
          <td className="px-3 py-1.5">
            <div className="flex h-2.5 w-28 overflow-hidden rounded-full bg-[var(--tse-zero)]">
              {no.votos.map((v, i) => (
                <div
                  key={candidatos[i].id}
                  style={{ width: `${no.total ? (v / no.total) * 100 : 0}%`, backgroundColor: corCandidato(i) }}
                />
              ))}
            </div>
          </td>
          {candidatos.length === 2 && (
            <td className="px-3 py-1.5 text-right font-bold tabular-nums">
              {no.lider != null ? (
                <span style={{ color: corCandidato(no.lider) }}>
                  +{formatarVotos2026(Math.abs(no.votos[0] - no.votos[1]))}
                </span>
              ) : (
                <span className="font-normal text-[var(--tse-muted)]">{no.total ? 'empate' : '—'}</span>
              )}
            </td>
          )}
          <td className="px-3 py-1.5 text-right font-bold tabular-nums text-[var(--tse-text)]">
            {formatarVotos2026(no.total)}
          </td>
        </tr>
      )
    })

  return (
    <div className="space-y-5">
      <div
        className={`grid grid-cols-1 gap-4 ${
          candidatos.length === 4
            ? 'md:grid-cols-2 xl:grid-cols-4'
            : candidatos.length > 2
              ? 'md:grid-cols-3'
              : 'md:grid-cols-2'
        }`}
      >
        {candidatos.map((c, i) => (
          <section
            key={c.id}
            className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm"
          >
            <span className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: corCandidato(i) }} />
            <div className="flex items-start justify-between gap-3">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] bg-white text-xl font-black"
                style={{ borderColor: corCandidato(i), color: corCandidato(i) }}
              >
                {c.nome.slice(0, 1)}
              </div>
              <div className="text-right">
                <p className="text-2xl font-black">{formatarVotos2026(resumo.totais[i])}</p>
                <p className="text-[12px] text-[var(--tse-muted)]">
                  votos · {formatarPct2026(totalGeral ? (resumo.totais[i] / totalGeral) * 100 : 0, 1)} da soma
                </p>
              </div>
            </div>
            <p className="mt-3 text-[16px] font-bold uppercase">{c.nome}</p>
            <p className="text-[13px] text-[var(--tse-muted)]">
              {c.cargo} – {c.numero}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
              <span className="rounded-full px-3 py-0.5 font-bold text-white" style={{ backgroundColor: corCandidato(i) }}>
                Lidera em {formatarVotos2026(resumo.vitorias[i])} locais
              </span>
              <span className="rounded-full bg-[var(--tse-bar)] px-3 py-0.5 font-semibold text-[var(--tse-muted)]">
                Exclusivo em {formatarVotos2026(resumo.exclusivos[i])}
              </span>
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex h-3 overflow-hidden rounded-full bg-[var(--tse-zero)]">
          {resumo.totais.map((t, i) => (
            <div
              key={candidatos[i].id}
              style={{ width: `${totalGeral ? (t / totalGeral) * 100 : 0}%`, backgroundColor: corCandidato(i) }}
            />
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-[13px] md:grid-cols-5">
          <div>
            <dt className="text-[var(--tse-muted)]">Locais comparados</dt>
            <dd className="text-lg font-bold">{formatarVotos2026(resumo.linhas)}</dd>
          </div>
          <div>
            <dt className="text-[var(--tse-muted)]">Com voto de todos</dt>
            <dd className="text-lg font-bold">
              {formatarVotos2026(resumo.todosComVoto)}
              <span className="ml-1 text-[12px] font-normal text-[var(--tse-muted)]">
                {formatarPct2026(resumo.linhas ? (resumo.todosComVoto / resumo.linhas) * 100 : 0, 1)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[var(--tse-muted)]">Empates</dt>
            <dd className="text-lg font-bold">{formatarVotos2026(resumo.empates)}</dd>
          </div>
          <div>
            <dt className="text-[var(--tse-muted)]">Sem voto de nenhum</dt>
            <dd className="text-lg font-bold">{formatarVotos2026(resumo.nenhumVoto)}</dd>
          </div>
          <div>
            <dt className="text-[var(--tse-muted)]">
              Correlação por local
              {candidatos.length > 2 ? ` (${nomeProprio(candidatos[0].nome)} × ${nomeProprio(candidatos[1].nome)})` : ''}
            </dt>
            <dd className="text-lg font-bold">
              {resumo.correlacao != null ? resumo.correlacao.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—'}
              {resumo.correlacao != null && (
                <span className="ml-1 text-[12px] font-normal text-[var(--tse-muted)]">
                  {rotuloCorrelacao(resumo.correlacao)}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-wide">
          <button
            type="button"
            onClick={() => setExpandidos(coletarChaves(arvore, NIVEIS_EXPANDIR_TUDO, new Set()))}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#CFCFCF] bg-white px-3 py-1.5 hover:border-[var(--tse-olive)]"
          >
            <ChevronsUpDown className="h-4 w-4 text-[var(--tse-gold-text)]" />
            Expandir até locais
          </button>
          <button
            type="button"
            onClick={() => setExpandidos(new Set())}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#CFCFCF] bg-white px-3 py-1.5 hover:border-[var(--tse-olive)]"
          >
            <ChevronsDownUp className="h-4 w-4 text-[var(--tse-gold-text)]" />
            Recolher tudo
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={ordemEfetiva}
            onChange={(e) => setOrdem(e.target.value as OrdemComparativo)}
            className="h-8 rounded-md border border-[var(--tse-border)] bg-white px-2 text-[13px] outline-none focus:border-[var(--tse-yellow)]"
          >
            <option value="total">Ordenar: soma dos votos</option>
            {candidatos.map((c, i) => (
              <option key={c.id} value={`c${i}`}>
                Ordenar: {nomeProprio(c.nome)}
              </option>
            ))}
            {candidatos.length === 2 && <option value="diferenca">Ordenar: maior diferença</option>}
            <option value="alfabetica">Ordem alfabética</option>
          </select>
          <div className="relative">
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                setLimite(PAGE_SIZE)
              }}
              placeholder="Buscar bairro, local ou seção"
              className="h-8 w-60 rounded-md border border-[var(--tse-border)] bg-white pl-3 pr-9 text-[13px] outline-none focus:border-[var(--tse-yellow)]"
            />
            <span className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-md bg-[var(--tse-yellow-strong)]">
              <Search className="h-4 w-4" />
            </span>
          </div>
          <button
            type="button"
            onClick={exportar}
            className="flex h-8 items-center gap-1.5 rounded-md bg-[#E8E8E8] px-3 text-[13px] font-semibold hover:bg-[#DDDDDD]"
          >
            <Download className="h-4 w-4 text-[var(--tse-yellow)]" />
            Exportar seções
          </button>
          <div className="relative">
            <button
              type="button"
              disabled={gerandoPdf != null}
              aria-haspopup="menu"
              aria-expanded={menuPdf}
              onClick={() => setMenuPdf((v) => !v)}
              className="flex h-8 items-center gap-1.5 rounded-md bg-[#E8E8E8] px-3 text-[13px] font-semibold hover:bg-[#DDDDDD] disabled:opacity-60"
            >
              {gerandoPdf ? (
                <Loader2 className="h-4 w-4 animate-spin text-[var(--tse-yellow)]" />
              ) : (
                <FileText className="h-4 w-4 text-[var(--tse-yellow)]" />
              )}
              {gerandoPdf ? 'Gerando PDF…' : 'Exportar PDF'}
            </button>
            {menuPdf && (
              <>
                <button
                  type="button"
                  aria-label="Fechar menu"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setMenuPdf(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-1 w-72 overflow-hidden rounded-lg border border-[var(--tse-border)] bg-white text-left shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void exportarPdf('tela')}
                    className="block w-full px-3 py-2.5 text-left hover:bg-[var(--tse-yellow-soft)]"
                  >
                    <span className="block text-[13px] font-bold">Como está na tela</span>
                    <span className="block text-[11px] text-[var(--tse-muted)]">
                      Cards, resumo e a árvore com os níveis abertos agora (sem paginação)
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void exportarPdf('completo')}
                    className="block w-full border-t border-[#EEEEEE] px-3 py-2.5 text-left hover:bg-[var(--tse-yellow-soft)]"
                  >
                    <span className="block text-[13px] font-bold">Completo até seções</span>
                    <span className="block text-[11px] text-[var(--tse-muted)]">
                      Tudo expandido · {formatarVotos2026(linhasCompleto)} linhas
                      {linhasCompleto > 4000 ? ' (arquivo grande, pode demorar)' : ''}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <p className="text-[12px] text-[var(--tse-muted)]">
        {formatarVotos2026(visivel.length)} {comMunicipio ? 'municípios' : 'bairros'}
        {termo ? ' com resultado na busca' : ''} · {escopoLabel}
      </p>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--tse-bar)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
            <tr>
              <th className="px-3 py-2.5">
                {comMunicipio ? 'Município › ' : ''}Bairro › Local › Zona › Seção
              </th>
              <th className="px-3 py-2.5 text-right">Seções</th>
              {candidatos.map((c, i) => (
                <th key={c.id} className="min-w-[150px] px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corCandidato(i) }} />
                    {nomeProprio(c.nome)}
                    <span className="font-normal normal-case">({abreviarCargo(c.cargo)})</span>
                  </span>
                </th>
              ))}
              <th className="px-3 py-2.5">Divisão</th>
              {candidatos.length === 2 && <th className="px-3 py-2.5 text-right">Diferença</th>}
              <th className="px-3 py-2.5 text-right">Soma</th>
            </tr>
          </thead>
          <tbody>{renderLinhas()}</tbody>
        </table>
      </div>

      {visivel.length > limite && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setLimite((n) => n + PAGE_SIZE)}
            className="rounded-md border border-[var(--tse-olive)] bg-white px-5 py-2 text-[13px] font-bold uppercase tracking-wide text-[var(--tse-olive)] hover:bg-[var(--tse-olive)] hover:text-white"
          >
            Carregar mais ({formatarVotos2026(visivel.length - limite)} restantes)
          </button>
        </div>
      )}
    </div>
  )
}
