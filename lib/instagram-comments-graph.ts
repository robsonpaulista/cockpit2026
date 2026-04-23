import { GRAPH_BASE } from './instagram-graph'

export type IgMediaSummary = {
  id: string
  permalink?: string
  caption?: string
  timestamp?: string
  thumbnail_url?: string
}

export type IgCommentNode = {
  id: string
  text?: string
  timestamp?: string
  username?: string
  like_count?: number
  hidden?: boolean
  user?: { id?: string }
  replies?: { data?: IgCommentNode[] }
}

/** Comentário raiz na mídia + respostas diretas (primeira página por nó). */
export type IgCommentWithReplies = {
  comment: IgCommentNode
  replies: IgCommentNode[]
}

const COMMENT_FIELDS = 'id,username,text,timestamp,like_count,hidden,replies.limit(1){id}'
const REPLY_FIELDS = 'id,username,text,timestamp,like_count,hidden'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function graphJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = (await res.json()) as T & { error?: { message?: string; code?: number } }
  if (!res.ok || (json as { error?: unknown }).error) {
    const msg = (json as { error?: { message?: string } }).error?.message || 'Erro Graph API'
    throw new Error(msg)
  }
  return json
}

export async function fetchAllMediaSummaries(
  instagramBusinessId: string,
  accessToken: string,
  maxItems: number,
  onProgress?: (msg: string) => void
): Promise<IgMediaSummary[]> {
  const out: IgMediaSummary[] = []
  let url: string | null =
    `${GRAPH_BASE}/${instagramBusinessId}/media?fields=id,permalink,caption,timestamp,thumbnail_url&limit=25&access_token=${encodeURIComponent(accessToken)}`

  type MediaPage = { data?: IgMediaSummary[]; paging?: { next?: string } }

  while (url && out.length < maxItems) {
    onProgress?.(`Buscando mídias (${out.length})…`)
    const currentUrl = url
    const data: MediaPage = await graphJson<MediaPage>(currentUrl)
    const batch = data.data || []
    for (const m of batch) {
      out.push(m)
      if (out.length >= maxItems) break
    }
    url = out.length >= maxItems ? null : data.paging?.next || null
    if (url) await sleep(150)
  }
  return out
}

/** Comentários de primeiro nível + primeira página de respostas por comentário. */
export async function fetchCommentsForMedia(
  mediaId: string,
  accessToken: string,
  onProgress?: (msg: string) => void
): Promise<IgCommentWithReplies[]> {
  const out: IgCommentWithReplies[] = []
  let url: string | null =
    `${GRAPH_BASE}/${mediaId}/comments?fields=${COMMENT_FIELDS}&limit=50&access_token=${encodeURIComponent(accessToken)}`

  type CommentsPage = { data?: IgCommentNode[]; paging?: { next?: string } }

  while (url) {
    onProgress?.(`Comentários da mídia ${mediaId}…`)
    const currentUrl = url
    const data: CommentsPage = await graphJson<CommentsPage>(currentUrl)
    const page = data.data || []
    for (const c of page) {
      const replies = await fetchAllRepliesForComment(c.id, accessToken)
      out.push({
        comment: c,
        replies,
      })
    }
    url = data.paging?.next || null
    if (url) await sleep(120)
  }
  return out
}

async function fetchAllRepliesForComment(commentId: string, accessToken: string): Promise<IgCommentNode[]> {
  const out: IgCommentNode[] = []
  let url: string | null =
    `${GRAPH_BASE}/${commentId}/replies?fields=${REPLY_FIELDS}&limit=50&access_token=${encodeURIComponent(accessToken)}`

  type RepliesPage = { data?: IgCommentNode[]; paging?: { next?: string } }

  while (url) {
    const currentUrl = url
    const data: RepliesPage = await graphJson<RepliesPage>(currentUrl)
    const page = data.data || []
    out.push(...page)
    url = data.paging?.next || null
    if (url) await sleep(120)
  }

  return out
}
