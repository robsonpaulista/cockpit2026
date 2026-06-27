'use client'

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  resumoAccentTextClass,
  resumoAmberBadgeClass,
  resumoAmberChipActiveStrongClass,
  resumoAmberColHighlightClass,
  resumoAmberGroupCellClass,
  resumoAmberGroupRowClass,
  resumoAmberPillClass,
} from '@/lib/resumo-eleicoes-table-styles'
import type { ParSemelhanteSecao } from '@/lib/votacao-secao-correlacao'
import { paresSemelhantesAgregados } from '@/lib/votacao-secao-correlacao'
import {
  agruparMatrizPorBairro,
  agruparMatrizPorLocal,
  type CandidatoMatrizColuna,
  type GrupoBairroMatriz,
  type GrupoLocalMatriz,
  type LinhaMatrizSecao,
  type MatrizVotacaoSecao,
} from '@/lib/votacao-secao-matriz'
import { isColunaExpectativaLideranca } from '@/lib/lideranca-expectativa-secao'

const LOCAIS_POR_PAGINA = 25
const BAIRROS_POR_PAGINA = 20

export const AGRUPAMENTOS_MATRIZ = [
  { id: 'local' as const, label: 'Por local' },
  { id: 'bairro' as const, label: 'Por bairro' },
]

export type AgrupamentoMatriz = (typeof AGRUPAMENTOS_MATRIZ)[number]['id']

export type TabelaMatrizVotacaoSecaoHandle = {
  recolherTodos: () => void
  expandirTodos: () => void
}

export type TabelaMatrizVotacaoSecaoProps = {
  matriz: MatrizVotacaoSecao
  agrupamento?: AgrupamentoMatriz
  onAgrupamentoChange?: (agrupamento: AgrupamentoMatriz) => void
  modoComparar?: boolean
  multiAno?: boolean
  destacarSemelhanca?: boolean
  margemSemelhancaPct?: number
  paresPorSecao?: Map<string, ParSemelhanteSecao[]>
  filtroSoSemelhantes?: boolean
  onToggleFiltroSemelhantes?: () => void
  totalSecoesSemelhantes?: number
  mostrarToolbarSemelhanca?: boolean
  compacto?: boolean
}

function abreviarCargo(dsCargo: string): string {
  const map: Record<string, string> = {
    'Deputado Federal': 'Fed.',
    'Deputado Estadual': 'Est.',
    Governador: 'Gov.',
    Senador: 'Sen.',
    Prefeito: 'Pref.',
    Vereador: 'Ver.',
  }
  return map[dsCargo] ?? dsCargo
}

function rotuloCabecalhoCandidato(c: CandidatoMatrizColuna, multiAno: boolean): string {
  if (isColunaExpectativaLideranca(c.id)) return 'Exp. 2026'
  if (multiAno && c.anoEleicao != null) {
    return `${abreviarCargo(c.dsCargo)} ${c.anoEleicao}`
  }
  return abreviarCargo(c.dsCargo)
}

export const TabelaMatrizVotacaoSecao = forwardRef<
  TabelaMatrizVotacaoSecaoHandle,
  TabelaMatrizVotacaoSecaoProps
>(function TabelaMatrizVotacaoSecao(
  {
    matriz,
    agrupamento: agrupamentoControlado,
    onAgrupamentoChange,
    modoComparar = false,
    multiAno = false,
    destacarSemelhanca = false,
    margemSemelhancaPct = 50,
    paresPorSecao = new Map(),
    filtroSoSemelhantes = false,
    onToggleFiltroSemelhantes,
    totalSecoesSemelhantes = 0,
    mostrarToolbarSemelhanca = true,
    compacto = false,
  },
  ref,
) {
  const [agrupamentoInterno, setAgrupamentoInterno] = useState<AgrupamentoMatriz>('bairro')
  const agrupamento = agrupamentoControlado ?? agrupamentoInterno
  const setAgrupamento = onAgrupamentoChange ?? setAgrupamentoInterno

  const [pagina, setPagina] = useState(1)
  const [bairrosExpandidos, setBairrosExpandidos] = useState<Set<string>>(new Set())
  const [locaisExpandidos, setLocaisExpandidos] = useState<Set<string>>(new Set())

  const gruposLocal = useMemo(() => agruparMatrizPorLocal(matriz.linhas), [matriz.linhas])
  const gruposBairro = useMemo(() => agruparMatrizPorBairro(matriz.linhas), [matriz.linhas])

  const grupoTemSecaoSemelhante = useCallback(
    (secoes: LinhaMatrizSecao[]) =>
      secoes.some((s) => (paresPorSecao.get(s.localId)?.length ?? 0) > 0),
    [paresPorSecao],
  )

  const gruposBairroVisiveis = useMemo(() => {
    if (!filtroSoSemelhantes || !destacarSemelhanca) return gruposBairro
    return gruposBairro.filter((g) => g.locais.some((l) => grupoTemSecaoSemelhante(l.secoes)))
  }, [gruposBairro, filtroSoSemelhantes, destacarSemelhanca, grupoTemSecaoSemelhante])

  const gruposLocalVisiveis = useMemo(() => {
    if (!filtroSoSemelhantes || !destacarSemelhanca) return gruposLocal
    return gruposLocal.filter((g) => grupoTemSecaoSemelhante(g.secoes))
  }, [gruposLocal, filtroSoSemelhantes, destacarSemelhanca, grupoTemSecaoSemelhante])

  const totalPaginas =
    agrupamento === 'bairro'
      ? Math.max(1, Math.ceil(gruposBairroVisiveis.length / BAIRROS_POR_PAGINA))
      : Math.max(1, Math.ceil(gruposLocalVisiveis.length / LOCAIS_POR_PAGINA))

  const gruposLocalPagina = useMemo(() => {
    const start = (pagina - 1) * LOCAIS_POR_PAGINA
    return gruposLocalVisiveis.slice(start, start + LOCAIS_POR_PAGINA)
  }, [gruposLocalVisiveis, pagina])

  const gruposBairroPagina = useMemo(() => {
    const start = (pagina - 1) * BAIRROS_POR_PAGINA
    return gruposBairroVisiveis.slice(start, start + BAIRROS_POR_PAGINA)
  }, [gruposBairroVisiveis, pagina])

  const chaveLocalExpandido = (bairroId: string | null, localId: string) =>
    bairroId ? `${bairroId}::${localId}` : localId

  const toggleLocal = (localId: string, bairroId: string | null = null) => {
    const key = chaveLocalExpandido(bairroId, localId)
    setLocaisExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleBairro = (id: string) => {
    setBairrosExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandirTodos = useCallback(() => {
    if (agrupamento === 'bairro') {
      setBairrosExpandidos(new Set(gruposBairro.map((g) => g.id)))
      setLocaisExpandidos(
        new Set(gruposBairro.flatMap((b) => b.locais.map((l) => chaveLocalExpandido(b.id, l.id)))),
      )
      return
    }
    setLocaisExpandidos(new Set(gruposLocal.map((g) => g.id)))
  }, [agrupamento, gruposBairro, gruposLocal])

  const recolherTodos = useCallback(() => {
    setLocaisExpandidos(new Set())
    setBairrosExpandidos(new Set())
  }, [])

  useImperativeHandle(ref, () => ({ recolherTodos, expandirTodos }), [recolherTodos, expandirTodos])

  if (matriz.candidatos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-card bg-background/60 px-4 py-6 text-sm text-text-secondary">
        Nenhum candidato selecionado na matriz.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-card bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card px-4 py-2 text-xs text-text-secondary">
        <span>
          {agrupamento === 'bairro'
            ? 'Bairros (TSE) · expanda para locais e seções · colunas = candidatos'
            : 'Locais agrupados · expanda para seções · colunas = candidatos'}
          {destacarSemelhanca && mostrarToolbarSemelhanca && (
            <span className="ml-2 text-text-secondary">
              pílulas <span className="font-medium text-text-primary">NOME≈NOME</span> = votos
              semelhantes (até {margemSemelhancaPct}%)
            </span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {!compacto && (
            <div className="flex rounded-lg border border-card p-0.5">
              {AGRUPAMENTOS_MATRIZ.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setAgrupamento(opt.id)
                    setPagina(1)
                    recolherTodos()
                  }}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] transition-colors',
                    agrupamento === opt.id
                      ? cn(resumoAmberColHighlightClass, 'font-medium text-text-primary')
                      : 'text-text-secondary hover:bg-background',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {destacarSemelhanca && onToggleFiltroSemelhantes && (
            <button
              type="button"
              onClick={() => {
                onToggleFiltroSemelhantes()
                setPagina(1)
              }}
              className={cn(
                'rounded border px-2 py-1 transition-colors',
                filtroSoSemelhantes
                  ? resumoAmberChipActiveStrongClass
                  : 'border-card hover:bg-background',
              )}
            >
              {filtroSoSemelhantes
                ? 'Mostrar todas as seções'
                : `Só semelhantes (${totalSecoesSemelhantes})`}
            </button>
          )}
          <button
            type="button"
            onClick={expandirTodos}
            className="rounded border border-card px-2 py-1 hover:bg-background"
          >
            Expandir todos
          </button>
          <button
            type="button"
            onClick={recolherTodos}
            className="rounded border border-card px-2 py-1 hover:bg-background"
          >
            Recolher todos
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-xs">
          <thead>
            <tr className="border-b border-card bg-background/70">
              <th className="sticky left-0 z-20 min-w-[18rem] bg-background/95 px-2 py-2 font-medium backdrop-blur">
                {agrupamento === 'bairro' ? 'Bairro / Local / Seção' : 'Local / Seção'}
              </th>
              {matriz.candidatos.map((c) => (
                <th
                  key={c.id}
                  className={cn(
                    'min-w-[5.5rem] max-w-[8rem] px-2 py-2 text-right font-medium align-bottom',
                    isColunaExpectativaLideranca(c.id) && 'bg-accent-gold/10',
                  )}
                  title={
                    isColunaExpectativaLideranca(c.id)
                      ? `${c.nmVotavel} · expectativa distribuída por seção · total ${c.totalVotos.toLocaleString('pt-BR')}`
                      : `${c.dsCargo} · ${c.nmVotavel} · total ${c.totalVotos.toLocaleString('pt-BR')}`
                  }
                >
                  {modoComparar && (
                    <div className={cn('truncate text-[9px] font-normal uppercase', resumoAccentTextClass())}>
                      {rotuloCabecalhoCandidato(c, multiAno)}
                    </div>
                  )}
                  <div className="truncate">
                    {isColunaExpectativaLideranca(c.id) ? c.nmVotavel.split(' ')[0] : c.nmVotavel.split(' ')[0]}
                  </div>
                  <div className="truncate font-normal text-[10px] text-text-secondary">
                    {isColunaExpectativaLideranca(c.id) ? 'liderança' : c.nrVotavel}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agrupamento === 'bairro'
              ? gruposBairroPagina.map((grupo) => (
                  <GrupoBairroRows
                    key={grupo.id}
                    grupo={grupo}
                    candidatos={matriz.candidatos}
                    bairroExpandido={bairrosExpandidos.has(grupo.id)}
                    locaisExpandidos={locaisExpandidos}
                    paresPorSecao={paresPorSecao}
                    destacarSemelhanca={destacarSemelhanca}
                    onToggleBairro={() => toggleBairro(grupo.id)}
                    onToggleLocal={(localId) => toggleLocal(localId, grupo.id)}
                  />
                ))
              : gruposLocalPagina.map((grupo) => {
                  const expandido = locaisExpandidos.has(grupo.id)
                  const multiSecao = grupo.totalSecoes > 1
                  return (
                    <GrupoLocalRows
                      key={grupo.id}
                      grupo={grupo}
                      candidatos={matriz.candidatos}
                      expandido={expandido}
                      multiSecao={multiSecao}
                      paresPorSecao={paresPorSecao}
                      destacarSemelhanca={destacarSemelhanca}
                      onToggle={() => toggleLocal(grupo.id)}
                    />
                  )
                })}
          </tbody>
          <tfoot>
            <tr className="border-t border-card bg-background/80 font-semibold">
              <td className="sticky left-0 z-10 bg-background/95 px-2 py-2">Total no município</td>
              {matriz.candidatos.map((c) => (
                <td key={c.id} className="px-2 py-2 text-right tabular-nums">
                  {c.totalVotos.toLocaleString('pt-BR')}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between border-t border-card px-4 py-3 text-xs text-text-secondary">
          <span>
            Página {pagina} de {totalPaginas}
            {agrupamento === 'bairro'
              ? ` · ${gruposBairroVisiveis.length} bairros · ${matriz.linhas.length} seções`
              : ` · ${gruposLocalVisiveis.length} locais · ${matriz.linhas.length} seções`}
            {destacarSemelhanca && ` · ${totalSecoesSemelhantes} semelhantes`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              className="rounded border border-card px-2 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              className="rounded border border-card px-2 py-1 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

function PilulasSemelhanca({
  pares,
  compacto = false,
}: {
  pares: ParSemelhanteSecao[]
  compacto?: boolean
}) {
  if (pares.length === 0) return null

  if (compacto && pares.length > 3) {
    return (
      <>
        {pares.slice(0, 2).map((p) => (
          <span
            key={`${p.idA}-${p.idB}`}
            className={cn('inline-flex shrink-0 rounded-full px-1.5 py-px text-[9px] font-medium text-text-primary', resumoAmberPillClass)}
            title={`${p.nomeA} e ${p.nomeB} — votos semelhantes`}
          >
            {p.nomeA}≈{p.nomeB}
          </span>
        ))}
        <span className="shrink-0 text-[9px] text-text-secondary">+{pares.length - 2}</span>
      </>
    )
  }

  return (
    <>
      {pares.map((p) => (
        <span
          key={`${p.idA}-${p.idB}`}
          className={cn('inline-flex shrink-0 rounded-full px-1.5 py-px text-[9px] font-medium text-text-primary', resumoAmberPillClass)}
          title={`${p.nomeA} e ${p.nomeB} — votos semelhantes nesta seção`}
        >
          {p.nomeA}≈{p.nomeB}
        </span>
      ))}
    </>
  )
}

function BadgeBairro({ bairro }: { bairro: string | null | undefined }) {
  const nome = bairro?.trim()
  if (!nome) return null
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium text-text-primary', resumoAmberBadgeClass)}>
      {nome}
    </span>
  )
}

function MetaLocalSecao({
  nrZona,
  nrSecao,
  nrLocalVotacao,
  nmBairro,
  endereco,
  ocultarBairro = false,
}: {
  nrZona: number
  nrSecao: number
  nrLocalVotacao: number | null
  nmBairro: string | null | undefined
  endereco: string | null | undefined
  ocultarBairro?: boolean
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-[10px] text-text-secondary">
      <span>
        Zona {nrZona} · Seção {nrSecao}
        {nrLocalVotacao != null ? ` · Local ${nrLocalVotacao}` : ''}
      </span>
      {!ocultarBairro ? <BadgeBairro bairro={nmBairro} /> : null}
      {endereco ? <span className="basis-full sm:basis-auto">· {endereco}</span> : null}
    </div>
  )
}

function CelulasVotosMatriz({
  candidatos,
  votos,
  liderId,
  destacarLider = true,
}: {
  candidatos: CandidatoMatrizColuna[]
  votos: Record<string, number>
  liderId: string | null
  destacarLider?: boolean
}) {
  return (
    <>
      {candidatos.map((c) => {
        const qt = votos[c.id] ?? 0
        const lider = destacarLider && liderId === c.id && qt > 0
        const expectativa = isColunaExpectativaLideranca(c.id)
        return (
          <td
            key={c.id}
            className={cn(
              'px-2 py-2 text-right tabular-nums',
              expectativa && 'bg-accent-gold/5 font-medium text-text-primary',
              lider && cn(resumoAmberColHighlightClass, 'font-semibold text-text-primary'),
              !qt && 'text-text-secondary/40',
            )}
          >
            {qt > 0 ? qt.toLocaleString('pt-BR') : '—'}
          </td>
        )
      })}
    </>
  )
}

function GrupoBairroRows({
  grupo,
  candidatos,
  bairroExpandido,
  locaisExpandidos,
  paresPorSecao,
  destacarSemelhanca,
  onToggleBairro,
  onToggleLocal,
}: {
  grupo: GrupoBairroMatriz
  candidatos: CandidatoMatrizColuna[]
  bairroExpandido: boolean
  locaisExpandidos: Set<string>
  paresPorSecao: Map<string, ParSemelhanteSecao[]>
  destacarSemelhanca: boolean
  onToggleBairro: () => void
  onToggleLocal: (localId: string) => void
}) {
  const localUnico = grupo.totalLocais === 1 ? grupo.locais[0] : null
  const secoesGrupo = grupo.locais.flatMap((l) => l.secoes)
  const paresBairro = paresSemelhantesAgregados(secoesGrupo, paresPorSecao)

  if (localUnico && localUnico.totalSecoes === 1) {
    const secao = localUnico.secoes[0]
    const endereco = localUnico.dsEndereco?.trim()
    const pares = paresPorSecao.get(secao.localId) ?? []
    return (
      <tr className={resumoAmberGroupRowClass}>
        <td className={resumoAmberGroupCellClass}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-text-primary">
            <span>{grupo.nmBairro}</span>
            {destacarSemelhanca && <PilulasSemelhanca pares={pares} />}
          </div>
          <div className="mt-0.5 font-medium text-text-primary">
            {localUnico.nmLocalVotacao || 'Local não informado'}
          </div>
          <MetaLocalSecao
            nrZona={localUnico.nrZona}
            nrSecao={secao.nrSecao}
            nrLocalVotacao={localUnico.nrLocalVotacao}
            nmBairro={null}
            endereco={endereco}
            ocultarBairro
          />
        </td>
        <CelulasVotosMatriz candidatos={candidatos} votos={grupo.votos} liderId={grupo.liderId} />
      </tr>
    )
  }

  const rotuloContagem =
    grupo.totalLocais === 1
      ? `${grupo.totalSecoes} seções`
      : `${grupo.totalLocais} locais · ${grupo.totalSecoes} seções`

  return (
    <>
      <tr className={resumoAmberGroupRowClass}>
        <td className={resumoAmberGroupCellClass}>
          <button
            type="button"
            onClick={onToggleBairro}
            className="flex w-full items-start gap-2 text-left"
            aria-expanded={bairroExpandido}
          >
            <span className="mt-0.5 shrink-0 text-text-secondary">
              {bairroExpandido ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-text-primary">{grupo.nmBairro}</span>
                <span className="shrink-0 rounded-full border border-card bg-surface px-2 py-0.5 text-[10px] tabular-nums text-text-secondary">
                  {rotuloContagem}
                </span>
                {destacarSemelhanca && (
                  <PilulasSemelhanca pares={paresBairro} compacto={!bairroExpandido} />
                )}
              </span>
            </span>
          </button>
        </td>
        <CelulasVotosMatriz candidatos={candidatos} votos={grupo.votos} liderId={grupo.liderId} />
      </tr>
      {bairroExpandido
        ? grupo.locais.map((local) => (
            <GrupoLocalRows
              key={local.id}
              grupo={local}
              candidatos={candidatos}
              expandido={locaisExpandidos.has(`${grupo.id}::${local.id}`)}
              multiSecao={local.totalSecoes > 1}
              paresPorSecao={paresPorSecao}
              destacarSemelhanca={destacarSemelhanca}
              onToggle={() => onToggleLocal(local.id)}
              indent={1}
              ocultarBairro
            />
          ))
        : null}
    </>
  )
}

function GrupoLocalRows({
  grupo,
  candidatos,
  expandido,
  multiSecao,
  paresPorSecao,
  destacarSemelhanca,
  onToggle,
  indent = 0,
  ocultarBairro = false,
}: {
  grupo: GrupoLocalMatriz
  candidatos: CandidatoMatrizColuna[]
  expandido: boolean
  multiSecao: boolean
  paresPorSecao: Map<string, ParSemelhanteSecao[]>
  destacarSemelhanca: boolean
  onToggle: () => void
  indent?: number
  ocultarBairro?: boolean
}) {
  const tituloLocal = grupo.nmLocalVotacao || 'Local não informado'
  const endereco = grupo.dsEndereco?.trim()
  const padLeft = indent === 0 ? '' : indent === 1 ? 'pl-6' : 'pl-10'
  const paresLocal = paresSemelhantesAgregados(grupo.secoes, paresPorSecao)

  if (!multiSecao) {
    const secao = grupo.secoes[0]
    const pares = paresPorSecao.get(secao.localId) ?? []
    return (
      <tr className="border-b border-card/50 hover:bg-background/30">
        <td className={cn('sticky left-0 z-10 bg-surface px-2 py-2', padLeft)}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-text-primary">
            <span>{tituloLocal}</span>
            {destacarSemelhanca && <PilulasSemelhanca pares={pares} />}
          </div>
          <MetaLocalSecao
            nrZona={grupo.nrZona}
            nrSecao={secao.nrSecao}
            nrLocalVotacao={grupo.nrLocalVotacao}
            nmBairro={grupo.nmBairro ?? secao.nmBairro}
            endereco={endereco}
            ocultarBairro={ocultarBairro}
          />
        </td>
        <CelulasVotosMatriz
          candidatos={candidatos}
          votos={secao.votos}
          liderId={secao.liderId}
        />
      </tr>
    )
  }

  return (
    <>
      <tr className="border-b border-card/50 bg-background/20 hover:bg-background/40">
        <td className={cn('sticky left-0 z-10 bg-background/30 px-2 py-2', padLeft)}>
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-start gap-2 text-left"
            aria-expanded={expandido}
          >
            <span className="mt-0.5 shrink-0 text-text-secondary">
              {expandido ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-text-primary">{tituloLocal}</span>
                {!ocultarBairro ? <BadgeBairro bairro={grupo.nmBairro} /> : null}
                <span className="shrink-0 rounded-full border border-card bg-surface px-2 py-0.5 text-[10px] tabular-nums text-text-secondary">
                  {grupo.totalSecoes} seções
                </span>
                {destacarSemelhanca && !expandido && (
                  <PilulasSemelhanca pares={paresLocal} compacto />
                )}
              </span>
              <span className="mt-0.5 block">
                <MetaLocalSecao
                  nrZona={grupo.nrZona}
                  nrSecao={grupo.secoes[0]?.nrSecao ?? 0}
                  nrLocalVotacao={grupo.nrLocalVotacao}
                  nmBairro={grupo.nmBairro}
                  endereco={endereco}
                  ocultarBairro={ocultarBairro}
                />
              </span>
            </span>
          </button>
        </td>
        <CelulasVotosMatriz
          candidatos={candidatos}
          votos={grupo.votos}
          liderId={grupo.liderId}
        />
      </tr>
      {expandido
        ? grupo.secoes.map((secao) => (
            <LinhaSecaoMatriz
              key={secao.localId}
              secao={secao}
              candidatos={candidatos}
              pares={paresPorSecao.get(secao.localId) ?? []}
              destacarSemelhanca={destacarSemelhanca}
              indent={indent + 1}
              ocultarBairro={ocultarBairro}
            />
          ))
        : null}
    </>
  )
}

function LinhaSecaoMatriz({
  secao,
  candidatos,
  pares,
  destacarSemelhanca,
  indent = 0,
  ocultarBairro = false,
}: {
  secao: LinhaMatrizSecao
  candidatos: CandidatoMatrizColuna[]
  pares: ParSemelhanteSecao[]
  destacarSemelhanca: boolean
  indent?: number
  ocultarBairro?: boolean
}) {
  const padLeft = indent <= 0 ? 'pl-9' : indent === 1 ? 'pl-12' : 'pl-16'

  return (
    <tr className="border-b border-card/30 hover:bg-background/20">
      <td className={cn('sticky left-0 z-10 bg-surface/95 px-2 py-1.5', padLeft)}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-text-primary">
          <span>
            Seção <span className="tabular-nums font-medium">{secao.nrSecao}</span>
          </span>
          {destacarSemelhanca && <PilulasSemelhanca pares={pares} />}
        </div>
        <div className="text-[10px] text-text-secondary">
          Zona {secao.nrZona}
          {secao.nrLocalVotacao != null ? ` · Local ${secao.nrLocalVotacao}` : ''}
        </div>
        {!ocultarBairro ? <BadgeBairro bairro={secao.nmBairro} /> : null}
      </td>
      <CelulasVotosMatriz
        candidatos={candidatos}
        votos={secao.votos}
        liderId={secao.liderId}
      />
    </tr>
  )
}
