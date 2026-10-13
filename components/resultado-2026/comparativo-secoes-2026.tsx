'use client'

import { useMemo, useState } from 'react'
import {
  CheckSquare,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  FileText,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import {
  FAIXAS_DIFERENCA_2026,
  compararSecoes2026,
  formatarPct2026,
  formatarRazao2026 as formatarRazao,
  formatarSecao2026,
  formatarVotos2026,
  formatarZona2026,
  parNaFaixa2026,
  parSecao2026,
  razaoPct2026,
  secoesComparadasParaCsv2026,
  valorFaixa2026,
  type FaixaDiferenca2026,
  type LinhaSecaoComparada2026,
  type ModoFaixa2026,
  type ParSecao2026,
  type ResultadoSecao2026Payload,
  type ResultadoSecao2026SecaoMulti,
} from '@/lib/resultado-secao-2026'
import type { ModoPdfSecoes } from './comparativo-secoes-pdf-2026'
import { abreviarCargo, baixarCsv, corCandidato, nomeProprio, normalizarTexto } from './tse-ui'

type CampoOrdem = 'dif' | 'margem' | 'razao'
type OrdemSecoes = 'bairro' | 'total' | `c${number}` | `${CampoOrdem}-${'asc' | 'desc'}-${number}`
/** `geral` = geral à frente de todos; `p{n}` = parceiro n à frente; `e{n}` = empate com o parceiro n. */
type FiltroLider = 'todos' | 'geral' | `p${number}` | `e${number}`
type FaixaCustom = { min: string; max: string }

type FiltroPar = {
  p: number
  selecionadas: FaixaDiferenca2026[]
  min: number | null
  max: number | null
  ativo: boolean
}

/** Bairro com as seções que passaram nos filtros, na ordem escolhida. */
type GrupoBairro = {
  key: string
  municipioNome: string
  bairro: string
  zonas: number[]
  secoes: LinhaSecaoComparada2026[]
  votos: number[]
  pares: ParSecao2026[]
}

/** Bairros por página. */
const PAGE_SIZE = 30
const ORDEM_PADRAO: OrdemSecoes = 'dif-asc-1'

const somarVotos = (linhas: LinhaSecaoComparada2026[], n: number): number[] => {
  const votos = Array.from({ length: n }, () => 0)
  for (const l of linhas) l.votos.forEach((v, i) => (votos[i] += v))
  return votos
}

const paresDe = (votos: number[]): ParSecao2026[] => votos.slice(1).map((v) => parSecao2026(votos[0] ?? 0, v))

/** Agrupa por município + bairro mantendo a ordem em que os bairros aparecem nas seções ordenadas. */
function agruparPorBairro(linhas: LinhaSecaoComparada2026[], n: number): GrupoBairro[] {
  const mapa = new Map<string, LinhaSecaoComparada2026[]>()
  for (const l of linhas) {
    const key = `${l.municipioCodigo}|${l.bairro}`
    const lista = mapa.get(key)
    if (lista) lista.push(l)
    else mapa.set(key, [l])
  }
  return [...mapa.entries()].map(([key, secoes]) => {
    const votos = somarVotos(secoes, n)
    return {
      key,
      municipioNome: secoes[0].municipioNome,
      bairro: secoes[0].bairro,
      zonas: [...new Set(secoes.map((s) => s.zona))].sort((a, b) => a - b),
      secoes,
      votos,
      pares: paresDe(votos),
    }
  })
}

type Props = {
  payload: ResultadoSecao2026Payload
  secoes: ResultadoSecao2026SecaoMulti[]
  indices: number[]
  escopoLabel: string
}

function numeroOuNull(t: string): number | null {
  const v = Number(t.replace(',', '.'))
  return t.trim() === '' || Number.isNaN(v) ? null : v
}

const ultimoNumero = (v: string): number => Number(/(\d+)$/.exec(v)?.[1] ?? 0)

function passaPar(l: LinhaSecaoComparada2026, f: FiltroPar, modo: ModoFaixa2026): boolean {
  if (!f.ativo) return true
  const par = l.pares[f.p - 1]
  if (!par) return true
  if (f.min != null || f.max != null) {
    if (!par.total) return false
    const v = valorFaixa2026(par, modo)
    if (Number.isNaN(v)) return false
    if (f.min != null && v < f.min) return false
    if (f.max != null && v > f.max) return false
    return true
  }
  return f.selecionadas.some((faixa) => parNaFaixa2026(par, faixa, modo))
}

function passaLider(l: LinhaSecaoComparada2026, filtro: FiltroLider): boolean {
  if (filtro === 'todos') return true
  if (filtro === 'geral') return l.pares.every((par) => par.lider === 0)
  const par = l.pares[Number(filtro.slice(1)) - 1]
  if (!par) return true
  return filtro.startsWith('p') ? par.lider === 1 : par.total > 0 && par.lider == null
}

function valorOrdem(par: ParSecao2026, campo: CampoOrdem): number | null {
  if (!par.total) return null
  if (campo === 'dif') return par.diferenca
  if (campo === 'margem') return par.margemPct
  return par.razaoPct
}

function ordenar(linhas: LinhaSecaoComparada2026[], ordem: OrdemSecoes): LinhaSecaoComparada2026[] {
  const porLocal = (a: LinhaSecaoComparada2026, b: LinhaSecaoComparada2026) =>
    a.municipioNome.localeCompare(b.municipioNome, 'pt-BR') ||
    a.bairro.localeCompare(b.bairro, 'pt-BR') ||
    a.zona - b.zona ||
    a.secao - b.secao
  const soma = (l: LinhaSecaoComparada2026) => l.votos.reduce((x, y) => x + y, 0)
  if (ordem === 'bairro') return [...linhas].sort(porLocal)
  if (ordem === 'total') return [...linhas].sort((a, b) => soma(b) - soma(a) || porLocal(a, b))
  if (ordem.startsWith('c')) {
    const i = Number(ordem.slice(1))
    return [...linhas].sort((a, b) => (b.votos[i] ?? 0) - (a.votos[i] ?? 0) || porLocal(a, b))
  }
  const [campo, dir, ps] = ordem.split('-') as [CampoOrdem, 'asc' | 'desc', string]
  const k = Number(ps) - 1
  const asc = dir === 'asc'
  const valores = new Map(linhas.map((l) => [l.key, l.pares[k] ? valorOrdem(l.pares[k], campo) : null]))
  return [...linhas].sort((a, b) => {
    const va = valores.get(a.key) ?? null
    const vb = valores.get(b.key) ?? null
    if (va == null || vb == null) return Number(va == null) - Number(vb == null) || porLocal(a, b)
    return (asc ? va - vb : vb - va) || (asc ? soma(b) - soma(a) : 0) || porLocal(a, b)
  })
}

export function ComparativoSecoes2026({ payload, secoes, indices, escopoLabel }: Props) {
  const [modo, setModo] = useState<ModoFaixa2026>('votos')
  /** Chaves `${parceiro}|${faixa.id}`. */
  const [faixasSel, setFaixasSel] = useState<Set<string>>(() => new Set())
  const [custom, setCustom] = useState<Record<number, FaixaCustom>>({})
  const [filtroLiderSel, setFiltroLider] = useState<FiltroLider>('todos')
  const [ordemSel, setOrdem] = useState<OrdemSecoes>(ORDEM_PADRAO)
  const [busca, setBusca] = useState<string>('')
  const [limite, setLimite] = useState<number>(PAGE_SIZE)
  const [menuPdf, setMenuPdf] = useState<boolean>(false)
  const [gerandoPdf, setGerandoPdf] = useState<ModoPdfSecoes | null>(null)
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set())
  /** Chaves das seções marcadas (`LinhaSecaoComparada2026.key`). */
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set())
  const [somenteMarcadasSel, setSomenteMarcadas] = useState<boolean>(false)

  const candidatos = useMemo(() => indices.map((i) => payload.candidatos[i]), [indices, payload])
  const n = candidatos.length
  const parceiros = useMemo(() => Array.from({ length: Math.max(0, n - 1) }, (_, i) => i + 1), [n])
  const linhas = useMemo(() => compararSecoes2026(payload, secoes, indices), [payload, secoes, indices])
  const comMunicipio = useMemo(() => new Set(linhas.map((l) => l.municipioCodigo)).size > 1, [linhas])
  const faixas = FAIXAS_DIFERENCA_2026[modo]

  const filtroLider: FiltroLider = ultimoNumero(filtroLiderSel) < n ? filtroLiderSel : 'todos'
  const ordem: OrdemSecoes = ultimoNumero(ordemSel) < n ? ordemSel : ORDEM_PADRAO
  const primeiroNome = (i: number) => nomeProprio(candidatos[i].nome).split(' ')[0]
  const nomeGeral = primeiroNome(0)
  const unidade = modo === 'votos' ? 'votos de diferença' : modo === 'pct' ? '% de diferença' : `% dos votos de ${nomeGeral}`

  const termo = normalizarTexto(busca.trim())
  const somenteMarcadas = somenteMarcadasSel && marcadas.size > 0
  const base = useMemo(
    () =>
      linhas.filter(
        (l) =>
          (!somenteMarcadas || marcadas.has(l.key)) &&
          passaLider(l, filtroLider) &&
          (!termo ||
            normalizarTexto(`${l.municipioNome} ${l.bairro} ${formatarSecao2026(l.secao)} ${l.secao}`).includes(termo)),
      ),
    [linhas, termo, filtroLider, somenteMarcadas, marcadas],
  )

  const filtrosPar = useMemo<FiltroPar[]>(
    () =>
      parceiros.map((p) => {
        const selecionadas = faixas.filter((f) => faixasSel.has(`${p}|${f.id}`))
        const min = numeroOuNull(custom[p]?.min ?? '')
        const max = numeroOuNull(custom[p]?.max ?? '')
        return { p, selecionadas, min, max, ativo: selecionadas.length > 0 || min != null || max != null }
      }),
    [parceiros, faixas, faixasSel, custom],
  )

  /** Cada bloco conta as faixas já aplicando os filtros dos outros parceiros. */
  const blocos = useMemo(
    () =>
      filtrosPar.map((fp, k) => {
        const universo = base.filter((l) => filtrosPar.every((o, j) => j === k || passaPar(l, o, modo)))
        const comVoto = universo.filter((l) => l.pares[k]?.total).length
        const distribuicao = faixas.map((faixa) => {
          let quantidade = 0
          let geral = 0
          let parceiro = 0
          for (const l of universo) {
            const par = l.pares[k]
            if (!par || !parNaFaixa2026(par, faixa, modo)) continue
            quantidade++
            if (par.lider === 0) geral++
            else if (par.lider === 1) parceiro++
          }
          return { faixa, quantidade, geral, parceiro }
        })
        return { p: fp.p, comVoto, semVoto: universo.length - comVoto, distribuicao }
      }),
    [base, filtrosPar, faixas, modo],
  )

  const filtradas = useMemo(
    () => base.filter((l) => filtrosPar.every((fp) => passaPar(l, fp, modo))),
    [base, filtrosPar, modo],
  )
  const ordenadas = useMemo(() => ordenar(filtradas, ordem), [filtradas, ordem])
  const grupos = useMemo(() => agruparPorBairro(ordenadas, n), [ordenadas, n])

  const marcadasLinhas = useMemo(() => linhas.filter((l) => marcadas.has(l.key)), [linhas, marcadas])
  const marcadasVotos = useMemo(() => somarVotos(marcadasLinhas, n), [marcadasLinhas, n])
  const marcadasPares = paresDe(marcadasVotos)

  const autoAbrir = termo !== '' || somenteMarcadas
  const estaAberto = (key: string) => autoAbrir || abertos.has(key)

  const alternarGrupo = (key: string) =>
    setAbertos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const alternarSecao = (key: string) =>
    setMarcadas((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const alternarBairro = (g: GrupoBairro) =>
    setMarcadas((prev) => {
      const next = new Set(prev)
      const todas = g.secoes.every((s) => next.has(s.key))
      for (const s of g.secoes) {
        if (todas) next.delete(s.key)
        else next.add(s.key)
      }
      return next
    })

  const limparMarcadas = () => {
    setMarcadas(new Set())
    setSomenteMarcadas(false)
  }

  const resumo = useMemo(() => {
    const votos = somarVotos(filtradas, n)
    const porPar = parceiros.map((p) => {
      let geralFrente = 0
      let parceiroFrente = 0
      let empates = 0
      const difs: number[] = []
      const razoes: number[] = []
      for (const l of filtradas) {
        const par = l.pares[p - 1]
        if (!par?.total) continue
        if (par.lider === 0) geralFrente++
        else if (par.lider === 1) parceiroFrente++
        else empates++
        difs.push(par.diferenca)
        if (par.razaoPct != null) razoes.push(par.razaoPct)
      }
      difs.sort((a, b) => a - b)
      razoes.sort((a, b) => a - b)
      return {
        p,
        geralFrente,
        parceiroFrente,
        empates,
        difMediana: difs.length ? difs[Math.floor(difs.length / 2)] : 0,
        razaoTotal: razaoPct2026(votos[0], votos[p]),
        razaoMediana: razoes.length ? razoes[Math.floor(razoes.length / 2)] : null,
      }
    })
    return { votos, porPar }
  }, [filtradas, n, parceiros])

  const resetPagina = () => setLimite(PAGE_SIZE)

  const alternarFaixa = (p: number, id: string) => {
    setCustom((prev) => ({ ...prev, [p]: { min: '', max: '' } }))
    setFaixasSel((prev) => {
      const next = new Set(prev)
      const chave = `${p}|${id}`
      if (next.has(chave)) next.delete(chave)
      else next.add(chave)
      return next
    })
    resetPagina()
  }

  const mudarCustom = (p: number, campo: keyof FaixaCustom, valor: string) => {
    setCustom((prev) => ({ ...prev, [p]: { min: prev[p]?.min ?? '', max: prev[p]?.max ?? '', [campo]: valor } }))
    setFaixasSel((prev) => new Set([...prev].filter((k) => !k.startsWith(`${p}|`))))
    resetPagina()
  }

  const trocarModo = (m: ModoFaixa2026) => {
    setModo(m)
    setFaixasSel(new Set())
    setCustom({})
    resetPagina()
  }

  const limparFiltros = () => {
    setFaixasSel(new Set())
    setCustom({})
    setFiltroLider('todos')
    setBusca('')
    resetPagina()
  }

  const exportar = () => {
    const escopo = normalizarTexto(escopoLabel).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    baixarCsv(
      `comparativo-por-secao-${candidatos.map((c) => c.id).join('-x-')}-${escopo}.csv`,
      secoesComparadasParaCsv2026(ordenadas, candidatos),
    )
  }

  const temFiltro = filtrosPar.some((f) => f.ativo) || filtroLider !== 'todos' || termo !== ''

  const rotuloLider = (): string | null => {
    if (filtroLider === 'todos') return null
    if (filtroLider === 'geral') return `${nomeGeral} à frente de ${parceiros.length > 1 ? 'todos os parceiros' : primeiroNome(1)}`
    const p = Number(filtroLider.slice(1))
    return filtroLider.startsWith('p') ? `${primeiroNome(p)} à frente de ${nomeGeral}` : `Empate ${nomeGeral} × ${primeiroNome(p)}`
  }

  const rotuloOrdem = (): string => {
    if (ordem === 'bairro') return 'bairro e seção'
    if (ordem === 'total') return 'soma dos votos'
    if (ordem.startsWith('c')) return `votos de ${nomeProprio(candidatos[Number(ordem.slice(1))].nome)}`
    const [campo, dir, ps] = ordem.split('-')
    const sentido = dir === 'asc' ? 'menor' : 'maior'
    const oque = campo === 'dif' ? 'diferença' : campo === 'margem' ? 'margem %' : `% de ${nomeGeral}`
    return `${sentido} ${oque} (${primeiroNome(Number(ps))})`
  }

  const secoesCarregadas = grupos.slice(0, limite).flatMap((g) => g.secoes)

  const celulasPares = (pares: ParSecao2026[], chave: string) =>
    pares.map((par, k) => {
      const p = k + 1
      const supera = par.razaoPct != null && par.razaoPct >= 100
      return [
        <td
          key={`${chave}-v${p}`}
          className={`border-l border-[#EEEEEE] px-3 py-1.5 text-right tabular-nums ${
            par.parceiro ? 'font-semibold' : 'text-[var(--tse-muted)]'
          }`}
        >
          {formatarVotos2026(par.parceiro)}
        </td>,
        <td key={`${chave}-d${p}`} className="whitespace-nowrap px-3 py-1.5 text-right font-bold tabular-nums">
          {!par.total ? (
            <span className="font-normal text-[var(--tse-muted)]">—</span>
          ) : par.lider == null ? (
            <span className="font-normal text-[var(--tse-muted)]">empate</span>
          ) : (
            <span style={{ color: corCandidato(par.lider === 0 ? 0 : p) }}>
              {par.saldo > 0 ? '+' : '−'}
              {formatarVotos2026(par.diferenca)}
              {modo === 'pct' && (
                <span className="ml-1 text-[10px] font-normal text-[var(--tse-muted)]">
                  {formatarPct2026(par.margemPct, 0)}
                </span>
              )}
            </span>
          )}
        </td>,
        <td
          key={`${chave}-r${p}`}
          className={`px-3 py-1.5 text-right tabular-nums ${supera ? 'font-black' : 'font-semibold'}`}
          style={supera ? { color: corCandidato(p) } : undefined}
        >
          {formatarRazao(par.razaoPct)}
        </td>,
      ]
    })

  const exportarPdf = async (modoPdf: ModoPdfSecoes) => {
    setMenuPdf(false)
    setGerandoPdf(modoPdf)
    try {
      const faixaCustom: Record<number, string> = {}
      const filtros: string[] = []
      for (const fp of filtrosPar) {
        if (fp.min != null || fp.max != null) {
          const de = fp.min != null ? `de ${fp.min}` : ''
          const ate = fp.max != null ? `até ${fp.max}` : ''
          faixaCustom[fp.p] = `${[de, ate].filter(Boolean).join(' ')} ${unidade}`
          filtros.push(`${primeiroNome(fp.p)}: ${faixaCustom[fp.p]}`)
        } else if (fp.selecionadas.length) {
          filtros.push(`${primeiroNome(fp.p)}: ${fp.selecionadas.map((f) => f.rotulo).join(', ')}`)
        }
      }
      const lider = rotuloLider()
      if (lider) filtros.push(lider)
      if (termo) filtros.push(`Busca: "${busca.trim()}"`)

      const { exportarComparativoSecoesPdf2026 } = await import('./comparativo-secoes-pdf-2026')
      exportarComparativoSecoesPdf2026({
        meta: payload.meta,
        candidatos,
        modoFaixa: modo,
        faixasSel,
        faixaCustom,
        blocos,
        votos: resumo.votos,
        porPar: resumo.porPar,
        linhas: modoPdf === 'completo' ? ordenadas : secoesCarregadas,
        totalFiltro: filtradas.length,
        totalEscopo: linhas.length,
        escopoLabel,
        comMunicipio,
        filtros,
        ordemLabel: rotuloOrdem(),
        modo: modoPdf,
      })
    } finally {
      setGerandoPdf(null)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-bold">
              {modo === 'razao' ? `Desempenho dos parceiros em relação a ${nomeGeral}` : 'Faixa de diferença por seção'}
            </h3>
            <p className="text-[12px] text-[var(--tse-muted)]">
              {modo === 'razao'
                ? `Votos de cada parceiro como % dos votos de ${nomeProprio(candidatos[0].nome)} — 100% é a mesma votação.`
                : `Diferença entre ${nomeProprio(candidatos[0].nome)} e cada parceiro, seção a seção.`}{' '}
              Clique nas faixas para filtrar; dentro de um parceiro as faixas somam, entre parceiros elas se cruzam.
            </p>
          </div>
          <div className="flex overflow-hidden rounded-md border border-[var(--tse-border)] text-[13px] font-semibold">
            {(
              [
                ['votos', 'Em votos'],
                ['pct', '% da soma'],
                ['razao', `% de ${nomeGeral}`],
              ] as const
            ).map(([m, rotulo]) => (
              <button
                key={m}
                type="button"
                onClick={() => trocarModo(m)}
                className={`px-3 py-1.5 ${
                  modo === m ? 'bg-[var(--tse-yellow-strong)] text-[var(--tse-text)]' : 'bg-white text-[var(--tse-muted)] hover:bg-[var(--tse-bar)]'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        {blocos.map(({ p, comVoto, semVoto, distribuicao }) => (
          <div key={p} className="mt-5 border-t border-[#EEEEEE] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-wide">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: corCandidato(0) }} />
                {nomeGeral}
                <span className="text-[var(--tse-muted)]">×</span>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: corCandidato(p) }} />
                {nomeProprio(candidatos[p].nome)}
                <span className="text-[11px] font-semibold normal-case text-[var(--tse-muted)]">
                  ({abreviarCargo(candidatos[p].cargo)}) · {formatarVotos2026(comVoto)} seções
                  {semVoto > 0 ? ` · ${formatarVotos2026(semVoto)} sem voto dos dois` : ''}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <span className="text-[var(--tse-muted)]">de</span>
                <input
                  inputMode="decimal"
                  value={custom[p]?.min ?? ''}
                  onChange={(e) => mudarCustom(p, 'min', e.target.value)}
                  placeholder="mín."
                  className="h-7 w-16 rounded-md border border-[var(--tse-border)] px-2 text-right tabular-nums outline-none focus:border-[var(--tse-yellow)]"
                />
                <span className="text-[var(--tse-muted)]">até</span>
                <input
                  inputMode="decimal"
                  value={custom[p]?.max ?? ''}
                  onChange={(e) => mudarCustom(p, 'max', e.target.value)}
                  placeholder="máx."
                  className="h-7 w-16 rounded-md border border-[var(--tse-border)] px-2 text-right tabular-nums outline-none focus:border-[var(--tse-yellow)]"
                />
                <span className="text-[var(--tse-muted)]">{unidade}</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
              {distribuicao.map(({ faixa, quantidade, geral, parceiro }) => {
                const ativo = faixasSel.has(`${p}|${faixa.id}`)
                return (
                  <button
                    key={faixa.id}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => alternarFaixa(p, faixa.id)}
                    className={`rounded-xl border-2 p-3 text-left transition-colors ${
                      ativo
                        ? 'border-[var(--tse-yellow)] bg-[var(--tse-yellow-soft)]'
                        : 'border-[#EEEEEE] bg-white hover:border-[var(--tse-gold)]'
                    }`}
                  >
                    <p className="text-[12px] font-semibold text-[var(--tse-muted)]">{faixa.rotulo}</p>
                    <p className="mt-0.5 text-[20px] font-black tabular-nums">{formatarVotos2026(quantidade)}</p>
                    <p className="text-[11px] text-[var(--tse-muted)]">
                      {formatarPct2026(comVoto ? (quantidade / comVoto) * 100 : 0, 1)} das seções
                    </p>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[var(--tse-zero)]">
                      <div
                        style={{ width: `${quantidade ? (geral / quantidade) * 100 : 0}%`, backgroundColor: corCandidato(0) }}
                      />
                      <div
                        style={{ width: `${quantidade ? (parceiro / quantidade) * 100 : 0}%`, backgroundColor: corCandidato(p) }}
                      />
                    </div>
                    {!faixa.id.endsWith('-empate') && (
                      <p className="mt-1 flex flex-wrap gap-x-2 text-[10px] font-bold tabular-nums">
                        <span style={{ color: corCandidato(0) }}>
                          {nomeGeral} {formatarVotos2026(geral)}
                        </span>
                        <span style={{ color: corCandidato(p) }}>
                          {primeiroNome(p)} {formatarVotos2026(parceiro)}
                        </span>
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroLider}
            onChange={(e) => {
              setFiltroLider(e.target.value as FiltroLider)
              resetPagina()
            }}
            className="h-8 rounded-md border border-[var(--tse-border)] bg-white px-2 text-[13px] outline-none focus:border-[var(--tse-yellow)]"
          >
            <option value="todos">Quem está à frente: todos</option>
            <option value="geral">
              {nomeGeral} à frente {parceiros.length > 1 ? 'de todos os parceiros' : `de ${primeiroNome(1)}`}
            </option>
            {parceiros.map((p) => (
              <optgroup key={p} label={nomeProprio(candidatos[p].nome)}>
                <option value={`p${p}`}>
                  {primeiroNome(p)} à frente de {nomeGeral}
                </option>
                <option value={`e${p}`}>
                  Empate {nomeGeral} × {primeiroNome(p)}
                </option>
              </optgroup>
            ))}
          </select>
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as OrdemSecoes)}
            className="h-8 rounded-md border border-[var(--tse-border)] bg-white px-2 text-[13px] outline-none focus:border-[var(--tse-yellow)]"
          >
            {parceiros.map((p) => (
              <optgroup key={p} label={`${nomeGeral} × ${nomeProprio(candidatos[p].nome)}`}>
                <option value={`dif-asc-${p}`}>Menor diferença ({primeiroNome(p)})</option>
                <option value={`dif-desc-${p}`}>Maior diferença ({primeiroNome(p)})</option>
                <option value={`margem-asc-${p}`}>Menor margem % ({primeiroNome(p)})</option>
                <option value={`margem-desc-${p}`}>Maior margem % ({primeiroNome(p)})</option>
                <option value={`razao-asc-${p}`}>
                  Menor % de {nomeGeral} ({primeiroNome(p)})
                </option>
                <option value={`razao-desc-${p}`}>
                  Maior % de {nomeGeral} ({primeiroNome(p)})
                </option>
              </optgroup>
            ))}
            <optgroup label="Geral">
              <option value="total">Soma dos votos</option>
              {candidatos.map((c, i) => (
                <option key={c.id} value={`c${i}`}>
                  Votos de {nomeProprio(c.nome)}
                </option>
              ))}
              <option value="bairro">Bairro e seção</option>
            </optgroup>
          </select>
          {temFiltro && (
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-semibold text-[var(--tse-olive)] hover:underline"
            >
              <X className="h-4 w-4" />
              Limpar filtros
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                resetPagina()
              }}
              placeholder={comMunicipio ? 'Buscar município, bairro ou seção' : 'Buscar bairro ou seção'}
              className="h-8 w-64 rounded-md border border-[var(--tse-border)] bg-white pl-3 pr-9 text-[13px] outline-none focus:border-[var(--tse-yellow)]"
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
            Exportar CSV
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
                      Faixas, resumo e as {formatarVotos2026(secoesCarregadas.length)} seções dos bairros carregados
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void exportarPdf('completo')}
                    className="block w-full border-t border-[#EEEEEE] px-3 py-2.5 text-left hover:bg-[var(--tse-yellow-soft)]"
                  >
                    <span className="block text-[13px] font-bold">Todas as seções do filtro</span>
                    <span className="block text-[11px] text-[var(--tse-muted)]">
                      {formatarVotos2026(ordenadas.length)} seções
                      {ordenadas.length > 4000 ? ' (arquivo grande, pode demorar)' : ''}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <dl className="grid grid-cols-2 gap-4 text-[13px] md:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
          <div>
            <dt className="text-[var(--tse-muted)]">Seções no filtro</dt>
            <dd className="text-lg font-bold">
              {formatarVotos2026(filtradas.length)}
              <span className="ml-1 text-[12px] font-normal text-[var(--tse-muted)]">
                de {formatarVotos2026(linhas.length)}
              </span>
            </dd>
          </div>
          {candidatos.map((c, i) => (
            <div key={c.id}>
              <dt className="flex items-center gap-1.5 text-[var(--tse-muted)]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corCandidato(i) }} />
                {nomeProprio(c.nome)}
              </dt>
              <dd className="text-lg font-bold">
                {formatarVotos2026(resumo.votos[i])}
                <span className="ml-1 text-[12px] font-normal text-[var(--tse-muted)]">votos</span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
          {resumo.porPar.map((r) => (
            <div key={r.p} className="rounded-xl border border-[#EEEEEE] p-3 text-[12px]">
              <p className="flex items-center gap-1.5 text-[13px] font-bold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corCandidato(0) }} />
                {nomeGeral} ×
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corCandidato(r.p) }} />
                {nomeProprio(candidatos[r.p].nome)}
              </p>
              <p className="mt-1.5 flex flex-wrap gap-x-3 tabular-nums">
                <span style={{ color: corCandidato(0) }} className="font-bold">
                  {nomeGeral} à frente {formatarVotos2026(r.geralFrente)}
                </span>
                <span style={{ color: corCandidato(r.p) }} className="font-bold">
                  {primeiroNome(r.p)} à frente {formatarVotos2026(r.parceiroFrente)}
                </span>
                <span className="text-[var(--tse-muted)]">empates {formatarVotos2026(r.empates)}</span>
              </p>
              <p className="mt-1 text-[var(--tse-muted)]">
                Diferença mediana {formatarVotos2026(r.difMediana)} votos · {primeiroNome(r.p)} ={' '}
                <strong className="text-[var(--tse-text)]">{formatarRazao(r.razaoTotal)}</strong> de {nomeGeral} (mediana{' '}
                {formatarRazao(r.razaoMediana)})
              </p>
            </div>
          ))}
        </div>
      </section>

      {marcadas.size > 0 && (
        <section className="rounded-2xl border-2 border-[var(--tse-yellow)] bg-[var(--tse-yellow-soft)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-[15px] font-bold">
              <CheckSquare className="h-5 w-5 text-[var(--tse-gold-text)]" />
              {formatarVotos2026(marcadas.size)} {marcadas.size === 1 ? 'seção marcada' : 'seções marcadas'}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={somenteMarcadas}
                onClick={() => {
                  setSomenteMarcadas((v) => !v)
                  resetPagina()
                }}
                className={`h-8 rounded-md px-3 text-[13px] font-semibold ${
                  somenteMarcadas ? 'bg-[var(--tse-yellow-strong)]' : 'bg-white hover:bg-[var(--tse-bar)]'
                }`}
              >
                {somenteMarcadas ? 'Mostrando só as marcadas' : 'Ver só as marcadas'}
              </button>
              <button
                type="button"
                onClick={limparMarcadas}
                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-semibold text-[var(--tse-olive)] hover:underline"
              >
                <X className="h-4 w-4" />
                Limpar seleção
              </button>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-4 text-[13px] md:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
            {candidatos.map((c, i) => (
              <div key={c.id}>
                <dt className="flex items-center gap-1.5 text-[var(--tse-muted)]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corCandidato(i) }} />
                  {nomeProprio(c.nome)}
                </dt>
                <dd className="text-lg font-bold">
                  {formatarVotos2026(marcadasVotos[i])}
                  <span className="ml-1 text-[12px] font-normal text-[var(--tse-muted)]">votos</span>
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
            {marcadasPares.map((par, k) => {
              const p = k + 1
              return (
                <div key={p} className="tabular-nums">
                  <span className="font-semibold">
                    {nomeGeral} × {primeiroNome(p)}:
                  </span>{' '}
                  {!par.total ? (
                    <span className="text-[var(--tse-muted)]">sem votos</span>
                  ) : par.lider == null ? (
                    <span className="text-[var(--tse-muted)]">empate</span>
                  ) : (
                    <span className="font-bold" style={{ color: corCandidato(par.lider === 0 ? 0 : p) }}>
                      {primeiroNome(par.lider === 0 ? 0 : p)} +{formatarVotos2026(par.diferenca)}
                    </span>
                  )}
                  <span className="text-[var(--tse-muted)]">
                    {' '}
                    · {primeiroNome(p)} = {formatarRazao(par.razaoPct)} de {nomeGeral}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-[var(--tse-muted)]">
          {formatarVotos2026(grupos.length)} bairros · {formatarVotos2026(ordenadas.length)} seções · {escopoLabel} ·
          diferença positiva = {nomeGeral} à frente · marque seções para somar
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-wide">
          <button
            type="button"
            onClick={() => setAbertos(new Set(grupos.map((g) => g.key)))}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#CFCFCF] bg-white px-3 py-1.5 hover:border-[var(--tse-olive)]"
          >
            <ChevronsUpDown className="h-4 w-4 text-[var(--tse-gold-text)]" />
            Expandir tudo
          </button>
          <button
            type="button"
            onClick={() => setAbertos(new Set())}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#CFCFCF] bg-white px-3 py-1.5 hover:border-[var(--tse-olive)]"
          >
            <ChevronsDownUp className="h-4 w-4 text-[var(--tse-gold-text)]" />
            Recolher tudo
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--tse-bar)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
            <tr>
              <th rowSpan={2} className="w-8 px-3 py-2.5 align-bottom">
                <span className="sr-only">Marcar</span>
              </th>
              <th rowSpan={2} className="px-3 py-2.5 align-bottom">
                {comMunicipio ? 'Município › ' : ''}Bairro › Seção
              </th>
              <th rowSpan={2} className="px-3 py-2.5 text-right align-bottom">
                Zona
              </th>
              <th rowSpan={2} className="px-3 py-2.5 text-right align-bottom">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corCandidato(0) }} />
                  {nomeProprio(candidatos[0].nome)}
                </span>
              </th>
              {parceiros.map((p) => (
                <th key={p} colSpan={3} className="border-l border-[#E2E2DC] px-3 pt-2.5 text-center">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corCandidato(p) }} />
                    {nomeProprio(candidatos[p].nome)}
                    <span className="font-normal normal-case">({abreviarCargo(candidatos[p].cargo)})</span>
                  </span>
                </th>
              ))}
            </tr>
            <tr className="text-[10px]">
              {parceiros.map((p) => [
                <th key={`v${p}`} className="border-l border-[#E2E2DC] px-3 py-1.5 text-right">
                  Votos
                </th>,
                <th key={`d${p}`} className="px-3 py-1.5 text-right">
                  Diferença
                </th>,
                <th key={`r${p}`} className="px-3 py-1.5 text-right">
                  % de {nomeGeral}
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {grupos.slice(0, limite).map((g) => {
              const aberto = estaAberto(g.key)
              const qtdMarcadas = g.secoes.filter((s) => marcadas.has(s.key)).length
              const todasMarcadas = qtdMarcadas === g.secoes.length
              return [
                <tr key={g.key} className="border-t border-[#E2E2DC] bg-[#FBFAF3] font-bold">
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={todasMarcadas}
                      ref={(el) => {
                        if (el) el.indeterminate = qtdMarcadas > 0 && !todasMarcadas
                      }}
                      onChange={() => alternarBairro(g)}
                      aria-label={`Marcar todas as seções de ${g.bairro}`}
                      className="h-4 w-4 cursor-pointer accent-[var(--tse-yellow)]"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <button
                      type="button"
                      aria-expanded={aberto}
                      onClick={() => alternarGrupo(g.key)}
                      className="flex items-center gap-1.5 text-left uppercase hover:text-[var(--tse-olive)]"
                    >
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 text-[var(--tse-gold-text)] transition-transform ${aberto ? 'rotate-90' : ''}`}
                      />
                      {comMunicipio ? `${g.municipioNome} › ` : ''}
                      {g.bairro}
                      <span className="rounded bg-[var(--tse-bar)] px-1.5 py-px text-[10px] font-semibold normal-case text-[var(--tse-muted)]">
                        {formatarVotos2026(g.secoes.length)} {g.secoes.length === 1 ? 'seção' : 'seções'}
                      </span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right font-normal tabular-nums">
                    {g.zonas.map(formatarZona2026).join(' · ')}
                  </td>
                  <td className="px-3 py-1.5 text-right font-black tabular-nums">{formatarVotos2026(g.votos[0] ?? 0)}</td>
                  {celulasPares(g.pares, `g${g.key}`)}
                </tr>,
                ...(aberto
                  ? g.secoes.map((l) => (
                      <tr
                        key={l.key}
                        className={`border-t border-[#EEEEEE] ${marcadas.has(l.key) ? 'bg-[var(--tse-yellow-soft)]' : 'hover:bg-[#FDFDF8]'}`}
                      >
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={marcadas.has(l.key)}
                            onChange={() => alternarSecao(l.key)}
                            aria-label={`Marcar seção ${formatarSecao2026(l.secao)}`}
                            className="h-4 w-4 cursor-pointer accent-[var(--tse-yellow)]"
                          />
                        </td>
                        <td className="py-1.5 pl-10 pr-3 font-semibold tabular-nums">Seção {formatarSecao2026(l.secao)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatarZona2026(l.zona)}</td>
                        <td className="px-3 py-1.5 text-right font-bold tabular-nums">
                          {formatarVotos2026(l.votos[0] ?? 0)}
                        </td>
                        {celulasPares(l.pares, l.key)}
                      </tr>
                    ))
                  : []),
              ]
            })}
            {ordenadas.length === 0 && (
              <tr>
                <td colSpan={4 + 3 * parceiros.length} className="px-3 py-8 text-center text-[var(--tse-muted)]">
                  Nenhuma seção nessa combinação de filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {grupos.length > limite && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setLimite((v) => v + PAGE_SIZE)}
            className="rounded-md border border-[var(--tse-olive)] bg-white px-5 py-2 text-[13px] font-bold uppercase tracking-wide text-[var(--tse-olive)] hover:bg-[var(--tse-olive)] hover:text-white"
          >
            Carregar mais ({formatarVotos2026(grupos.length - limite)} bairros restantes)
          </button>
        </div>
      )}
    </div>
  )
}
