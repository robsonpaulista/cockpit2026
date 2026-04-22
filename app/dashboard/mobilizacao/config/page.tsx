'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

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

function coordinatorNameFromLeader(leader: Leader): string {
  const c = leader.coordinators
  if (!c) return 'Sem coordenação'
  if (Array.isArray(c)) return c[0]?.nome ?? 'Sem coordenação'
  return c.nome
}

function leaderNomeFromLiderado(row: Liderado): string {
  const l = row.leaders
  if (!l) return '—'
  if (Array.isArray(l)) return l[0]?.nome ?? '—'
  return l.nome
}

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
  const [leaderCidade, setLeaderCidade] = useState('')
  const [leaderCoordinatorId, setLeaderCoordinatorId] = useState('')
  const [criandoLeader, setCriandoLeader] = useState(false)

  const [lideradoNome, setLideradoNome] = useState('')
  const [lideradoWhatsapp, setLideradoWhatsapp] = useState('')
  const [lideradoInstagram, setLideradoInstagram] = useState('')
  const [lideradoLeaderId, setLideradoLeaderId] = useState('')
  const [lideradoCidade, setLideradoCidade] = useState('')
  const [criandoLiderado, setCriandoLiderado] = useState(false)

  const [mensagem, setMensagem] = useState<string | null>(null)

  const baseCaptacaoUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/mobilizacao/detalhe`
  }, [])

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
    setErro(null)
    setCriandoCoord(true)
    try {
      const res = await fetch('/api/mobilizacao/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'coordinator',
          nome: coordNome.trim(),
          regiao: coordRegiao.trim() || null,
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
          cidade: leaderCidade.trim() || null,
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
      setLeaderCidade('')
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
            <input
              value={coordRegiao}
              onChange={(e) => setCoordRegiao(e.target.value)}
              placeholder="Região (opcional)"
              className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            />
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
            <input
              value={leaderCidade}
              onChange={(e) => setLeaderCidade(e.target.value)}
              placeholder="Cidade (opcional)"
              className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            />
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Coordenadores ({coordinators.length})
        </h2>
        {carregando ? (
          <p className="text-sm text-text-secondary">Carregando coordenadores...</p>
        ) : coordinators.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhum coordenador cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {coordinators.map((coordinator) => (
              <div key={coordinator.id} className="rounded-lg border border-card/70 px-3 py-2 text-sm">
                <p className="font-medium text-text-primary">{coordinator.nome}</p>
                <p className="text-text-secondary">{coordinator.regiao || 'Região não informada'}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-card bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Liderados recentes ({liderados.length})
        </h2>
        {carregando ? (
          <p className="text-sm text-text-secondary">Carregando liderados...</p>
        ) : liderados.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhum liderado cadastrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {liderados.map((row) => (
              <div key={row.id} className="rounded-lg border border-card/70 px-3 py-2 text-sm">
                <p className="font-medium text-text-primary">{row.nome}</p>
                <p className="text-text-secondary">
                  {row.whatsapp}
                  {row.instagram ? ` · @${row.instagram}` : ''}
                  {' · '}
                  Liderança: {leaderNomeFromLiderado(row)}
                  {row.cidade ? ` · ${row.cidade}` : ''}
                </p>
                <p className="text-xs text-text-muted">
                  Origem: {row.origem} · {new Date(row.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-card bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Lideranças e links ({leaders.length})
        </h2>
        {carregando ? (
          <p className="text-sm text-text-secondary">Carregando lideranças...</p>
        ) : leaders.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhuma liderança cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {leaders.map((leader) => {
              const link = baseCaptacaoUrl ? `${baseCaptacaoUrl}?leader_id=${leader.id}` : ''
              return (
                <div key={leader.id} className="rounded-lg border border-card/70 px-3 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary">{leader.nome}</p>
                      <p className="text-sm text-text-secondary">
                        Coordenação: {coordinatorNameFromLeader(leader)}
                        {leader.cidade ? ` · ${leader.cidade}` : ''}
                      </p>
                      {link ? (
                        <p className="mt-1 break-all text-xs text-text-muted">{link}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyLink(leader.id)}
                      className="shrink-0 rounded-md border border-card px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-card/40"
                    >
                      Copiar link
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
