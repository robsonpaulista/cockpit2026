-- Marca visitas/eventos da agenda que entram no Planejado do Fluxo Digital.
ALTER TABLE agendas
  ADD COLUMN IF NOT EXISTS incluir_fluxo_digital BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agendas_fluxo_digital
  ON agendas (incluir_fluxo_digital, date)
  WHERE incluir_fluxo_digital = true AND status = 'planejada';

COMMENT ON COLUMN agendas.incluir_fluxo_digital IS
  'Se true, o compromisso alimenta a etapa Planejado do Fluxo Digital';
