'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  IconBuildingBridge,
  IconCalendarEvent,
  IconCheck,
  IconClock,
  IconFileSpreadsheet,
  IconFlag,
  IconPhoto,
  IconSpeakerphone,
  IconTruck,
  IconUsers,
  IconUsersGroup,
  type Icon,
} from '@tabler/icons-react'
import {
  AGENDA_FLUXO_PRIORIDADE_LABEL,
  AGENDA_FLUXO_STATUS_LABEL,
  AGENDA_FLUXO_STEPS,
  agendaFluxoBadgeLabel,
  agendaFluxoBadgeTone,
  agendaFluxoDependencias,
  buildAgendaFluxoSeed,
  countAgendaFluxoProgress,
  isAgendaFluxoStepDone,
  listDisparosAgendaFluxo,
  listEmendasAgendaFluxo,
  mapDemandasAgendaFluxo,
  loadAgendaFluxoState,
  mergeAgendaFluxoState,
  saveAgendaFluxoState,
  type AgendaFluxoDemandaItem,
  type AgendaFluxoEmendaItem,
  type AgendaFluxoPrioridade,
  type AgendaFluxoStateMap,
  type AgendaFluxoStatus,
  type AgendaFluxoStepId,
} from '@/lib/war-room/agenda-fluxo'
import { WAR_ROOM_DISPAROS } from '@/lib/war-room/mock-data'
import { formatWarRoomPct } from '@/lib/war-room/format'

const STATUS_ACTIONS: AgendaFluxoStatus[] = [
  'concluido',
  'em_andamento',
  'pendente',
  'nao_se_aplica',
]

const PRIORIDADES: AgendaFluxoPrioridade[] = ['alta', 'media', 'baixa']

const PRESENCA_STEPS: AgendaFluxoStepId[] = [
  'obras_cidade',
  'emendas_destinadas',
  'comunicacao_lideres',
]

const STEP_ICONS: Record<AgendaFluxoStepId, Icon> = {
  agendamento: IconCalendarEvent,
  comunicacao_lideres: IconUsers,
  obras_cidade: IconBuildingBridge,
  emendas_destinadas: IconFileSpreadsheet,
  material_impulso: IconPhoto,
  impulso_autorizado: IconSpeakerphone,
  envio_material: IconTruck,
  mobilizacao: IconUsersGroup,
}

type Props = {
  municipio: string
  fluxoKey: string
  temAgendamento: boolean
  prazoLabel?: string | null
}

export function WarRoomAgendaFluxoPanel({
  municipio,
  fluxoKey,
  temAgendamento,
  prazoLabel = null,
}: Props) {
  const [demandas, setDemandas] = useState<AgendaFluxoDemandaItem[]>([])
  const [demandasCarregadas, setDemandasCarregadas] = useState(false)
  const [demandasErro, setDemandasErro] = useState<string | null>(null)
  const [emendas, setEmendas] = useState<AgendaFluxoEmendaItem[]>([])
  const [emendasCarregadas, setEmendasCarregadas] = useState(false)
  const [emendasErro, setEmendasErro] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setDemandas([])
    setDemandasCarregadas(false)
    setDemandasErro(null)
    setEmendas([])
    setEmendasCarregadas(false)
    setEmendasErro(null)

    const carregarDemandas = async () => {
      try {
        const response = await fetch(
          `/api/campo/demands?cidade=${encodeURIComponent(municipio)}`,
          { cache: 'no-store' },
        )
        const data: unknown = await response.json().catch(() => null)
        if (cancelled) return

        if (!response.ok) {
          const apiMsg =
            data &&
            typeof data === 'object' &&
            data !== null &&
            'error' in data &&
            typeof (data as { error: unknown }).error === 'string'
              ? (data as { error: string }).error
              : null
          throw new Error(apiMsg || `Erro ao buscar demandas (${response.status})`)
        }

        if (!Array.isArray(data)) {
          throw new Error('Resposta inválida ao carregar demandas.')
        }

        setDemandas(mapDemandasAgendaFluxo(data))
        setDemandasCarregadas(true)
      } catch (err) {
        if (cancelled) return
        setDemandas([])
        setDemandasCarregadas(true)
        setDemandasErro(err instanceof Error ? err.message : 'Erro ao carregar demandas')
      }
    }

    const carregarEmendas = async () => {
      try {
        const response = await fetch('/api/emendas', { cache: 'no-store' })
        const data: unknown = await response.json().catch(() => null)
        if (cancelled) return

        if (!response.ok) {
          const apiMsg =
            data &&
            typeof data === 'object' &&
            data !== null &&
            'error' in data &&
            typeof (data as { error: unknown }).error === 'string'
              ? (data as { error: string }).error
              : null
          throw new Error(apiMsg || `Erro ao buscar emendas (${response.status})`)
        }

        const lista =
          data &&
          typeof data === 'object' &&
          data !== null &&
          'emendas' in data &&
          Array.isArray((data as { emendas: unknown }).emendas)
            ? (data as { emendas: unknown[] }).emendas
            : null

        if (!lista) {
          throw new Error('Resposta inválida ao carregar emendas.')
        }

        setEmendas(listEmendasAgendaFluxo(lista, municipio))
        setEmendasCarregadas(true)
      } catch (err) {
        if (cancelled) return
        setEmendas([])
        setEmendasCarregadas(true)
        setEmendasErro(err instanceof Error ? err.message : 'Erro ao carregar emendas')
      }
    }

    void carregarDemandas()
    void carregarEmendas()
    return () => {
      cancelled = true
    }
  }, [municipio])

  const disparosMunicipio = useMemo(
    () => listDisparosAgendaFluxo(municipio, WAR_ROOM_DISPAROS),
    [municipio],
  )

  const seed = useMemo(
    () =>
      buildAgendaFluxoSeed({
        temAgendamento,
        municipio,
        demandas,
        demandasCarregadas,
        emendas,
        emendasCarregadas,
        disparos: WAR_ROOM_DISPAROS,
      }),
    [temAgendamento, municipio, demandas, demandasCarregadas, emendas, emendasCarregadas],
  )

  const [state, setState] = useState<AgendaFluxoStateMap>(() =>
    mergeAgendaFluxoState(seed, loadAgendaFluxoState(municipio, fluxoKey)),
  )
  const [activeId, setActiveId] = useState<AgendaFluxoStepId>(AGENDA_FLUXO_STEPS[0].id)
  const [prioridade, setPrioridade] = useState<AgendaFluxoPrioridade>('media')

  useEffect(() => {
    setState(mergeAgendaFluxoState(seed, loadAgendaFluxoState(municipio, fluxoKey)))
  }, [municipio, fluxoKey, seed])

  useEffect(() => {
    setActiveId(AGENDA_FLUXO_STEPS[0].id)
    setPrioridade('media')
  }, [municipio, fluxoKey])

  const progress = countAgendaFluxoProgress(state)
  const activeIndex = AGENDA_FLUXO_STEPS.findIndex((s) => s.id === activeId)
  const activeStep = AGENDA_FLUXO_STEPS[activeIndex] ?? AGENDA_FLUXO_STEPS[0]
  const activeState = state[activeStep.id] ?? { status: 'pendente' as const }
  const isAuto = Boolean(activeStep.automatico)
  const deps = agendaFluxoDependencias(activeStep.id, state)
  const ActiveIcon = STEP_ICONS[activeStep.id]

  const setStepStatus = (stepId: AgendaFluxoStepId, status: AgendaFluxoStatus) => {
    setState((prev) => {
      const next = {
        ...prev,
        [stepId]: {
          ...prev[stepId],
          status,
          updatedAt: new Date().toISOString(),
        },
      }
      saveAgendaFluxoState(municipio, fluxoKey, next)
      return next
    })
  }

  return (
    <section className="wr-agenda-fluxo" aria-label="Fluxo operacional da agenda">
      <header className="wr-agenda-fluxo__summary">
        <div className="wr-agenda-fluxo__summary-top">
          <p className="wr-agenda-fluxo__summary-label">Fluxo operacional da agenda</p>
          <p className="wr-agenda-fluxo__summary-count">
            {progress.done}/{progress.total} · {progress.pct}%
          </p>
        </div>
      </header>

      <ol className="wr-agenda-fluxo__track">
        {AGENDA_FLUXO_STEPS.map((step, index) => {
          const status = state[step.id]?.status ?? 'pendente'
          const done = isAgendaFluxoStepDone(status)
          const isActive = step.id === activeId
          const Icon = STEP_ICONS[step.id]
          const tone = agendaFluxoBadgeTone(step.id, status)
          const prevDone =
            index === 0
              ? true
              : isAgendaFluxoStepDone(state[AGENDA_FLUXO_STEPS[index - 1]?.id]?.status)

          return (
            <li
              key={step.id}
              className={[
                'wr-agenda-fluxo__node',
                `wr-agenda-fluxo__node--${tone}`,
                isActive ? 'is-active' : '',
                done ? 'is-done' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {index > 0 ? (
                <span
                  className={
                    done && prevDone
                      ? 'wr-agenda-fluxo__connector wr-agenda-fluxo__connector--done'
                      : prevDone
                        ? 'wr-agenda-fluxo__connector wr-agenda-fluxo__connector--partial'
                        : 'wr-agenda-fluxo__connector'
                  }
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                className="wr-agenda-fluxo__node-btn"
                aria-pressed={isActive}
                onClick={() => setActiveId(step.id)}
              >
                <span className="wr-agenda-fluxo__icon-wrap" aria-hidden>
                  <span className="wr-agenda-fluxo__icon">
                    {done && !PRESENCA_STEPS.includes(step.id) ? (
                      <IconCheck className="h-4 w-4" stroke={2.25} />
                    ) : (
                      <Icon className="h-4 w-4" stroke={1.75} />
                    )}
                  </span>
                </span>
                <span className="wr-agenda-fluxo__node-title">{step.titulo}</span>
                <span className={`wr-agenda-fluxo__badge wr-agenda-fluxo__badge--${tone}`}>
                  {agendaFluxoBadgeLabel(step.id, status)}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="wr-agenda-fluxo__workspace wr-agenda-fluxo__workspace--simple">
        <div className="wr-agenda-fluxo__context">
          <p className="wr-agenda-fluxo__etapa-kicker">
            Etapa {activeIndex + 1} de {AGENDA_FLUXO_STEPS.length}
          </p>
          <div className="wr-agenda-fluxo__context-title-row">
            <span className="wr-agenda-fluxo__context-icon" aria-hidden>
              <ActiveIcon className="h-4 w-4" stroke={1.75} />
            </span>
            <h3 className="wr-agenda-fluxo__title">
              {activeStep.titulo}
              {isAuto ? <span className="wr-agenda-fluxo__auto">Auto</span> : null}
            </h3>
          </div>
          <p className="wr-agenda-fluxo__desc">
            {activeStep.descricao}
            {activeState.nota ? ` ${activeState.nota}.` : ''}
          </p>

          <div className="wr-agenda-fluxo__status-block">
            <span
              className={`wr-agenda-fluxo__badge wr-agenda-fluxo__badge--lg wr-agenda-fluxo__badge--${agendaFluxoBadgeTone(activeStep.id, activeState.status)}`}
            >
              {agendaFluxoBadgeLabel(activeStep.id, activeState.status)}
            </span>
            {!isAuto ? (
              <div className="wr-agenda-fluxo__actions" role="group" aria-label="Atualizar status">
                {STATUS_ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className={
                      activeState.status === action
                        ? `wr-agenda-fluxo__chip wr-agenda-fluxo__chip--${action} is-active`
                        : `wr-agenda-fluxo__chip wr-agenda-fluxo__chip--${action}`
                    }
                    aria-pressed={activeState.status === action}
                    onClick={() => setStepStatus(activeStep.id, action)}
                  >
                    {AGENDA_FLUXO_STATUS_LABEL[action]}
                  </button>
                ))}
              </div>
            ) : (
              <p className="wr-agenda-fluxo__auto-hint">
                Preenchido automaticamente pelos dados do sistema.
              </p>
            )}
          </div>

          {activeStep.id === 'comunicacao_lideres' ? (
            disparosMunicipio.length > 0 ? (
              <ul className="wr-agenda-fluxo__obras">
                {disparosMunicipio.slice(0, 6).map((d) => (
                  <li key={d.id} className="wr-agenda-fluxo__obra">
                    <p className="wr-agenda-fluxo__obra-titulo">{d.campanha}</p>
                    <p className="wr-agenda-fluxo__obra-meta">
                      {d.publico} · {d.enviados.toLocaleString('pt-BR')} enviados · CTR{' '}
                      {formatWarRoomPct(d.clicksPct)}
                    </p>
                  </li>
                ))}
                {disparosMunicipio.length > 6 ? (
                  <li className="wr-agenda-fluxo__obra-more">
                    +{disparosMunicipio.length - 6} disparo
                    {disparosMunicipio.length - 6 === 1 ? '' : 's'}
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="wr-agenda-fluxo__empty">
                Nenhum disparo recente vinculado a este município.
              </p>
            )
          ) : null}

          {activeStep.id === 'obras_cidade' ? (
            !demandasCarregadas ? (
              <p className="wr-agenda-fluxo__empty">Carregando Cadastro de Demandas…</p>
            ) : demandasErro ? (
              <p className="wr-agenda-fluxo__empty">{demandasErro}</p>
            ) : demandas.length > 0 ? (
              <ul className="wr-agenda-fluxo__obras wr-agenda-fluxo__obras--scroll">
                {demandas.map((demanda) => (
                  <li key={demanda.id} className="wr-agenda-fluxo__obra">
                    <p className="wr-agenda-fluxo__obra-titulo">{demanda.titulo}</p>
                    <p className="wr-agenda-fluxo__obra-meta">
                      {[demanda.status, demanda.lideranca].filter(Boolean).join(' · ') ||
                        'Cadastro de Demandas'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="wr-agenda-fluxo__empty">
                Nenhuma demanda deste município na planilha Cadastro de Demandas.
              </p>
            )
          ) : null}

          {activeStep.id === 'emendas_destinadas' ? (
            !emendasCarregadas ? (
              <p className="wr-agenda-fluxo__empty">Carregando cadastro Emendas…</p>
            ) : emendasErro ? (
              <p className="wr-agenda-fluxo__empty">{emendasErro}</p>
            ) : emendas.length > 0 ? (
              <ul className="wr-agenda-fluxo__obras">
                {emendas.slice(0, 6).map((emenda) => (
                  <li key={emenda.id} className="wr-agenda-fluxo__obra">
                    <p className="wr-agenda-fluxo__obra-titulo">{emenda.titulo}</p>
                    <p className="wr-agenda-fluxo__obra-meta">
                      {[emenda.status, emenda.meta].filter(Boolean).join(' · ') ||
                        'Cadastro Emendas'}
                    </p>
                  </li>
                ))}
                {emendas.length > 6 ? (
                  <li className="wr-agenda-fluxo__obra-more">
                    +{emendas.length - 6} emenda
                    {emendas.length - 6 === 1 ? '' : 's'}
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="wr-agenda-fluxo__empty">
                Nenhuma emenda destinada a este município no cadastro Emendas.
              </p>
            )
          ) : null}

          {deps.length > 0 ? (
            <div className="wr-agenda-fluxo__deps">
              <p className="wr-agenda-fluxo__deps-label">Dependências</p>
              <ul className="wr-agenda-fluxo__deps-list">
                {deps.map((d) => (
                  <li
                    key={d.id}
                    className={
                      d.ok
                        ? 'wr-agenda-fluxo__dep wr-agenda-fluxo__dep--ok'
                        : 'wr-agenda-fluxo__dep'
                    }
                  >
                    <span className="wr-agenda-fluxo__dep-mark" aria-hidden>
                      {d.ok ? (
                        <IconCheck className="h-3.5 w-3.5" stroke={2.25} />
                      ) : (
                        <IconClock className="h-3.5 w-3.5" stroke={1.75} />
                      )}
                    </span>
                    <span>
                      {d.titulo}
                      {d.ok ? ' concluída' : ' pendente'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="wr-agenda-fluxo__meta">
          <div className="wr-agenda-fluxo__meta-block">
            <p className="wr-agenda-fluxo__meta-label">Prazo</p>
            <div className="wr-agenda-fluxo__prazo">
              <IconCalendarEvent className="h-4 w-4 shrink-0" stroke={1.75} aria-hidden />
              <span>{prazoLabel ?? 'Sem data'}</span>
              {prazoLabel ? <span className="wr-agenda-fluxo__prazo-tag">Agenda</span> : null}
            </div>
          </div>

          <div className="wr-agenda-fluxo__meta-block">
            <p className="wr-agenda-fluxo__meta-label">Prioridade</p>
            <div className="wr-agenda-fluxo__prio" role="group" aria-label="Prioridade">
              {PRIORIDADES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={
                    prioridade === p
                      ? `wr-agenda-fluxo__prio-btn wr-agenda-fluxo__prio-btn--${p} is-active`
                      : `wr-agenda-fluxo__prio-btn wr-agenda-fluxo__prio-btn--${p}`
                  }
                  aria-pressed={prioridade === p}
                  onClick={() => setPrioridade(p)}
                >
                  <IconFlag className="h-3 w-3" stroke={2} aria-hidden />
                  {AGENDA_FLUXO_PRIORIDADE_LABEL[p]}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
