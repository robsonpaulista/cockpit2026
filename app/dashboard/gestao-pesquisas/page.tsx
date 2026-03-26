import Link from 'next/link'

export default function GestaoPesquisasPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Gestão de Pesquisas</h1>
        <p className="mt-2 text-sm text-secondary max-w-2xl">
          Questionário de campo (PI 2026) usado pelos pesquisadores no app{' '}
          <code className="rounded bg-bg-muted px-1 text-xs">/pesquisador</code>. Configure listas de
          candidatos, ordem das perguntas e itens desativados.
        </p>
      </div>
      <Link
        href="/dashboard/gestao-pesquisas/configuracoes"
        className="inline-flex rounded-xl border border-border-card bg-bg-surface px-5 py-4 text-sm font-semibold text-accent-gold shadow-card transition hover:bg-accent-gold-soft"
      >
        Abrir configurações do questionário →
      </Link>
    </div>
  )
}
