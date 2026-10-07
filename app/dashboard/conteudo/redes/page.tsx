'use client'

import { useState } from 'react'
import { ConteudoRedesShell, type ConteudoRedesTab } from '@/components/conteudo-redes/conteudo-redes-shell'
import { RedesAudienciaTab } from '@/components/conteudo-redes/redes-audiencia-tab'
import { RedesCidadesTab } from '@/components/conteudo-redes/redes-cidades-tab'
import { RedesPostsTab } from '@/components/conteudo-redes/redes-posts-tab'
import { TseCarregando, TseErro, TseVazio } from '@/components/tse/tse-ui'
import { useInstagramRedes } from '@/hooks/use-instagram-redes'

export default function ConteudoRedesPage() {
  const [aba, setAba] = useState<ConteudoRedesTab>('posts')
  const redes = useInstagramRedes()
  const { metrics, loading, error, conectado } = redes

  return (
    <ConteudoRedesShell
      activeTab={aba}
      onTabChange={setAba}
      dateRange={redes.dateRange}
      onDateRangeChange={redes.setDateRange}
      username={metrics?.username}
      seguidores={metrics?.followers?.total}
      publicacoes={redes.postsPeriodo.length}
      loading={loading}
      onAtualizar={redes.atualizar}
    >
      {error ? (
        <div className="mb-4">
          <TseErro>
            <strong>Erro ao carregar dados do Instagram.</strong> {error}
          </TseErro>
        </div>
      ) : null}

      {loading && !conectado ? (
        <TseCarregando texto="Carregando dados do Instagram…" />
      ) : !conectado ? (
        <TseVazio>
          Não foi possível carregar o Instagram pelo servidor. As credenciais ficam em INSTAGRAM_TOKEN no ambiente
          (Vercel / .env.local) — ninguém precisa colar o token.
        </TseVazio>
      ) : aba === 'audience' ? (
        <RedesAudienciaTab redes={redes} />
      ) : aba === 'locations' ? (
        <RedesCidadesTab redes={redes} />
      ) : (
        <RedesPostsTab redes={redes} />
      )}
    </ConteudoRedesShell>
  )
}
