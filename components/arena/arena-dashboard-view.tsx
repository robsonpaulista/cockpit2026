'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArenaShell, ArenaSourcePill, formatPts } from '@/components/arena/arena-shell'
import { ArenaBreakdownRow } from '@/components/arena/arena-icons'
import { ArenaPodium, type ArenaPodiumItem } from '@/components/arena/arena-podium'
import { ArenaCommentsSyncPanel } from '@/components/arena/arena-comments-sync-panel'
import { ArenaFiltroPeriodo } from '@/components/arena/arena-filtro-periodo'
import { SCORING_RULES } from '@/lib/arena/constants'
import { ENGAJA_LEADERS } from '@/lib/arena/engaja-leaders'
import {
  resumoPorNivel,
  resumoPorRegiao,
  somaComentarios,
  somaPontos,
  type GrupoResumo,
} from '@/lib/arena/perfis-resumo'
import { hrefPainelArena, useArenaPerfis, useArenaPeriodo } from '@/hooks/use-arena-perfis'

const LIDERADOS_POR_HANDLE = new Map(
  ENGAJA_LEADERS.map((l) => [l.instagram.toLowerCase(), l.lideradosCount]),
)

function ListaResumo({
  grupos,
  medida,
  rotulo,
}: {
  grupos: GrupoResumo[]
  medida: 'perfis' | 'pontos'
  rotulo: (g: GrupoResumo) => string
}) {
  const maior = Math.max(1, ...grupos.map((g) => g[medida]))
  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {grupos.map((g) => (
        <li key={g.chave}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold">{g.chave}</span>
            <span className="arena-mono text-xs text-[var(--cx-muted,#686865)]">{rotulo(g)}</span>
          </div>
          <div className="arena-progress">
            <span style={{ width: `${Math.round((g[medida] / maior) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ArenaDashboardView() {
  const filtro = useArenaPeriodo()
  const estado = useArenaPerfis(filtro.intervalo)

  const dados = useMemo(() => {
    if (estado.status !== 'ok') return null
    const liderados = estado.perfis.filter((p) => p.papel === 'liderado')
    const liderancas = estado.perfis.filter((p) => p.papel === 'lideranca')
    const podio: ArenaPodiumItem[] = liderancas
      .filter((l) => l.pontos > 0)
      .map((l) => {
        const indicados = LIDERADOS_POR_HANDLE.get(l.instagram)
        return {
          id: l.id,
          nome: l.nome,
          cidade: l.cidade,
          detalhe: indicados != null ? `${indicados} liderados` : l.nivel.name,
          valor: `${formatPts(l.pontos)} pts`,
          href: hrefPainelArena(l.id, filtro),
        }
      })
    return {
      liderados,
      lideradosAtivos: liderados.filter((p) => p.pontos > 0),
      liderancasAtivas: liderancas.filter((p) => p.pontos > 0).length,
      totalLiderancas: liderancas.length,
      fieis: estado.perfis.filter((p) => p.conquistas.includes('fiel')).length,
      podio,
      pontosTotal: somaPontos(estado.perfis),
      comentariosTotal: somaComentarios(estado.perfis),
      niveis: resumoPorNivel(liderados),
      regioes: resumoPorRegiao(estado.perfis),
    }
  }, [estado, filtro])

  return (
    <ArenaShell role="admin" title="Dashboard" subtitle="Ranking e engajamento da Arena de Apoiadores">
      <ArenaFiltroPeriodo filtro={filtro} />

      {estado.status === 'loading' ? (
        <section className="arena-card">
          <p className="arena-sub m-0">Calculando a pontuação do período…</p>
        </section>
      ) : estado.status === 'erro' ? (
        <section className="arena-card">
          <p className="arena-sub m-0">{estado.mensagem}</p>
        </section>
      ) : dados ? (
        <>
          <section className="arena-tiles" aria-label="Números do período">
            <article className="arena-card">
              <span className="arena-tile__label">Apoiadores ativos</span>
              <strong className="arena-tile__val">
                {dados.lideradosAtivos.length}
                <span className="arena-sub"> de {dados.liderados.length}</span>
              </strong>
            </article>
            <article className="arena-card">
              <span className="arena-tile__label">Lideranças ativas</span>
              <strong className="arena-tile__val">
                {dados.liderancasAtivas}
                <span className="arena-sub"> de {dados.totalLiderancas}</span>
              </strong>
            </article>
            <article className="arena-card">
              <span className="arena-tile__label">Pontos no período</span>
              <strong className="arena-tile__val">{formatPts(dados.pontosTotal)}</strong>
            </article>
            <article className="arena-card">
              <span className="arena-tile__label">Comentários</span>
              <strong className="arena-tile__val">{formatPts(dados.comentariosTotal)}</strong>
            </article>
          </section>

          <div className="arena-grid-2">
            <section className="arena-card">
              <h2 className="arena-section-title">Apoiadores por nível</h2>
              <ListaResumo
                grupos={dados.niveis}
                medida="perfis"
                rotulo={(g) =>
                  `${g.perfis} ${g.perfis === 1 ? 'apoiador' : 'apoiadores'} · ${Math.round((g.perfis / Math.max(1, dados.liderados.length)) * 100)}%`
                }
              />
            </section>
            <section className="arena-card">
              <h2 className="arena-section-title">Pontos por região</h2>
              <ListaResumo
                grupos={dados.regioes}
                medida="pontos"
                rotulo={(g) => `${formatPts(g.pontos)} pts · ${g.ativos} de ${g.perfis} ativos`}
              />
            </section>
          </div>

          <section className="arena-card">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="arena-section-title mb-0">Ranking de apoiadores</h2>
              <p className="arena-sub m-0">
                {dados.liderados.length - dados.lideradosAtivos.length} sem pontos no período ·{' '}
                {dados.fieis} fiéis
              </p>
            </div>
            <div className="arena-table-wrap">
              <table className="arena-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nome</th>
                    <th>@</th>
                    <th>Cidade</th>
                    <th>Nível</th>
                    <th>Comentários</th>
                    <th>Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.lideradosAtivos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-[var(--cx-muted,#686865)]">
                        Nenhum apoiador pontuou neste período.
                      </td>
                    </tr>
                  ) : null}
                  {dados.lideradosAtivos.map((p, i) => (
                    <tr key={p.id}>
                      <td className="arena-mono">{i + 1}</td>
                      <td>
                        <Link
                          href={hrefPainelArena(p.id, filtro)}
                          className="font-semibold text-[var(--cx-ink,#14161a)] no-underline hover:text-[var(--cx-amber,#e8a825)]"
                        >
                          {p.nome}
                        </Link>
                      </td>
                      <td className="text-[var(--arena-text-muted)]">@{p.instagram}</td>
                      <td>{p.cidade ?? '—'}</td>
                      <td>
                        {p.nivel.id} — {p.nivel.name}
                      </td>
                      <td className="arena-mono">{formatPts(p.comentarios)}</td>
                      <td className="arena-mono font-bold">{formatPts(p.pontos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="arena-card">
            <h2 className="arena-section-title">Lideranças com mais pontos</h2>
            {dados.podio.length > 0 ? (
              <ArenaPodium ranking={dados.podio} />
            ) : (
              <p className="arena-sub m-0">Nenhuma liderança pontuou neste período.</p>
            )}
          </section>
        </>
      ) : null}

      <ArenaCommentsSyncPanel />

      <div className="arena-grid-2">
        <section className="arena-card">
          <h2 className="arena-section-title">De onde vêm os pontos</h2>
          <ul className="arena-breakdown">
            <ArenaBreakdownRow
              kind="comentario"
              subtitle="Graph API · match por @"
              source="api_oficial"
            />
            <ArenaBreakdownRow
              kind="cedo"
              subtitle="Até 1h após o post"
              source="interno"
            />
            <ArenaBreakdownRow
              kind="curtida"
              subtitle="Coleta de curtidas ainda não ativa"
              source="scraper"
            />
            <ArenaBreakdownRow
              kind="fidelidade"
              subtitle="≥70% dos posts do período"
              source="interno"
            />
          </ul>
        </section>

        <section className="arena-card">
          <h2 className="arena-section-title">Tabela de pontuação</h2>
          <div className="arena-table-wrap">
            <table className="arena-table">
              <thead>
                <tr>
                  <th>Ação</th>
                  <th>Pontos</th>
                  <th>Fonte</th>
                </tr>
              </thead>
              <tbody>
                {SCORING_RULES.map((r) => (
                  <tr key={r.id}>
                    <td>{r.action}</td>
                    <td className="arena-mono">{r.points}</td>
                    <td>
                      <ArenaSourcePill kind={r.sourceKind} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ArenaShell>
  )
}
