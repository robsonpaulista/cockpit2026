'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ChevronDown,
  GitBranch,
  Info,
  Link2,
  MapPin,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  chaveParSemelhante,
  distribuicaoVinculoPorBairro,
  MARGEM_VOTOS_CASADOS,
  PCT_MINIMO_VOTO_CASADO_MODAL,
  mapearVotosCasadosMunicipio,
  type BairroDistribuicaoVinculo,
  type EmparelhamentoVotoCasado,
  type GrupoVotoCasadoPorOrigem,
} from '@/lib/votacao-secao-correlacao'
import type { CandidatoMatrizColuna, LinhaMatrizSecao } from '@/lib/votacao-secao-matriz'

const ABREV_CARGO: Record<string, string> = {
  'Deputado Federal': 'Fed.',
  'Deputado Estadual': 'Est.',
  Governador: 'Gov.',
  Senador: 'Sen.',
  Prefeito: 'Pref.',
  Vereador: 'Ver.',
}

function abreviarCargo(dsCargo: string): string {
  return ABREV_CARGO[dsCargo] ?? dsCargo
}

function formatarNome(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : ''))
    .join(' ')
}

function primeiroNome(nome: string): string {
  return formatarNome(nome).split(/\s+/)[0] ?? nome
}

function formatarCidade(nome: string): string {
  return nome.trim() ? formatarNome(nome) : ''
}

type ModalMapearVotoCasadoProps = {
  aberto: boolean
  onFechar: () => void
  municipio: string
  ano: number
  linhas: LinhaMatrizSecao[]
  candidatos: CandidatoMatrizColuna[]
  onAplicar: (payload: {
    candidatoIds: string[]
    paresChaves: Set<string>
    margem: number
  }) => void
}

export function ModalMapearVotoCasado({
  aberto,
  onFechar,
  municipio,
  ano,
  linhas,
  candidatos,
  onAplicar,
}: ModalMapearVotoCasadoProps) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [nivelAtivoIdx, setNivelAtivoIdx] = useState(0)
  const [vinculoExpandido, setVinculoExpandido] = useState<string | null>(null)

  const mapeamento = useMemo(
    () =>
      aberto
        ? mapearVotosCasadosMunicipio(linhas, candidatos, { margem: MARGEM_VOTOS_CASADOS })
        : null,
    [aberto, linhas, candidatos],
  )

  const niveis = mapeamento?.niveisHierarquia ?? []
  const nivelAtivo = niveis[nivelAtivoIdx] ?? null

  useEffect(() => {
    if (!aberto || !mapeamento) return
    const iniciais = new Set<string>()
    for (const nivel of mapeamento.niveisHierarquia) {
      for (const grupo of nivel.gruposPorOrigem) {
        for (const v of grupo.vinculos) {
          iniciais.add(chaveParSemelhante(v.candidatoOrigem.id, v.candidatoDestino.id))
        }
      }
    }
    setSelecionados(iniciais)
    setNivelAtivoIdx(0)
    setVinculoExpandido(null)
  }, [aberto, mapeamento])

  useEffect(() => {
    setVinculoExpandido(null)
  }, [nivelAtivoIdx])

  useEffect(() => {
    if (!aberto) return
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflowAnterior
    }
  }, [aberto])

  if (!aberto) return null

  const margemPct = mapeamento?.margemPct ?? Math.round(MARGEM_VOTOS_CASADOS * 100)
  const totalVinculos = mapeamento?.emparelhamentos.length ?? 0
  const nomeCidade = formatarCidade(municipio)

  const togglePar = (idA: string, idB: string) => {
    const chave = chaveParSemelhante(idA, idB)
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(chave)) next.delete(chave)
      else next.add(chave)
      return next
    })
  }

  const toggleGrupo = (grupo: GrupoVotoCasadoPorOrigem, marcar: boolean) => {
    setSelecionados((prev) => {
      const next = new Set(prev)
      for (const v of grupo.vinculos) {
        const chave = chaveParSemelhante(v.candidatoOrigem.id, v.candidatoDestino.id)
        if (marcar) next.add(chave)
        else next.delete(chave)
      }
      return next
    })
  }

  const toggleNivelAtivo = (marcar: boolean) => {
    if (!nivelAtivo) return
    setSelecionados((prev) => {
      const next = new Set(prev)
      for (const grupo of nivelAtivo.gruposPorOrigem) {
        for (const v of grupo.vinculos) {
          const chave = chaveParSemelhante(v.candidatoOrigem.id, v.candidatoDestino.id)
          if (marcar) next.add(chave)
          else next.delete(chave)
        }
      }
      return next
    })
  }

  const nivelTodoSelecionado = () => {
    if (!nivelAtivo) return false
    const todos = nivelAtivo.gruposPorOrigem.flatMap((g) => g.vinculos)
    return (
      todos.length > 0 &&
      todos.every((v) =>
        selecionados.has(chaveParSemelhante(v.candidatoOrigem.id, v.candidatoDestino.id)),
      )
    )
  }

  const aplicar = () => {
    const ids = new Set<string>()
    for (const chave of selecionados) {
      const [a, b] = chave.split('::')
      if (a) ids.add(a)
      if (b) ids.add(b)
    }
    onAplicar({
      candidatoIds: [...ids],
      paresChaves: new Set(selecionados),
      margem: MARGEM_VOTOS_CASADOS,
    })
    onFechar()
  }

  const qtdColunas = nivelAtivo?.gruposPorOrigem.length ?? 0

  return (
    <div
      className="fixed inset-0 z-[110] flex h-[100dvh] w-full flex-col overflow-hidden bg-surface"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-voto-casado-titulo"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-card px-3 py-2 sm:px-4">
        <GitBranch className="hidden h-4 w-4 shrink-0 text-accent-gold sm:block" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2
              id="modal-voto-casado-titulo"
              className="text-base font-semibold text-text-primary sm:text-lg"
            >
              Correlação de votos
            </h2>
            {nomeCidade ? (
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-card bg-background px-2 py-0.5 text-base font-semibold text-text-primary sm:text-lg"
                title={nomeCidade}
              >
                <MapPin className="h-4 w-4 shrink-0 text-accent-gold" aria-hidden />
                <span className="truncate">{nomeCidade}</span>
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-text-secondary sm:text-[13px]">
            Eleição {ano} · ≥{PCT_MINIMO_VOTO_CASADO_MODAL}% de seções correlacionadas · margem{' '}
            {margemPct}%
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <StatCompacto label="Vínculos" valor={totalVinculos} />
          <StatCompacto label="Sel." valor={selecionados.size} destaque />
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="shrink-0 rounded-lg p-2 text-text-secondary hover:bg-background"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {niveis.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-card bg-background/40 px-2 py-1.5 sm:px-3">
          {niveis.map((nivel, idx) => (
            <button
              key={`${nivel.cargoMaior}::${nivel.cargoMenor}`}
              type="button"
              onClick={() => setNivelAtivoIdx(idx)}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition',
                idx === nivelAtivoIdx
                  ? 'border border-accent-gold/50 bg-surface text-text-primary'
                  : 'text-text-secondary hover:bg-surface',
              )}
            >
              <span>{abreviarCargo(nivel.cargoMaior)}</span>
              <ArrowRight className="h-3 w-3 opacity-60" />
              <span>{abreviarCargo(nivel.cargoMenor)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!mapeamento && (
          <EstadoVazio
            titulo="Cargos insuficientes"
            texto="Selecione dois cargos consecutivos na hierarquia."
          />
        )}

        {mapeamento && niveis.length === 0 && (
          <EstadoVazio
            titulo="Nenhum vínculo"
            texto={`Sem relações ≥ ${PCT_MINIMO_VOTO_CASADO_MODAL}% entre cargos consecutivos.`}
          />
        )}

        {nivelAtivo && qtdColunas > 0 && (
          <>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-card/80 bg-background/30 px-3 py-2 sm:px-4">
              <div className="flex items-center gap-2">
                <CabecalhoParCargos
                  cargoMaior={nivelAtivo.cargoMaior}
                  cargoMenor={nivelAtivo.cargoMenor}
                />
                <span className="text-[11px] text-text-secondary">
                  {qtdColunas} coluna(s) · clique no vínculo para ver bairros e locais
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleNivelAtivo(!nivelTodoSelecionado())}
                  className="rounded-lg px-2 py-1 text-[11px] font-medium text-accent-gold hover:bg-accent-gold/10"
                >
                  {nivelTodoSelecionado() ? 'Desmarcar tudo' : 'Marcar tudo'}
                </button>
                <LegendaIntensidade />
              </div>
            </div>

            <OrganogramaVotoCasado
              nivel={nivelAtivo}
              linhas={linhas}
              margem={MARGEM_VOTOS_CASADOS}
              selecionados={selecionados}
              vinculoExpandido={vinculoExpandido}
              onVinculoExpandido={setVinculoExpandido}
              onToggleGrupo={toggleGrupo}
            />
          </>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-card px-3 py-2 sm:px-4">
        <p className="flex items-center gap-1.5 text-[11px] text-text-secondary sm:text-xs">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">
            Nível 1 = {nivelAtivo ? abreviarCargo(nivelAtivo.cargoMaior) : '—'} · Nível 2 ={' '}
            {nivelAtivo ? abreviarCargo(nivelAtivo.cargoMenor) : '—'} · clique no vínculo para
            ver bairros e locais
          </span>
          <span className="sm:hidden">Organograma · indício estatístico</span>
        </p>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-xs text-text-secondary sm:flex">
            <Link2 className="h-3.5 w-3.5 text-accent-gold" />
            {selecionados.size} vínculo(s)
          </span>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg border border-card px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-background"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={selecionados.size === 0}
            onClick={aplicar}
            className="rounded-lg bg-accent-gold px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent-gold-dark disabled:opacity-45"
          >
            Aplicar na matriz
          </button>
        </div>
      </footer>
    </div>
  )
}

function OrganogramaVotoCasado({
  nivel,
  linhas,
  margem,
  selecionados,
  vinculoExpandido,
  onVinculoExpandido,
  onToggleGrupo,
}: {
  nivel: {
    cargoMaior: string
    cargoMenor: string
    gruposPorOrigem: GrupoVotoCasadoPorOrigem[]
  }
  linhas: LinhaMatrizSecao[]
  margem: number
  selecionados: Set<string>
  vinculoExpandido: string | null
  onVinculoExpandido: (chave: string | null) => void
  onToggleGrupo: (grupo: GrupoVotoCasadoPorOrigem, marcar: boolean) => void
}) {
  const colunas = nivel.gruposPorOrigem.length

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background/50 p-2 sm:p-3">
      <div className="mb-2 flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-accent-gold/[0.08] px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-primary">
          {nivel.cargoMaior}
        </span>
        <ArrowDown className="h-3 w-3 text-accent-gold/70" aria-hidden />
      </div>

      {/* Colunas do organograma */}
      <div
        className="min-h-0 flex-1 overflow-auto"
        role="tree"
        aria-label={`Organograma ${nivel.cargoMaior} para ${nivel.cargoMenor}`}
      >
        <div
          className="grid h-full min-w-full gap-2 sm:gap-3"
          style={{
            gridTemplateColumns: `repeat(${colunas}, minmax(130px, 1fr))`,
            minHeight: '100%',
          }}
        >
          {nivel.gruposPorOrigem.map((grupo) => (
            <ColunaOrganograma
              key={grupo.origem.id}
              grupo={grupo}
              cargoMenor={nivel.cargoMenor}
              linhas={linhas}
              margem={margem}
              selecionados={selecionados}
              vinculoExpandido={vinculoExpandido}
              onVinculoExpandido={onVinculoExpandido}
              onToggleGrupo={onToggleGrupo}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-center border-t border-card pt-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-secondary/80">
          {nivel.cargoMenor}
        </span>
      </div>
    </div>
  )
}

function ColunaOrganograma({
  grupo,
  cargoMenor,
  linhas,
  margem,
  selecionados,
  vinculoExpandido,
  onVinculoExpandido,
  onToggleGrupo,
}: {
  grupo: GrupoVotoCasadoPorOrigem
  cargoMenor: string
  linhas: LinhaMatrizSecao[]
  margem: number
  selecionados: Set<string>
  vinculoExpandido: string | null
  onVinculoExpandido: (chave: string | null) => void
  onToggleGrupo: (grupo: GrupoVotoCasadoPorOrigem, marcar: boolean) => void
}) {
  const { origem, vinculos } = grupo
  const todosMarcados =
    vinculos.length > 0 &&
    vinculos.every((v) =>
      selecionados.has(chaveParSemelhante(v.candidatoOrigem.id, v.candidatoDestino.id)),
    )
  const algumMarcado = vinculos.some((v) =>
    selecionados.has(chaveParSemelhante(v.candidatoOrigem.id, v.candidatoDestino.id)),
  )

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      role="treeitem"
      aria-expanded="true"
      aria-label={`${formatarNome(origem.nmVotavel)}, ${vinculos.length} vínculos`}
    >
      <button
        type="button"
        onClick={() => onToggleGrupo(grupo, !todosMarcados)}
        className={cn(
          'w-full shrink-0 rounded-lg border bg-accent-gold/[0.08] px-2 py-2 text-left',
          todosMarcados
            ? 'border-accent-gold'
            : algumMarcado
              ? 'border-accent-gold/40'
              : 'border-card',
        )}
        aria-pressed={todosMarcados}
        title="Marcar ou desmarcar todos os vínculos desta coluna"
      >
        <span className="font-mono text-xs text-text-secondary">{origem.nrVotavel}</span>
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary">
          {formatarNome(origem.nmVotavel)}
        </p>
        <p className="text-[11px] text-text-secondary">
          {origem.totalVotos.toLocaleString('pt-BR')} votos · {vinculos.length}{' '}
          {abreviarCargo(cargoMenor)}
        </p>
      </button>

      {/* Conector tronco */}
      <div className="flex shrink-0 flex-col items-center py-0.5" aria-hidden>
        <div className="h-2.5 w-px bg-card" />
        {vinculos.length > 1 && (
          <div
            className="h-px bg-card"
            style={{ width: `min(100%, ${Math.max(32, vinculos.length * 24)}px)` }}
          />
        )}
      </div>

      {/* Filhos */}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-1">
        {vinculos.map((v) => {
          const chave = chaveParSemelhante(v.candidatoOrigem.id, v.candidatoDestino.id)
          return (
            <NoDestino
              key={chave}
              vinculo={v}
              linhas={linhas}
              margem={margem}
              expandido={vinculoExpandido === chave}
              onToggleExpand={() =>
                onVinculoExpandido(vinculoExpandido === chave ? null : chave)
              }
            />
          )
        })}
      </div>
    </div>
  )
}

function NoDestino({
  vinculo,
  linhas,
  margem,
  expandido,
  onToggleExpand,
}: {
  vinculo: EmparelhamentoVotoCasado
  linhas: LinhaMatrizSecao[]
  margem: number
  expandido: boolean
  onToggleExpand: () => void
}) {
  const { candidatoOrigem: orig, candidatoDestino: dest, analise } = vinculo
  const pct = Math.round(analise.pctSecoesParecidas)
  const margemPct = Math.round(margem * 100)

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expandido}
        className={cn(
          'w-full rounded-lg border bg-surface px-2 py-2 text-left hover:bg-background/50',
          expandido ? 'border-accent-gold/50' : 'border-card',
        )}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono text-[11px] text-text-secondary">{dest.nrVotavel}</span>
          <span className="tabular-nums text-sm font-semibold text-text-primary">{pct}%</span>
        </div>
        <p className="line-clamp-2 text-sm font-medium leading-snug text-text-primary">
          {formatarNome(dest.nmVotavel)}
        </p>
        <p className="text-[11px] text-text-secondary">
          {analise.secoesParecidas}/{analise.secoesTotal} seções
        </p>
      </button>

      {expandido && (
        <PainelDistribuicaoVinculo
          origem={orig}
          destino={dest}
          linhas={linhas}
          margem={margem}
          margemPct={margemPct}
        />
      )}
    </div>
  )
}

function PainelDistribuicaoVinculo({
  origem,
  destino,
  linhas,
  margem,
  margemPct,
}: {
  origem: CandidatoMatrizColuna
  destino: CandidatoMatrizColuna
  linhas: LinhaMatrizSecao[]
  margem: number
  margemPct: number
}) {
  const [bairroAberto, setBairroAberto] = useState<string | null>(null)

  const bairros = useMemo(
    () => distribuicaoVinculoPorBairro(linhas, origem, destino, margem),
    [linhas, origem, destino, margem],
  )

  if (bairros.length === 0) {
    return (
      <p className="mt-1 rounded-lg border border-dashed border-card bg-background/60 px-2 py-2 text-[11px] text-text-secondary">
        Nenhuma seção correlacionada neste par (margem {margemPct}%).
      </p>
    )
  }

  const totalSecoesParecidas = bairros.reduce((n, b) => n + b.secoesParecidas, 0)

  return (
    <div className="mt-1 rounded-lg border border-card bg-background/80 p-2">
      <p className="mb-2 text-[11px] leading-snug text-text-secondary">
        <span className="font-medium text-text-primary">
          {primeiroNome(origem.nmVotavel)}
        </span>
        {' × '}
        <span className="font-medium text-text-primary">{primeiroNome(destino.nmVotavel)}</span>
        {' — '}
        {totalSecoesParecidas} seção(ões) correlacionadas por bairro
      </p>
      <ul className="max-h-48 space-y-1.5 overflow-y-auto">
        {bairros.map((b) => (
          <ItemBairroDistribuicao
            key={b.id}
            bairro={b}
            aberto={bairroAberto === b.id}
            onToggle={() => setBairroAberto((atual) => (atual === b.id ? null : b.id))}
            rotuloOrigem={abreviarCargo(origem.dsCargo)}
            rotuloDestino={abreviarCargo(destino.dsCargo)}
          />
        ))}
      </ul>
    </div>
  )
}

function ItemBairroDistribuicao({
  bairro,
  aberto,
  onToggle,
  rotuloOrigem,
  rotuloDestino,
}: {
  bairro: BairroDistribuicaoVinculo
  aberto: boolean
  onToggle: () => void
  rotuloOrigem: string
  rotuloDestino: string
}) {
  const pctBarra = Math.min(100, Math.round(bairro.pctParecidasNoBairro))

  return (
    <li className="rounded-md border border-card/80 bg-surface">
      <button type="button" onClick={onToggle} className="w-full px-2 py-1.5 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] font-semibold text-text-primary">
            {bairro.nmBairro}
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-text-secondary">
            {bairro.secoesParecidas} seç.
          </span>
          <ChevronDown
            className={cn('h-3 w-3 shrink-0 text-text-secondary', aberto && 'rotate-180')}
          />
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-accent-gold/70"
            style={{ width: `${pctBarra}%` }}
          />
        </div>
      </button>

      {aberto && (
        <ul className="border-t border-card/60 px-2 py-1">
          {bairro.locais.map((loc) => (
            <li key={loc.id} className="border-b border-card/40 py-1 last:border-0">
              <p className="text-[10px] font-medium text-text-primary">{loc.rotulo}</p>
              <ul className="mt-0.5 space-y-0.5">
                {loc.secoes.map((s) => (
                  <li
                    key={`${s.nrZona}-${s.nrSecao}`}
                    className="flex flex-wrap justify-between gap-x-2 text-[10px] text-text-secondary"
                  >
                    <span>
                      Zona {s.nrZona} · Seção {s.nrSecao}
                    </span>
                    <span className="tabular-nums">
                      {rotuloOrigem} {s.votosOrigem} · {rotuloDestino} {s.votosDestino}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function LegendaIntensidade() {
  return (
    <div className="hidden items-center gap-2 text-[10px] text-text-secondary lg:flex">
      <span>%</span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-0.5 rounded-full bg-accent-gold/50" />
        50+
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-0.5 rounded-full bg-accent-gold" />
        60+
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-0.5 rounded-full bg-emerald-500" />
        70+
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-0.5 rounded-full bg-emerald-600" />
        85+
      </span>
    </div>
  )
}

function CabecalhoParCargos({
  cargoMaior,
  cargoMenor,
}: {
  cargoMaior: string
  cargoMenor: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold text-text-primary">{abreviarCargo(cargoMaior)}</span>
      <ArrowDown className="h-3 w-3 text-text-secondary/50" />
      <span className="text-[11px] font-medium text-text-secondary">{abreviarCargo(cargoMenor)}</span>
    </div>
  )
}

function StatCompacto({
  label,
  valor,
  destaque = false,
}: {
  label: string
  valor: number
  destaque?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-2 py-1 text-center',
        destaque ? 'border-accent-gold/40 bg-surface' : 'border-card bg-surface',
      )}
    >
      <p className="text-[9px] uppercase text-text-secondary">{label}</p>
      <p className="text-sm font-bold tabular-nums leading-none">{valor}</p>
    </div>
  )
}

function EstadoVazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <GitBranch className="mb-3 h-10 w-10 text-text-secondary/40" />
      <p className="font-medium text-text-primary">{titulo}</p>
      <p className="mt-1 text-sm text-text-secondary">{texto}</p>
    </div>
  )
}
