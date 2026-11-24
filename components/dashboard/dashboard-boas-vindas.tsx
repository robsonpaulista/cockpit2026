'use client'

import { LogOut, Loader2 } from 'lucide-react'
import { TopbarBrandBlock } from '@/components/dashboard/topbar-brand-block'
import { TSE_TOKENS } from '@/components/tse/tse-tokens'
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
          'relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm',
          'px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12',
        )}
        aria-labelledby="boas-vindas-titulo"
      >
        <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center overflow-y-auto text-center">
          <TopbarBrandBlock size="lg" className="justify-center" />
          <h1
            id="boas-vindas-titulo"
            className="mt-6 text-[28px] font-bold leading-tight tracking-tight text-[var(--tse-text)] sm:text-[34px]"
          >
            Bem-vindo(a), {saudacao}.
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--tse-muted)] sm:text-[17px]">
            Sua sessão está ativa. Selecione no menu lateral o módulo que deseja consultar — painéis,
            indicadores e ferramentas liberados para o seu perfil.
          </p>

          {perfil ? (
            <p className="mt-5 text-[13px] font-semibold text-[var(--tse-text)]">
              Perfil de acesso:{' '}
              <span className="font-bold text-[var(--tse-gold-text)]">{perfil}</span>
            </p>
          ) : null}

          {semModulos ? (
            <div className="mt-6 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-left text-[13px] text-red-800">
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
