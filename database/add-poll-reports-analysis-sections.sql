-- Migration: adiciona coluna analysis_sections à tabela poll_reports
-- Essa coluna armazena seções detalhadas do relatório estratégico gerado pela IA:
--   methodology, electoralScenario, candidatePerformance, managementEvaluation,
--   voterProfile, cityProblems, segmentation

ALTER TABLE poll_reports
  ADD COLUMN IF NOT EXISTS analysis_sections JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN poll_reports.analysis_sections IS
  'Seções detalhadas do relatório estratégico: metodologia, cenário eleitoral, desempenho do candidato, avaliação de gestão, perfil do eleitorado, problemas da cidade e segmentação.';
