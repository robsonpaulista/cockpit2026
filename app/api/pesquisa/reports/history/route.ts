import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const REPORTS_BUCKET = 'polls-pdfs'

type PollRow = {
  id: string
  data: string
  instituto: string
  candidato_nome: string
  intencao: number
  rejeicao: number
  cidade_id: string | null
  cities: { name: string | null } | null
}

type ReportRow = {
  id: string
  poll_id: string
  file_path: string
  file_name: string
  file_size: number | null
  summary: string | null
  analysis_status: 'processing' | 'completed' | 'failed' | null
  updated_at: string | null
}

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cidadeId = (searchParams.get('cidade_id') || '').trim()
    const limit = Number(searchParams.get('limit') || '50')
    if (!cidadeId) {
      return NextResponse.json({ error: 'cidade_id é obrigatório' }, { status: 400 })
    }

    const { data: pollsData, error: pollsError } = await supabase
      .from('polls')
      .select(
        `
        id,
        data,
        instituto,
        candidato_nome,
        intencao,
        rejeicao,
        cidade_id,
        cities (
          name
        )
      `
      )
      .eq('user_id', user.id)
      .eq('cidade_id', cidadeId)
      .order('data', { ascending: true })
      .limit(Math.max(1, Math.min(limit, 200)))

    if (pollsError) {
      return NextResponse.json({ error: pollsError.message }, { status: 500 })
    }

    const polls = (pollsData || []) as PollRow[]
    if (polls.length === 0) {
      return NextResponse.json({ items: [] })
    }

    const pollIds = polls.map((poll) => poll.id)
    const { data: reportsData, error: reportsError } = await supabase
      .from('poll_reports')
      .select('id, poll_id, file_path, file_name, file_size, summary, analysis_status, updated_at')
      .eq('user_id', user.id)
      .in('poll_id', pollIds)

    if (reportsError) {
      return NextResponse.json({ error: reportsError.message }, { status: 500 })
    }

    const reports = (reportsData || []) as ReportRow[]
    const admin = createAdminClient()
    const reportByPollId = new Map<string, (ReportRow & { file_url: string | null })>()

    await Promise.all(
      reports.map(async (report) => {
        let fileUrl: string | null = null
        if (report.file_path) {
          const { data: signed } = await admin.storage.from(REPORTS_BUCKET).createSignedUrl(report.file_path, 60 * 60)
          fileUrl = signed?.signedUrl || null
        }

        reportByPollId.set(report.poll_id, {
          ...report,
          file_url: fileUrl,
        })
      })
    )

    const items = polls.map((poll) => {
      const report = reportByPollId.get(poll.id)
      return {
        poll: {
          id: poll.id,
          data: poll.data,
          instituto: poll.instituto,
          candidato_nome: poll.candidato_nome,
          intencao: Number(poll.intencao || 0),
          rejeicao: Number(poll.rejeicao || 0),
          cidade_id: poll.cidade_id,
          cidade_nome: poll.cities?.name || null,
        },
        report: report
          ? {
              id: report.id,
              poll_id: report.poll_id,
              file_name: report.file_name,
              file_size: report.file_size,
              file_url: report.file_url,
              analysis_status: report.analysis_status,
              updated_at: report.updated_at,
              summary: report.summary,
            }
          : null,
      }
    })

    return NextResponse.json({ items })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

