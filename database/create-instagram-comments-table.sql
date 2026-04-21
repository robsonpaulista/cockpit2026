-- Comentários do Instagram por mídia (sincronização Graph API), por usuário da aplicação
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS instagram_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_business_account_id TEXT NOT NULL,
  instagram_owner_username TEXT,
  instagram_media_id TEXT NOT NULL,
  media_permalink TEXT,
  media_caption TEXT,
  media_thumbnail_url TEXT,
  media_posted_at TIMESTAMPTZ,
  instagram_comment_id TEXT NOT NULL,
  parent_instagram_comment_id TEXT,
  commenter_ig_id TEXT,
  commenter_username TEXT,
  comment_text TEXT,
  comment_like_count INTEGER NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  commented_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, instagram_comment_id)
);

CREATE INDEX IF NOT EXISTS idx_instagram_comments_user_id ON instagram_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_comments_media ON instagram_comments(user_id, instagram_media_id);
CREATE INDEX IF NOT EXISTS idx_instagram_comments_commenter ON instagram_comments(user_id, commenter_username);
CREATE INDEX IF NOT EXISTS idx_instagram_comments_commented_at ON instagram_comments(commented_at DESC);
CREATE INDEX IF NOT EXISTS idx_instagram_comments_ig_business ON instagram_comments(user_id, instagram_business_account_id);

CREATE OR REPLACE FUNCTION update_instagram_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_instagram_comments_updated_at ON instagram_comments;
CREATE TRIGGER update_instagram_comments_updated_at
  BEFORE UPDATE ON instagram_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_instagram_comments_updated_at();

ALTER TABLE instagram_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own instagram comments" ON instagram_comments;
DROP POLICY IF EXISTS "Users insert own instagram comments" ON instagram_comments;
DROP POLICY IF EXISTS "Users update own instagram comments" ON instagram_comments;
DROP POLICY IF EXISTS "Users delete own instagram comments" ON instagram_comments;

CREATE POLICY "Users read own instagram comments"
  ON instagram_comments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own instagram comments"
  ON instagram_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own instagram comments"
  ON instagram_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own instagram comments"
  ON instagram_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE instagram_comments IS 'Comentários sincronizados da Graph API (Instagram Business), persistidos por usuário';
COMMENT ON COLUMN instagram_comments.instagram_comment_id IS 'ID do comentário na Graph API (único por usuário da app)';
COMMENT ON COLUMN instagram_comments.parent_instagram_comment_id IS 'ID do comentário pai, se for resposta a outro comentário';
