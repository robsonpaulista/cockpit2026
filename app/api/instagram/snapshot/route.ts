import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import type { InstagramPostSnapshotInput } from '@/lib/instagram-engagement-history'
import { isMissingColumnError } from '@/lib/instagram-schema-compat'
import {
  recomputeInstagramPublishDayEngagement,
  saveInstagramPostSnapshots,
} from '@/lib/instagram-snapshot-server'

// POST: Salvar snapshot de métricas do Instagram
export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      followers_count,
      profile_views,
      website_clicks,
      reach,
      impressions,
      accounts_engaged,
      total_interactions,
      media_count,
      avg_post_engagement,
      instagram_username,
      posts = [],
    } = body

    if (followers_count === undefined) {
      return NextResponse.json(
        { error: 'followers_count é obrigatório' },
        { status: 400 }
      )
    }

    const snapshotDate = new Date().toISOString().split('T')[0]

    const basePayload = {
      user_id: user.id,
      snapshot_date: snapshotDate,
      followers_count: followers_count || 0,
      profile_views: profile_views || 0,
      website_clicks: website_clicks || 0,
      reach: reach || 0,
      impressions: impressions || 0,
      accounts_engaged: accounts_engaged || 0,
      total_interactions: total_interactions || 0,
      media_count: media_count || 0,
      instagram_username: instagram_username || '',
    }

    const fullPayload = {
      ...basePayload,
      avg_post_engagement: avg_post_engagement || 0,
    }

    let { data, error } = await supabase
      .from('instagram_metrics_history')
      .upsert(fullPayload, { onConflict: 'user_id,snapshot_date' })
      .select()
      .single()

    if (isMissingColumnError(error)) {
      ;({ data, error } = await supabase
        .from('instagram_metrics_history')
        .upsert(basePayload, { onConflict: 'user_id,snapshot_date' })
        .select()
        .single())
    }

    if (error) {
      console.error('Erro ao salvar snapshot:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (Array.isArray(posts) && posts.length > 0) {
      try {
        await saveInstagramPostSnapshots(
          supabase,
          user.id,
          posts as InstagramPostSnapshotInput[]
        )
        await recomputeInstagramPublishDayEngagement(supabase, user.id)
      } catch (engagementError) {
        console.error('Erro ao salvar histórico de engajamento:', engagementError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Snapshot salvo com sucesso',
      data,
    })
  } catch (error: unknown) {
    console.error('Erro ao salvar snapshot:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET: Buscar histórico de métricas
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
    const days = parseInt(searchParams.get('days') || '30')

    // Buscar histórico dos últimos X dias
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateKey = startDate.toISOString().split('T')[0]

    const { data: history, error } = await supabase
      .from('instagram_metrics_history')
      .select('*')
      .eq('user_id', user.id)
      .gte('snapshot_date', startDateKey)
      .order('snapshot_date', { ascending: true })

    if (error) {
      console.error('Erro ao buscar histórico:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: publishDayEngagement, error: engagementError } = await supabase
      .from('instagram_publish_day_engagement')
      .select('publish_date, avg_engagement, post_count, total_engagement')
      .eq('user_id', user.id)
      .gte('publish_date', startDateKey)
      .order('publish_date', { ascending: true })

    if (engagementError) {
      console.error('Erro ao buscar engajamento por dia:', engagementError)
    }

    // Calcular crescimento
    let growth = 0
    let growthPercentage = 0
    let profileViewsGrowth = 0

    if (history && history.length >= 2) {
      const oldest = history[0]
      const newest = history[history.length - 1]

      growth = newest.followers_count - oldest.followers_count
      if (oldest.followers_count > 0) {
        growthPercentage = ((growth / oldest.followers_count) * 100)
      }

      // Calcular crescimento de visitas ao perfil
      const totalProfileViews = history.reduce((sum, h) => sum + (h.profile_views || 0), 0)
      profileViewsGrowth = totalProfileViews
    }

    return NextResponse.json({
      history,
      publishDayEngagement: publishDayEngagement ?? [],
      summary: {
        totalSnapshots: history?.length || 0,
        currentFollowers: history?.length ? history[history.length - 1].followers_count : 0,
        growth,
        growthPercentage: Math.round(growthPercentage * 100) / 100,
        totalProfileViews: profileViewsGrowth,
        periodDays: days,
      },
    })
  } catch (error: unknown) {
    console.error('Erro ao buscar histórico:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
