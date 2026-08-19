export type CalendarAttendanceRow = {
  attended?: boolean | null
  arrival_time?: string | null
}

export type AgendaAttendancePatch = {
  id: string
  attended?: boolean | null
  arrivalTime?: string | null
  status?: string
}

export type FetchCalendarAttendancesScope = 'user' | 'global'

const ATTENDANCE_IDS_BATCH_SIZE = 80

async function fetchCalendarAttendancesBatch(
  eventIds: string[],
  path: string,
): Promise<Record<string, CalendarAttendanceRow>> {
  const params = new URLSearchParams()
  if (eventIds.length === 1) {
    params.set('eventId', eventIds[0] ?? '')
  } else {
    params.set('eventIds', eventIds.join(','))
  }
  const res = await fetch(`${path}?${params.toString()}`, {
    cache: 'no-store',
  })
  if (!res.ok) return {}
  const json = (await res.json()) as {
    attendance?: CalendarAttendanceRow | null
    attendances?: Record<string, CalendarAttendanceRow | null>
  }
  if (json.attendances) {
    const out: Record<string, CalendarAttendanceRow> = {}
    for (const [id, row] of Object.entries(json.attendances)) {
      if (row) out[id] = row
    }
    return out
  }
  const singleId = eventIds[0]
  if (singleId && json.attendance) {
    return { [singleId]: json.attendance }
  }
  return {}
}

export async function fetchCalendarAttendances(
  eventIds: string[],
  opts?: { scope?: FetchCalendarAttendancesScope },
): Promise<Record<string, CalendarAttendanceRow>> {
  const unique = [...new Set(eventIds.filter(Boolean))]
  if (unique.length === 0) return {}

  const scope = opts?.scope ?? 'user'
  const path =
    scope === 'global' ? '/api/war-room/agenda-confirmados' : '/api/agenda/attendance'

  try {
    const merged: Record<string, CalendarAttendanceRow> = {}
    for (let i = 0; i < unique.length; i += ATTENDANCE_IDS_BATCH_SIZE) {
      const chunk = unique.slice(i, i + ATTENDANCE_IDS_BATCH_SIZE)
      const batch = await fetchCalendarAttendancesBatch(chunk, path)
      Object.assign(merged, batch)
    }
    return merged
  } catch {
    return {}
  }
}

export function mergeAgendaAttendance<T extends AgendaAttendancePatch>(
  items: T[],
  byId: Record<string, CalendarAttendanceRow>,
): T[] {
  let changed = false
  const next = items.map((item) => {
    const att = byId[item.id]
    if (!att) return item
    const arrivalTime = att.arrival_time ?? null
    const attended = att.attended ?? null
    if (item.arrivalTime === arrivalTime && item.attended === attended) return item
    changed = true
    return {
      ...item,
      attended,
      arrivalTime,
      status: attended === true ? 'concluido' : item.status,
    }
  })
  return changed ? next : items
}
