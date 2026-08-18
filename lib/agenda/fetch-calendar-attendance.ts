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

export async function fetchCalendarAttendances(
  eventIds: string[],
): Promise<Record<string, CalendarAttendanceRow>> {
  const unique = [...new Set(eventIds.filter(Boolean))]
  if (unique.length === 0) return {}

  try {
    const params = new URLSearchParams()
    if (unique.length === 1) {
      params.set('eventId', unique[0] ?? '')
    } else {
      params.set('eventIds', unique.join(','))
    }
    const res = await fetch(`/api/agenda/attendance?${params.toString()}`, {
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
    const singleId = unique[0]
    if (singleId && json.attendance) {
      return { [singleId]: json.attendance }
    }
    return {}
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
