-- Associa narrativas a fases da campanha (opcional)
ALTER TABLE narratives
ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES campaign_phases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_narratives_phase_id ON narratives(phase_id);
