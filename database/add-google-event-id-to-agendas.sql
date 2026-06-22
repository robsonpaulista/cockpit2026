-- Vínculo entre compromissos do Google Calendar e agendas de Campo & Agenda
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS google_event_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agendas_google_event_id
  ON agendas (google_event_id)
  WHERE google_event_id IS NOT NULL;

COMMENT ON COLUMN agendas.google_event_id IS 'ID do evento no Google Calendar (evita duplicatas ao importar da agenda)';
