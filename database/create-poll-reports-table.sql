-- Relatórios de pesquisas internas (anexos PDF + análise)
CREATE TABLE IF NOT EXISTS poll_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  extracted_text TEXT,
  summary TEXT,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  opportunities JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_status TEXT NOT NULL DEFAULT 'processing'
    CHECK (analysis_status IN ('processing', 'completed', 'failed')),
  analysis_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (poll_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_reports_user_id ON poll_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_poll_reports_poll_id ON poll_reports(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_reports_status ON poll_reports(analysis_status);

CREATE OR REPLACE FUNCTION update_poll_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_poll_reports_updated_at ON poll_reports;
CREATE TRIGGER update_poll_reports_updated_at
  BEFORE UPDATE ON poll_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_poll_reports_updated_at();

ALTER TABLE poll_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own poll reports" ON poll_reports;
CREATE POLICY "Users can view their own poll reports"
  ON poll_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own poll reports" ON poll_reports;
CREATE POLICY "Users can insert their own poll reports"
  ON poll_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own poll reports" ON poll_reports;
CREATE POLICY "Users can update their own poll reports"
  ON poll_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own poll reports" ON poll_reports;
CREATE POLICY "Users can delete their own poll reports"
  ON poll_reports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE poll_reports IS 'Relatórios em PDF das pesquisas internas com análise automática';
COMMENT ON COLUMN poll_reports.summary IS 'Resumo executivo gerado automaticamente a partir do PDF';
