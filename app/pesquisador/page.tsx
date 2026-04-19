'use client'

import { PesquisadorProtectedRoute } from '@/components/pesquisador-protected-route'
import { FieldSurveyApp } from '@/components/field-survey/FieldSurveyApp'
import { useAuth } from '@/hooks/use-auth'
import { LogOut } from 'lucide-react'

export default function PesquisadorPage() {
  return (
    <PesquisadorProtectedRoute>
      <PesquisadorPageInner />
    </PesquisadorProtectedRoute>
  )
}

function PesquisadorPageInner() {
  const { user, signOut } = useAuth()
  const hint =
    user?.profile?.name?.trim() ||
    user?.email?.split('@')[0]?.slice(0, 12) ||
    ''

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-orange-700 dark:text-orange-400">
            Questionário PI 2026
          </p>
          <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut().then(() => (window.location.href = '/pesquisador/login'))}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium dark:border-zinc-600"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </header>
      <FieldSurveyApp defaultInterviewerHint={hint} />
    </>
  )
}
