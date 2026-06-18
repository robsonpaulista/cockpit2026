export interface AgentChatLogRow {
  id: string
  user_id: string
  user_email: string | null
  session_id: string | null
  page_path: string | null
  user_message: string
  assistant_message: string
  source: string
  intent: string | null
  created_at: string
}
