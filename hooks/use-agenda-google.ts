'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { fetchCalendarAttendances } from '@/lib/agenda/fetch-calendar-attendance'
import { WAR_ROOM_ARRIVALS_SILENT_REFRESH_MS } from '@/lib/war-room/agenda-arrivals-refresh'
import {
  confirmAgendaChegada,
  fetchAgendaCalendarConfig,
  fetchAgendaEventos,
  fetchCampoGoogleLinks,
  saveAgendaAtendimento,
  saveAgendaCalendarConfig,
  type AgendaCalendarConfig,
  type AgendaCalendarConfigInput,
  type AgendaEvento,
  type CampoGoogleLink,
} from '@/lib/services/agenda-google-client'

export interface AgendaPresenca {
  attended: boolean | null
  arrival_time?: string
}

/** Cache antigo do navegador que podia guardar credenciais; ninguém mais lê. */
const CHAVE_CACHE_LEGADO = 'google_calendar_config'
const ALERTA_ANTECEDENCIA_MS = 5 * 60 * 1000
const RELOGIO_MS = 10_000

export function useAgendaGoogle() {
  const { user, loading: authLoading } = useAuth()
  const [config, setConfig] = useState<AgendaCalendarConfig | null>(null)
  const [configCarregada, setConfigCarregada] = useState<boolean>(false)
  const [eventos, setEventos] = useState<AgendaEvento[]>([])
  const [carregando, setCarregando] = useState<boolean>(true)
  const [atualizando, setAtualizando] = useState<boolean>(false)
  const [erro, setErro] = useState<string | null>(null)
  const [presencas, setPresencas] = useState<Record<string, AgendaPresenca>>({})
  const [confirmando, setConfirmando] = useState<Record<string, boolean>>({})
  const [linksCampo, setLinksCampo] = useState<Record<string, CampoGoogleLink>>({})
  const [agora, setAgora] = useState<number>(() => Date.now())
  const eventosRef = useRef<AgendaEvento[]>(eventos)
  eventosRef.current = eventos
  const presencasEmVoo = useRef<boolean>(false)

  useEffect(() => {
    if (authLoading) return
    let cancelado = false
    try {
      localStorage.removeItem(CHAVE_CACHE_LEGADO)
    } catch {
      // navegação privada pode bloquear o storage
    }
    if (!user?.id) {
      setConfig(null)
      setConfigCarregada(true)
      setCarregando(false)
      return
    }
    setConfigCarregada(false)
    fetchAgendaCalendarConfig()
      .then((c) => {
        if (!cancelado) setConfig(c)
      })
      .catch(() => {
        if (!cancelado) setConfig(null)
      })
      .finally(() => {
        if (cancelado) return
        setConfigCarregada(true)
        setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [user?.id, authLoading])

  const carregarEventos = useCallback(
    async (manual: boolean) => {
      if (!config?.calendarId) return
      if (manual) setAtualizando(true)
      else setCarregando(true)
      setErro(null)
      try {
        setEventos(await fetchAgendaEventos())
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao conectar com Google Calendar')
      } finally {
        if (manual) setAtualizando(false)
        else setCarregando(false)
      }
    },
    [config?.calendarId],
  )

  useEffect(() => {
    void carregarEventos(false)
  }, [carregarEventos])

  const carregarPresencas = useCallback(async () => {
    const ids = eventosRef.current.map((e) => e.id).filter(Boolean)
    if (ids.length === 0) {
      setPresencas({})
      return
    }
    if (presencasEmVoo.current) return
    presencasEmVoo.current = true
    try {
      const porId = await fetchCalendarAttendances(ids, { scope: 'global' })
      const proximas: Record<string, AgendaPresenca> = {}
      for (const [id, p] of Object.entries(porId)) {
        proximas[id] = { attended: p.attended ?? null, arrival_time: p.arrival_time ?? undefined }
      }
      setPresencas(proximas)
    } finally {
      presencasEmVoo.current = false
    }
  }, [])

  useEffect(() => {
    if (eventos.length > 0) void carregarPresencas()
  }, [eventos, carregarPresencas])

  // Todos os usuários veem as chegadas confirmadas pela equipe sem recarregar.
  useEffect(() => {
    if (eventos.length === 0) return
    const intervalo = window.setInterval(() => void carregarPresencas(), WAR_ROOM_ARRIVALS_SILENT_REFRESH_MS)
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void carregarPresencas()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [eventos.length, carregarPresencas])

  useEffect(() => {
    if (!user?.id) return
    let cancelado = false
    void fetchCampoGoogleLinks().then((links) => {
      if (!cancelado) setLinksCampo(links)
    })
    return () => {
      cancelado = true
    }
  }, [user?.id])

  useEffect(() => {
    const intervalo = window.setInterval(() => setAgora(Date.now()), RELOGIO_MS)
    return () => window.clearInterval(intervalo)
  }, [])

  const proximoAlertaId = useMemo<string | null>(() => {
    const limite = agora + ALERTA_ANTECEDENCIA_MS
    const proximo = eventos.find((e) => {
      if (!e.start?.dateTime) return false
      const t = new Date(e.start.dateTime).getTime()
      return t >= agora && t <= limite
    })
    return proximo?.id ?? null
  }, [eventos, agora])

  const salvarConfig = useCallback(
    async (input: AgendaCalendarConfigInput) => {
      const nova = await saveAgendaCalendarConfig(input)
      setConfig(nova)
      // Com outro calendário o efeito de `carregarEventos` já recarrega.
      if (nova.calendarId === config?.calendarId) void carregarEventos(true)
    },
    [config?.calendarId, carregarEventos],
  )

  const marcarAtendimento = useCallback(
    async (eventId: string, attended: boolean) => {
      if (!user?.id) return
      try {
        await saveAgendaAtendimento(eventId, attended)
        await carregarPresencas()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar atendimento')
      }
    },
    [user?.id, carregarPresencas],
  )

  const confirmarChegada = useCallback(
    async (evento: AgendaEvento) => {
      if (!user?.id) return
      const nome = evento.summary || 'este evento'
      const mensagem = linksCampo[evento.id]
        ? `Deseja confirmar a chegada para "${nome}"?\n\nO horário será registrado na agenda e o check-in em Campo & Agenda será sincronizado automaticamente.`
        : `Deseja realmente confirmar a chegada para "${nome}"?\n\nEsta ação registrará o horário atual como momento da chegada.`
      if (!window.confirm(mensagem)) return

      setConfirmando((prev) => ({ ...prev, [evento.id]: true }))
      try {
        const sync = await confirmAgendaChegada(evento.id)
        await carregarPresencas()
        const agendaId = sync?.synced ? sync.agendaId : undefined
        if (agendaId) {
          setLinksCampo((prev) => ({
            ...prev,
            [evento.id]: {
              ...(prev[evento.id] ?? { date: '', type: 'visita' }),
              id: agendaId,
              status: 'concluida',
            },
          }))
        }
      } catch {
        window.alert('Erro ao confirmar chegada. Tente novamente.')
      } finally {
        setConfirmando((prev) => ({ ...prev, [evento.id]: false }))
      }
    },
    [user?.id, linksCampo, carregarPresencas],
  )

  const vincularCampo = useCallback((eventId: string, link: CampoGoogleLink) => {
    setLinksCampo((prev) => ({ ...prev, [eventId]: link }))
  }, [])

  return {
    podeMarcar: Boolean(user?.id),
    config,
    configCarregada,
    eventos,
    carregando,
    atualizando,
    erro,
    presencas,
    confirmando,
    linksCampo,
    agora,
    proximoAlertaId,
    atualizar: () => void carregarEventos(true),
    salvarConfig,
    marcarAtendimento,
    confirmarChegada,
    vincularCampo,
  }
}

export type AgendaGoogle = ReturnType<typeof useAgendaGoogle>
