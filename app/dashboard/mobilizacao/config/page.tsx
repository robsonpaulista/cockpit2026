'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  getTodosMunicipiosPIOficiaisOrdenados,
  resolverNomeMunicipioPIOficial,
} from '@/lib/piaui-territorio-desenvolvimento'

type Coordinator = {
  id: string
  nome: string
  regiao: string | null
  created_at: string
}

type Leader = {
  id: string
  nome: string
  telefone: string | null
  cidade: string | null
  municipio: string | null
  coordinator_id: string | null
  created_at: string
  coordinators?: { id: string; nome: string } | { id: string; nome: string }[] | null
}

type Liderado = {
  id: string
  nome: string
  whatsapp: string
  instagram: string | null
  cidade: string | null
  origem: string
  status: string
  created_at: string
  leader_id: string
  leaders?: { id: string; nome: string } | { id: string; nome: string }[] | null
}

function leaderNomeFromLiderado(row: Liderado): string {
  const l = row.leaders
  if (!l) return '—'
  if (Array.isArray(l)) return l[0]?.nome ?? '—'
  return l.nome
}

type ArvoreCoordBlock = {
  coordinator: Coordinator
  leaders: { leader: Leader; liderados: Liderado[] }[]
}

/** React ainda não tipa `defaultOpen` em `<details>` em algumas versões de @types/react. */
const detailsAbertoPorPadrao = { defaultOpen: true } as { defaultOpen?: boolean }

function formatWhatsappDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 13)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export default function MobilizacaoConfigPage() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [coordinators, setCoordinators] = useState<Coordinator[]>([])
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [liderados, setLiderados] = useState<Liderado[]>([])

  const [coordNome, setCoordNome] = useState('')
  const [coordRegiao, setCoordRegiao] = useState('')
  const [criandoCoord, setCriandoCoord] = useState(false)

  const [leaderNome, setLeaderNome] = useState('')
  const [leaderTelefone, setLeaderTelefone] = useState('')
  const [leaderMunicipio, setLeaderMunicipio] = useState('')
  const [leaderCoordinatorId, setLeaderCoordinatorId] = useState('')
  const [criandoLeader, setCriandoLeader] = useState(false)

  const [lideradoNome, setLideradoNome] = useState('')
  const [lideradoWhatsapp, setLideradoWhatsapp] = useState('')
  const [lideradoInstagram, setLideradoInstagram] = useState('')
  const [lideradoLeaderId, setLideradoLeaderId] = useState('')
  const [lideradoCidade, setLideradoCidade] = useState('')
  const [criandoLiderado, setCriandoLiderado] = useState(false)

  const [mensagem, setMensagem] = useState<string | null>(null)

  /** Origin público do formulário de captação (ex.: domínio curto). Sem trailing slash. */
  const baseCaptacaoUrl = useMemo(() => {
    const fromEnv = process.env.NEXT_PUBLIC_MOBILIZACAO_CAPTACAO_ORIGIN?.trim()
    if (fromEnv) {
      return `${fromEnv.replace(/\/$/, '')}/mobilizacao/detalhe`
    }
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/mobilizacao/detalhe`
  }, [])

  const municipiosPILista = useMemo(() => [...getTodosMunicipiosPIOficiaisOrdenados()], [])

  const carregarDados = async () => {
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch('/api/mobilizacao/config')
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
        coordinators?: Coordinator[]
        leaders?: Leader[]
        liderados?: Liderado[]
      }
      if (!res.ok) {
        setErro(payload.error ?? 'Não foi possível carregar a configuração de mobilização.')
        return
      }
      setCoordinators(payload.coordinators ?? [])
      setLeaders(payload.leaders ?? [])
      setLiderados(payload.liderados ?? [])
      if (!leaderCoordinatorId && (payload.coordinators ?? []).length > 0) {
        setLeaderCoordinatorId(payload.coordinators?.[0]?.id ?? '')
      }
      if (!lideradoLeaderId && (payload.leaders ?? []).length > 0) {
        setLideradoLeaderId(payload.leaders?.[0]?.id ?? '')
      }
    } catch {
      setErro('Falha de conexão ao carregar os dados.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateCoordinator = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMensagem(null)
    if (coordNome.trim().length < 2) {
      setErro('Informe o nome do coordenador.')
      return
    }
    if (!coordRegiao.trim()) {
      setErro('Selecione o Território de Desenvolvimento (Região).')
      return
    }
    setErro(null)
    setCriandoCoord(true)
    try {
      const res = await fetch('/api/mobilizacao/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'coordinator',
          nome: coordNome.trim(),
          regiao: coordRegiao.trim(),
        }),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setErro(payload.error ?? 'Não foi possível criar o coordenador.')
        return
      }
      setCoordNome('')
      setCoordRegiao('')
      setMensagem('Coordenador criado com sucesso.')
      await carregarDados()
    } catch {
      setErro('Falha de conexão ao criar coordenador.')
    } finally {
      setCriandoCoord(false)
    }
  }

  const handleCreateLeader = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMensagem(null)
    if (leaderNome.trim().length < 2) {
      setErro('Informe o nome da liderança.')
      return
    }
    if (!leaderCoordinatorId) {
      setErro('Selecione um coordenador para a liderança.')
      return
    }
    if (!resolverNomeMunicipioPIOficial(leaderMunicipio)) {
      setErro('Selecione um município válido do Piauí na lista (224 municípios / Mapa TDs).')
      return
    }
    setErro(null)
    setCriandoLeader(true)
    try {
      const res = await fetch('/api/mobilizacao/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'leader',
          nome: leaderNome.trim(),
          telefone: leaderTelefone.trim() || null,
          municipio: leaderMunicipio.trim(),
          coordinator_id: leaderCoordinatorId,
        }),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setErro(payload.error ?? 'Não foi possível criar a liderança.')
        return
      }
      setLeaderNome('')
      setLeaderTelefone('')
      setLeaderMunicipio('')
      setMensagem('Liderança criada com sucesso.')
      await carregarDados()
    } catch {
      setErro('Falha de conexão ao criar liderança.')
    } finally {
      setCriandoLeader(false)
    }
  }

  const handleCreateLiderado = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMensagem(null)
    if (lideradoNome.trim().length < 2) {
      setErro('Informe o nome do liderado.')
      return
    }
    const wa = lideradoWhatsapp.replace(/\D/g, '')
    if (wa.length < 10) {
      setErro('Informe um WhatsApp válido com DDD.')
      return
    }
    if (!lideradoLeaderId) {
      setErro('Selecione a liderança responsável por este cadastro.')
      return
    }
    setErro(null)
    setCriandoLiderado(true)
    try {
      const res = await fetch('/api/mobilizacao/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'liderado',
          nome: lideradoNome.trim(),
          whatsapp: wa,
          instagram: lideradoInstagram.trim() || null,
          leader_id: lideradoLeaderId,
          cidade: lideradoCidade.trim() || null,
        }),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setErro(payload.error ?? 'Não foi possível cadastrar o liderado.')
        return
      }
      setLideradoNome('')
      setLideradoWhatsapp('')
      setLideradoInstagram('')
      setLideradoCidade('')
      setMensagem('Liderado cadastrado com sucesso (origem: manual).')
      await carregarDados()
    } catch {
      setErro('Falha de conexão ao cadastrar liderado.')
    } finally {
      setCriandoLiderado(false)
    }
  }

  const copyLink = async (leaderId: string) => {
    if (!baseCaptacaoUrl) return
    const link = `${baseCaptacaoUrl}?leader_id=${leaderId}`
    try {
      await navigator.clipboard.writeText(link)
      setMensagem('Link de captação copiado para a área de transferência.')
      setErro(null)
    } catch {
      setErro('Não foi possível copiar automaticamente. Copie o link manualmente.')
      setMensagem(link)
    }
  }

  const arvorePorCoordenador = useMemo(() => {
    const leadersByCoord = new Map<string, Leader[]>()
    for (const c of coordinators) {
      leadersByCoord.set(c.id, [])
    }
    const orphanLeaders: Leader[] = []
    for (const L of leaders) {
      const cid = L.coordinator_id
      if (cid && leadersByCoord.has(cid)) {
        leadersByCoord.get(cid)!.push(L)
      } else {
        orphanLeaders.push(L)
      }
    }
    const lidByLeader = new Map<string, Liderado[]>()
    for (const L of leaders) {
      lidByLeader.set(L.id, [])
    }
    for (const r of liderados) {
      if (!lidByLeader.has(r.leader_id)) {
        lidByLeader.set(r.leader_id, [])
      }
      lidByLeader.get(r.leader_id)!.push(r)
    }
    const sortNome = (a: { nome: string }, b: { nome: string }) =>
      a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
    const sortLideradoData = (a: Liderado, b: Liderado) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

    const blocos: ArvoreCoordBlock[] = [...coordinators]
      .sort(sortNome)
      .map((coordinator) => ({
        coordinator,
        leaders: (leadersByCoord.get(coordinator.id) ?? [])
          .sort(sortNome)
          .map((leader) => ({
            leader,
            liderados: [...(lidByLeader.get(leader.id) ?? [])].sort(sortLideradoData),
          })),
      }))

    return { blocos, orphanLeaders, lidByLeader }
  }, [coordinators, leaders, liderados])

  const lideradosSemLiderNoCarregamento = useMemo(() => {
    const ids = new Set(leaders.map((l) => l.id))
    return liderados.filter((r) => !ids.has(r.leader_id))
  }, [liderados, leaders])

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-text-primary">Mobilização · Config</h1>
        <p className="text-sm text-text-secondary">
          Cadastre coordenadores, lideranças, liderados (manual ou base) e gere links da página pública de captação.
        </p>
      </header>

      {erro ? (
        <p className="rounded-lg border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {erro}
        </p>
      ) : null}
      {mensagem ? (
        <p className="rounded-lg border border-status-success/40 bg-status-success/10 px-3 py-2 text-sm text-status-success">
          {mensagem}
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={handleCreateCoordinator} className="rounded-xl border border-card bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Novo coordenador</h2>
          <div className="space-y-3">
            <input
              value={coordNome}
              onChange={(e) => setCoordNome(e.target.value)}
              placeholder="Nome do coordenador"
              className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            />
            <select
              value={coordRegiao}
              onChange={(e) => setCoordRegiao(e.target.value)}
              className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            >
              <option value="">Território de Desenvolvimento (Região)</option>
              {TERRITORIOS_DESENVOLVIMENTO_PI.map((td) => (
                <option key={td} value={td}>
                  {td}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={criandoCoord}
              className="rounded-lg bg-accent-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {criandoCoord ? 'Salvando...' : 'Cadastrar coordenador'}
            </button>
          </div>
        </form>

        <form onSubmit={handleCreateLeader} className="rounded-xl border border-card bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Nova liderança</h2>
          <div className="space-y-3">
            <input
              value={leaderNome}
              onChange={(e) => setLeaderNome(e.target.value)}
              placeholder="Nome da liderança"
              className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            />
            <input
              value={leaderTelefone}
              onChange={(e) => setLeaderTelefone(e.target.value)}
              placeholder="Telefone (opcional)"
              className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            />
            <div className="space-y-1">
              <input
                list="municipios-pi-leader-form"
                value={leaderMunicipio}
                onChange={(e) => setLeaderMunicipio(e.target.value)}
                placeholder="Município (Piauí — busque na lista)"
                autoComplete="off"
                className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              />
              <datalist id="municipios-pi-leader-form">
                {municipiosPILista.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <p className="text-xs text-text-muted">
                {municipiosPILista.length} municípios oficiais (base Mapa TDs). O valor precisa coincidir com um item da
                lista.
              </p>
            </div>
            <select
              value={leaderCoordinatorId}
              onChange={(e) => setLeaderCoordinatorId(e.target.value)}
              className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            >
              <option value="">Selecione o coordenador</option>
              {coordinators.map((coordinator) => (
                <option key={coordinator.id} value={coordinator.id}>
                  {coordinator.nome}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={criandoLeader}
              className="rounded-lg bg-accent-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {criandoLeader ? 'Salvando...' : 'Cadastrar liderança'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-card bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Novo liderado (cadastro manual)
        </h2>
        <p className="mb-3 text-xs text-text-muted">
          Use quando alguém da base cadastrar presencialmente ou quando precisar lançar o dado fora do link público.
          O <span className="font-medium text-text-secondary">coordenador</span> continua sendo resolvido automaticamente
          pela liderança selecionada.
        </p>
        <form onSubmit={handleCreateLiderado} className="grid gap-3 sm:grid-cols-2">
          <input
            value={lideradoNome}
            onChange={(e) => setLideradoNome(e.target.value)}
            placeholder="Nome do liderado"
            className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft sm:col-span-2"
          />
          <input
            value={lideradoWhatsapp}
            onChange={(e) => setLideradoWhatsapp(formatWhatsappDigits(e.target.value))}
            placeholder="WhatsApp"
            className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
          />
          <input
            value={lideradoInstagram}
            onChange={(e) => setLideradoInstagram(e.target.value)}
            placeholder="Instagram (opcional)"
            className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
          />
          <select
            value={lideradoLeaderId}
            onChange={(e) => setLideradoLeaderId(e.target.value)}
            className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft sm:col-span-2"
          >
            <option value="">Liderança responsável</option>
            {leaders.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.nome}
              </option>
            ))}
          </select>
          <input
            value={lideradoCidade}
            onChange={(e) => setLideradoCidade(e.target.value)}
            placeholder="Cidade (opcional — sobrescreve a cidade do líder no registro)"
            className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft sm:col-span-2"
          />
          <button
            type="submit"
            disabled={criandoLiderado}
            className="rounded-lg bg-accent-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-70 sm:col-span-2"
          >
            {criandoLiderado ? 'Salvando...' : 'Cadastrar liderado'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-card bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Estrutura: coordenador → lideranças → liderados
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          Liderados listados são os recentes carregados nesta tela (até 80), agrupados pela liderança.
        </p>
        {carregando ? (
          <p className="text-sm text-text-secondary">Carregando estrutura...</p>
        ) : coordinators.length === 0 && leaders.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhum coordenador nem liderança cadastrados.</p>
        ) : (
          <div className="space-y-4">
            {arvorePorCoordenador.blocos.map(({ coordinator, leaders: leadersNo }) => (
              <details
                key={coordinator.id}
                className="group overflow-hidden rounded-lg border border-card bg-background/40 open:shadow-sm"
                {...detailsAbertoPorPadrao}
              >
                <summary className="flex cursor-pointer list-none items-start gap-2 bg-card/30 px-3 py-2 marker:hidden [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden
                    className="mt-0.5 inline-block shrink-0 select-none text-[10px] text-text-muted transition-transform duration-200 group-open:rotate-90"
                  >
                    ▸
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text-primary">{coordinator.nome}</p>
                    <p className="text-xs text-text-secondary">
                      TD / região: {coordinator.regiao ?? '—'} · {leadersNo.length} liderança
                      {leadersNo.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </summary>
                <div className="space-y-0 border-t border-card/60 divide-y divide-card/60">
                  {leadersNo.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-text-muted">Nenhuma liderança nesta coordenação.</p>
                  ) : (
                    leadersNo.map(({ leader, liderados: lideradosDo }) => {
                      const link = baseCaptacaoUrl ? `${baseCaptacaoUrl}?leader_id=${leader.id}` : ''
                      return (
                        <details
                          key={leader.id}
                          className="group border-l-2 border-accent-gold/50 open:bg-surface/50"
                          {...detailsAbertoPorPadrao}
                        >
                          <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2 marker:hidden [&::-webkit-details-marker]:hidden">
                            <span
                              aria-hidden
                              className="mt-0.5 inline-block shrink-0 select-none text-[10px] text-text-muted transition-transform duration-200 group-open:rotate-90"
                            >
                              ▸
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-text-primary">{leader.nome}</p>
                              <p className="text-xs text-text-secondary">
                                {leader.municipio || leader.cidade
                                  ? `${leader.municipio ?? leader.cidade}`
                                  : 'Município não informado'}
                                {leader.telefone ? ` · ${leader.telefone}` : ''}
                              </p>
                            </div>
                          </summary>
                          <div className="space-y-2 border-t border-card/40 px-3 pb-3 pl-9 pt-2">
                            {link ? (
                              <p className="break-all text-[11px] text-text-muted">{link}</p>
                            ) : null}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                void copyLink(leader.id)
                              }}
                              className="rounded-md border border-card px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-card/40"
                            >
                              Copiar link
                            </button>
                            <details
                              className="group rounded-md border border-card/70 bg-background/30 open:bg-background/50"
                              {...detailsAbertoPorPadrao}
                            >
                              <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 text-xs marker:hidden [&::-webkit-details-marker]:hidden">
                                <span
                                  aria-hidden
                                  className="inline-block shrink-0 select-none text-[10px] text-text-muted transition-transform duration-200 group-open:rotate-90"
                                >
                                  ▸
                                </span>
                                <span className="font-medium text-text-secondary">
                                  Liderados recentes ({lideradosDo.length})
                                </span>
                              </summary>
                              <div className="border-t border-card/50 px-2 pb-2 pt-1">
                                {lideradosDo.length === 0 ? (
                                  <p className="text-xs text-text-muted">Nenhum nesta lista.</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {lideradosDo.map((row) => (
                                      <li
                                        key={row.id}
                                        className="list-none border-b border-card/20 py-1.5 text-xs last:border-b-0"
                                      >
                                        <span className="font-medium text-text-primary">{row.nome}</span>
                                        <span className="text-text-secondary">
                                          {' '}
                                          · {row.whatsapp}
                                          {row.instagram ? ` · @${row.instagram}` : ''}
                                          {row.cidade ? ` · ${row.cidade}` : ''}
                                        </span>
                                        <span className="block text-text-muted">
                                          {row.origem} · {new Date(row.created_at).toLocaleString('pt-BR')}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </details>
                          </div>
                        </details>
                      )
                    })
                  )}
                </div>
              </details>
            ))}

            {arvorePorCoordenador.orphanLeaders.length > 0 ? (
              <details
                className="group overflow-hidden rounded-lg border border-dashed border-status-danger/40 bg-background/40 open:shadow-sm"
                {...detailsAbertoPorPadrao}
              >
                <summary className="flex cursor-pointer list-none items-start gap-2 bg-status-danger/10 px-3 py-2 marker:hidden [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden
                    className="mt-0.5 inline-block shrink-0 select-none text-[10px] text-text-muted transition-transform duration-200 group-open:rotate-90"
                  >
                    ▸
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary">Lideranças sem coordenador vinculado</p>
                    <p className="text-xs text-text-secondary">
                      Associe um coordenador ou corrija o cadastro · {arvorePorCoordenador.orphanLeaders.length}{' '}
                      liderança
                      {arvorePorCoordenador.orphanLeaders.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </summary>
                <div className="space-y-0 border-t border-card/60 divide-y divide-card/60">
                  {arvorePorCoordenador.orphanLeaders
                    .slice()
                    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
                    .map((leader) => {
                      const lid = arvorePorCoordenador.lidByLeader.get(leader.id) ?? []
                      const link = baseCaptacaoUrl ? `${baseCaptacaoUrl}?leader_id=${leader.id}` : ''
                      return (
                        <details
                          key={leader.id}
                          className="group border-l-2 border-status-danger/40 open:bg-surface/50"
                          {...detailsAbertoPorPadrao}
                        >
                          <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2 marker:hidden [&::-webkit-details-marker]:hidden">
                            <span
                              aria-hidden
                              className="mt-0.5 inline-block shrink-0 select-none text-[10px] text-text-muted transition-transform duration-200 group-open:rotate-90"
                            >
                              ▸
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-text-primary">{leader.nome}</p>
                              <p className="text-xs text-text-secondary">
                                {leader.municipio || leader.cidade
                                  ? `${leader.municipio ?? leader.cidade}`
                                  : 'Município não informado'}
                              </p>
                            </div>
                          </summary>
                          <div className="space-y-2 border-t border-card/40 px-3 pb-3 pl-9 pt-2">
                            {link ? (
                              <p className="break-all text-[11px] text-text-muted">{link}</p>
                            ) : null}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                void copyLink(leader.id)
                              }}
                              className="rounded-md border border-card px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-card/40"
                            >
                              Copiar link
                            </button>
                            {lid.length > 0 ? (
                              <details
                                className="group rounded-md border border-card/70 bg-background/30 open:bg-background/50"
                                {...detailsAbertoPorPadrao}
                              >
                                <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 text-xs marker:hidden [&::-webkit-details-marker]:hidden">
                                  <span
                                    aria-hidden
                                    className="inline-block shrink-0 select-none text-[10px] text-text-muted transition-transform duration-200 group-open:rotate-90"
                                  >
                                    ▸
                                  </span>
                                  <span className="font-medium text-text-secondary">
                                    Liderados recentes ({lid.length})
                                  </span>
                                </summary>
                                <div className="border-t border-card/50 px-2 pb-2 pt-1">
                                  <ul className="space-y-1">
                                    {lid.map((row) => (
                                      <li
                                        key={row.id}
                                        className="list-none border-b border-card/20 py-1.5 text-xs last:border-b-0"
                                      >
                                        <span className="font-medium text-text-primary">{row.nome}</span>
                                        <span className="text-text-secondary">
                                          {' '}
                                          · {row.whatsapp}
                                          {row.instagram ? ` · @${row.instagram}` : ''}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </details>
                            ) : null}
                          </div>
                        </details>
                      )
                    })}
                </div>
              </details>
            ) : null}

            {lideradosSemLiderNoCarregamento.length > 0 ? (
              <details
                className="group rounded-lg border border-card/70 bg-background/30 open:bg-background/40"
                {...detailsAbertoPorPadrao}
              >
                <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2 marker:hidden [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden
                    className="mt-0.5 inline-block shrink-0 select-none text-[10px] text-text-muted transition-transform duration-200 group-open:rotate-90"
                  >
                    ▸
                  </span>
                  <span className="text-xs font-medium text-text-secondary">
                    Liderados cuja liderança não está na lista atual ({lideradosSemLiderNoCarregamento.length})
                  </span>
                </summary>
                <ul className="space-y-1 border-t border-card/50 px-3 py-2 text-xs text-text-muted">
                  {lideradosSemLiderNoCarregamento.map((row) => (
                    <li key={row.id} className="list-none">
                      {row.nome} · {row.whatsapp} · liderança: {leaderNomeFromLiderado(row)}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
