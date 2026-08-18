export type CalendarAttendanceRow = {
  attended?: boolean | null
  arrival_time?: string | null
}

export async function fetchCalendarAttendances(
  eventIds: string[],
): Promise<Record<string, CalendarAttendanceRow>> {
  const unique = [...new Set(eventIds.filter(Boolean))]
  const pairs = await Promise.all(
    unique.map(async (eventId) => {
      try {
        const res = await fetch(`/api/agenda/attendance?eventId=${encodeURIComponent(eventId)}`, {
          cache: 'no-store',
        })
        if (!res.ok) return [eventId, null] as const
        const json = (await res.json()) as { attendance?: CalendarAttendanceRow | null }
        return [eventId, json.attendance ?? null] as const
      } catch {
        return [eventId, null] as const
      }
    }),
  )
  const out: Record<string, CalendarAttendanceRow> = {}
  for (const [id, row] of pairs) {
    if (row) out[id] = row
  }
  return out
}
