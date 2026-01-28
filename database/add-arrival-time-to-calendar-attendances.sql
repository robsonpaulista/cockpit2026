-- ============================================
-- ADICIONAR CAMPO ARRIVAL_TIME NA TABELA CALENDAR_ATTENDANCES
-- ============================================

-- Adicionar coluna arrival_time para armazenar quando a pessoa chegou
ALTER TABLE calendar_attendances 
ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMPTZ;

-- Criar índice para melhorar performance em consultas por arrival_time
CREATE INDEX IF NOT EXISTS idx_calendar_attendances_arrival_time 
ON calendar_attendances(arrival_time) 
WHERE arrival_time IS NOT NULL;

-- Comentário na coluna
COMMENT ON COLUMN calendar_attendances.arrival_time IS 'Timestamp de quando a pessoa agendada chegou';
