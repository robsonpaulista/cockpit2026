'use client'

import { PanelLeft, LogOut, Loader2 } from 'lucide-react'
import { TSE_TOKENS } from '@/components/tse/tse-tokens'
import { APP_BRAND_MANDATO_SUBTITLE } from '@/lib/sidebar-brand-styles'
import { cn } from '@/lib/utils'

const PERFIS: Record<string, string> = {
  candidato: 'Candidato',
  coordenacao: 'Coordenação',
  comunicacao: 'Comunicação',
  articulacao: 'Articulação',
  juridico: 'Jurídico',
  bi: 'BI / Inteligência',
  pesquisadores: 'Pesquisadores',
}

function primeiroNome(name: string | undefined, email: string | undefined): string {
  if (name?.trim()) {
    const primeiro = name.trim().split(/\s+/)[0]
    return primeiro || name.trim()
  }
  if (email) return email.split('@')[0] ?? email
  return 'usuário'
}

export type DashboardBoasVindasProps = {
  nome?: string
  email?: string
  role?: string
  loading?: boolean
  semModulos?: boolean
  saindo?: boolean
  onSair?: () => void
}

/**
 * Tela inicial pós-login: saudação e orientação para navegar pelo menu lateral.
 * O card preenche toda a área útil da coluna principal.
 */
export function DashboardBoasVindas({
  nome,
  email,
  role,
  loading = false,
  semModulos = false,
  saindo = false,
  onSair,
}: DashboardBoasVindasProps) {
  const saudacao = primeiroNome(nome, email)
  const perfil = role ? PERFIS[role] ?? role : null

  if (loading) {
    return (
      <div
        className="flex h-full min-h-0 flex-1 items-center justify-center bg-[var(--tse-bg)] text-[var(--tse-text)]"
        style={TSE_TOKENS}
      >
        <p className="inline-flex items-center gap-2.5 text-sm font-semibold text-[var(--tse-muted)]" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Preparando sua sessão…
        </p>
      </div>
    )
  }

  return (
    <div
      style={TSE_TOKENS}
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-[var(--tse-bg)] p-4 text-[var(--tse-text)] sm:p-5 lg:p-6"
    >
      <section
        className={cn(
          'flex min-h-0 w-full flex-1 flex-col overflow-y-auto rounded-2xl bg-white shadow-sm',
          'px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12',
        )}
        aria-labelledby="boas-vindas-titulo"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--tse-gold-text)]">
            Cockpit X · {APP_BRAND_MANDATO_SUBTITLE}
          </p>
          <h1
            id="boas-vindas-titulo"
            className="mt-3 text-[28px] font-bold leading-tight tracking-tight text-[var(--tse-text)] sm:text-[34px]"
          >
            Bem-vindo(a), {saudacao}.
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[var(--tse-muted)] sm:text-[17px]">
            Sua sessão está ativa. Selecione no menu lateral o módulo que deseja consultar — painéis,
            indicadores e ferramentas liberados para o seu perfil.
          </p>

          {perfil ? (
            <p className="mt-5 text-[13px] font-semibold text-[var(--tse-text)]">
              Perfil de acesso:{' '}
              <span className="font-bold text-[var(--tse-gold-text)]">{perfil}</span>
            </p>
          ) : null}

          <div className="mt-8 flex gap-3 rounded-xl border border-[var(--tse-border)] bg-[var(--tse-bar)] px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--tse-yellow-soft)]">
              <PanelLeft className="h-5 w-5 text-[var(--tse-gold-text)]" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-[var(--tse-text)]">Navegação pelo menu lateral</p>
              <p className="mt-1 text-[14px] leading-relaxed text-[var(--tse-muted)]">
                Use o menu à esquerda para abrir a página desejada. O bloco de acesso rápido reúne os
                módulos mais utilizados; as demais áreas aparecem conforme as permissões da sua conta.
              </p>
            </div>
          </div>

          {semModulos ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-[13px] text-red-800">
              <p className="font-bold">Nenhum módulo liberado</p>
              <p className="mt-1 leading-relaxed">
                Sua conta ainda não possui páginas habilitadas. Solicite à coordenação o ajuste das
                permissões para continuar.
              </p>
              {onSair ? (
                <button
                  type="button"
                  onClick={onSair}
                  disabled={saindo}
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--tse-text)] px-4 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-70"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  {saindo ? 'Saindo…' : 'Encerrar sessão'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
