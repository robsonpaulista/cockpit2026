export type CalendarAttendanceRowLite = {
  event_id: string
  attended?: boolean | null
  arrival_time?: string | null
}

export type AggregatedEventAttendance = {
  attended?: boolean | null
  arrival_time?: string | null
}

/** Agrega confirmações de vários usuários por evento (War Room / visão compartilhada). */
export function aggregateEventAttendances(
  rows: CalendarAttendanceRowLite[],
): Record<string, AggregatedEventAttendance> {
  const attendances: Record<string, AggregatedEventAttendance> = {}

  for (const row of rows) {
    if (!row.event_id) continue
    const arrival = row.arrival_time ?? null
    const attended = row.attended ?? null
    const current = attendances[row.event_id]

    if (!current) {
      attendances[row.event_id] = { attended, arrival_time: arrival }
      continue
    }

    if (arrival) {
      const prev = current.arrival_time
      if (!prev || new Date(arrival).getTime() < new Date(prev).getTime()) {
        current.arrival_time = arrival
      }
    }
    if (attended === true) {
      current.attended = true
    }
  }

  return attendances
}
