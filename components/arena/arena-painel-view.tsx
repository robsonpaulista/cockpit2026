'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArenaShell, ArenaSourcePill, formatPts, initials } from '@/components/arena/arena-shell'
import { ArenaBadgeGlyph, ArenaBreakdownRow } from '@/components/arena/arena-icons'
import { ArenaFiltroPeriodo } from '@/components/arena/arena-filtro-periodo'
import { ARENA_BADGES, SCORING_RULES } from '@/lib/arena/constants'
import { PONTOS } from '@/lib/arena/pontuacao'
import { mediaPontos } from '@/lib/arena/perfis-resumo'
import { useArenaPerfis, useArenaPeriodo } from '@/hooks/use-arena-perfis'

/** "Primeira curtida" depende da coleta de curtidas, que ainda não existe. */
const BADGES_ATIVAS = ARENA_BADGES.filter((b) => b.id !== 'primeira_curtida')

const FORMATO_DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function ArenaPainelView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const membroId = searchParams.get('membro')
  const filtro = useArenaPeriodo()
  const estado = useArenaPerfis(filtro.intervalo)

  const dados = useMemo(() => {
    if (estado.status !== 'ok' || estado.perfis.length === 0) return null
    const perfis = estado.perfis
    const perfil =
      perfis.find((p) => p.id === membroId) ??
      perfis.find((p) => p.papel === 'liderado') ??
      perfis[0]!
    const acima = perfil.posicao > 1 ? perfis[perfil.posicao - 2]! : null
    return {
      perfis,
      perfil,
      faltaParaSubir: acima ? Math.max(1, acima.pontos - perfil.pontos + 1) : 0,
      mediaNivel: mediaPontos(perfis.filter((p) => p.nivel.id === perfil.nivel.id)),
      mediaCidade: mediaPontos(perfis.filter((p) => p.cidade === perfil.cidade)),
    }
  }, [estado, membroId])

  function trocarPerfil(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('membro', id)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const p = dados?.perfil

  return (
    <ArenaShell role="apoiador" title="Painel do apoiador" subtitle="Pontuação, nível, conquistas e histórico">
      <ArenaFiltroPeriodo filtro={filtro} />

      {estado.status === 'loading' ? (
        <section className="arena-card">
          <p className="arena-sub m-0">Calculando a pontuação do período…</p>
        </section>
      ) : estado.status === 'erro' ? (
        <section className="arena-card">
          <p className="arena-sub m-0">{estado.mensagem}</p>
        </section>
      ) : !dados || !p ? (
        <section className="arena-card">
          <p className="arena-sub m-0">Nenhum perfil cadastrado ainda.</p>
        </section>
      ) : (
        <>
          <div className="arena-field max-w-md">
            <label htmlFor="arena-painel-perfil">Ver painel de</label>
            <select
              id="arena-painel-perfil"
              value={p.id}
              onChange={(e) => trocarPerfil(e.target.value)}
            >
              {dados.perfis.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome} · @{o.instagram}
                  {o.papel === 'lideranca' ? ' (liderança)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="arena-grid-2">
            <section className="arena-card arena-card--elevated">
              <div className="mb-4 flex items-center gap-3">
                <div className="arena-podium__avatar">{initials(p.nome)}</div>
                <div>
                  <h2 className="m-0 text-xl font-bold text-[var(--cx-ink,#14161a)]">{p.nome}</h2>
                  <p className="m-0 text-sm text-[var(--cx-muted,#686865)]">
                    @{p.instagram} · {p.papel === 'lideranca' ? 'Liderança' : 'Apoiador'}
                    {p.cidade ? ` · ${p.cidade}` : ''}
                  </p>
                </div>
              </div>
              <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--cx-label,#969692)]">
                Nível {p.nivel.id} — {p.nivel.name}
              </p>
              <p className="arena-mono mb-2 text-2xl font-bold text-[var(--cx-ink,#14161a)]">
                {formatPts(p.pontos)} pts
              </p>
              <div className="arena-progress mb-2">
                <span style={{ width: `${Math.round(p.progressoNivel * 100)}%` }} />
              </div>
              <p className="arena-sub mb-3">
                {p.proximoNivel
                  ? `${formatPts(p.proximoNivel.minPoints - p.pontos)} pts para ${p.proximoNivel.name}`
                  : 'Nível máximo alcançado'}
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-[var(--cx-muted,#686865)]">Ranking </span>
                  <strong className="arena-mono">
                    {p.pontos > 0 ? `${p.posicao}º de ${dados.perfis.length}` : '—'}
                  </strong>
                </div>
                <div>
                  <span className="text-[var(--cx-muted,#686865)]">Sequência </span>
                  <strong className="arena-mono">
                    {p.sequenciaDias} {p.sequenciaDias === 1 ? 'dia' : 'dias'}
                  </strong>
                </div>
                <div>
                  <span className="text-[var(--cx-muted,#686865)]">Último comentário </span>
                  <strong className="arena-mono">
                    {p.ultimoComentario ? FORMATO_DATA_HORA.format(new Date(p.ultimoComentario)) : '—'}
                  </strong>
                </div>
              </div>
            </section>

            <section className="arena-card">
              <h2 className="arena-section-title">De onde vieram seus pontos</h2>
              <ul className="arena-breakdown">
                <ArenaBreakdownRow
                  kind="comentario"
                  subtitle={`${formatPts(p.comentariosPontuados)} de ${formatPts(p.comentarios)} comentários pontuados (até ${PONTOS.limitePorPost} por post)`}
                  trailing={<strong className="arena-mono">{formatPts(p.pontosComentario)}</strong>}
                />
                <ArenaBreakdownRow
                  kind="cedo"
                  label="Bônus comentar cedo"
                  subtitle={`${formatPts(p.comentariosCedo)} na 1ª hora do post`}
                  trailing={<strong className="arena-mono">{formatPts(p.bonusCedo)}</strong>}
                />
                <ArenaBreakdownRow
                  kind="curtida"
                  subtitle="Coleta de curtidas ainda não ativa"
                  trailing={<strong className="arena-mono">{formatPts(p.pontosCurtida)}</strong>}
                />
                <ArenaBreakdownRow
                  kind="fidelidade"
                  label="Bônus fidelidade"
                  subtitle="+15% se comentar em ≥70% dos posts"
                  trailing={<strong className="arena-mono">{formatPts(p.bonusFidelidade)}</strong>}
                />
              </ul>
              <p className="arena-sub mt-4">
                Comentou em {p.postsComentados} de {p.postsNoPeriodo} posts do período (
                {Math.round(p.taxaEngajamento * 100)}%)
              </p>
              <div className="arena-progress mt-2" title="Progresso até 70% de fidelidade">
                <span
                  style={{
                    width: `${Math.min(100, Math.round((p.taxaEngajamento / PONTOS.fidelidadeTaxa) * 100))}%`,
                  }}
                />
              </div>
            </section>
          </div>

          <section className="arena-card">
            <h2 className="arena-section-title">Comparação</h2>
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <span className="text-[var(--cx-muted,#686865)]">Para subir uma posição </span>
                <strong className="arena-mono">
                  {dados.faltaParaSubir > 0 ? `${formatPts(dados.faltaParaSubir)} pts` : 'Já é o 1º'}
                </strong>
              </div>
              <div>
                <span className="text-[var(--cx-muted,#686865)]">Média do nível {p.nivel.name} </span>
                <strong className="arena-mono">{formatPts(dados.mediaNivel)} pts</strong>
              </div>
              <div>
                <span className="text-[var(--cx-muted,#686865)]">
                  Média em {p.cidade ?? 'sua cidade'}{' '}
                </span>
                <strong className="arena-mono">{formatPts(dados.mediaCidade)} pts</strong>
              </div>
            </div>
          </section>

          <section className="arena-card">
            <h2 className="arena-section-title">Conquistas</h2>
            <div className="arena-badges">
              {BADGES_ATIVAS.map((b) => {
                const unlocked = p.conquistas.includes(b.id)
                return (
                  <article
                    key={b.id}
                    className={`arena-badge${unlocked ? '' : ' arena-badge--locked'}`}
                  >
                    <div className="arena-badge__icon">
                      <ArenaBadgeGlyph unlocked={unlocked} />
                    </div>
                    <p className="arena-badge__label">{b.label}</p>
                    <p className="arena-badge__desc">{b.description}</p>
                  </article>
                )
              })}
            </div>
          </section>
        </>
      )}

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
    </ArenaShell>
  )
}
