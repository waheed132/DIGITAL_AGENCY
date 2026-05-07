import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useClientPortal } from '../../context/ClientPortalContext'

function formatPkr(amount: number): string {
  return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function healthBadge(health: 'on_track' | 'at_risk'): { label: string; className: string } {
  if (health === 'at_risk') {
    return { label: 'Status: Needs attention', className: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/25' }
  }
  return { label: 'Status: On Track', className: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/20' }
}

export function ClientDashboardPage() {
  const { user } = useAuth()
  const { dashboard, loading, error, refresh } = useClientPortal()

  const project = dashboard?.primary_project
  const stats = dashboard?.stats
  const billing = dashboard?.billing

  const pendingItems = stats?.pending_items ?? 0
  const projectHref =
    project?.id != null ? `/client/projects/${project.id}` : '/client/project'

  const hb = healthBadge(stats?.health === 'at_risk' ? 'at_risk' : 'on_track')

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-[#0c1222]/75 px-5 py-5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.04] sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Welcome back</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-white">
              {user?.name ?? 'Client'} 👋
            </h2>
            <p className="mt-2 text-sm text-slate-400">{project?.name ?? 'Your projects'}</p>
            {project?.service_label ? (
              <p className="mt-1 text-xs text-slate-500">{project.service_label}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-medium ${hb.className}`}>{hb.label}</span>
          {dashboard?.next_delivery ? (
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 font-medium text-slate-300 ring-1 ring-white/[0.06]">
              Next delivery: {dashboard.next_delivery}
            </span>
          ) : (
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 font-medium text-slate-400 ring-1 ring-white/[0.06]">
              No upcoming deadline scheduled
            </span>
          )}
        </div>
      </section>

      {error ? (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/20">{error}</p>
      ) : null}

      {!dashboard && !loading && !error ? (
        <p className="text-sm text-slate-500">No dashboard data.</p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl bg-[#0c1222]/72 p-5 ring-1 ring-white/[0.04] sm:p-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Project Progress</h3>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-white">
            {stats?.completed_items ?? '—'} / {stats?.total_items ?? '—'}
          </p>
          <p className="text-sm text-slate-500">completed</p>
          <div className="mt-3 h-2.5 rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-500/90"
              style={{
                width:
                  stats && stats.total_items > 0
                    ? `${Math.round((stats.completed_items / stats.total_items) * 100)}%`
                    : '0%',
              }}
            />
          </div>
        </article>

        <article className="rounded-2xl bg-[#0c1222]/72 p-5 ring-1 ring-white/[0.04] sm:p-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Billing Summary</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Total</span>
              <span className="font-medium text-white">{billing ? formatPkr(billing.total) : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Paid</span>
              <span className="font-medium text-emerald-300">
                {billing ? formatPkr(billing.paid) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Remaining</span>
              <span className="font-medium text-amber-200/95">
                {billing ? formatPkr(billing.remaining) : '—'}
              </span>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl bg-[#0c1222]/72 p-5 ring-1 ring-white/[0.04] sm:p-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recent Deliveries</h3>
          <ul className="mt-3 space-y-2">
            {(dashboard?.recent_deliveries?.length ?? 0) === 0 ? (
              <li className="text-sm text-slate-500">No completed items yet.</li>
            ) : (
              dashboard?.recent_deliveries.map((d, idx) => (
                <li
                  key={`${d.title}-${idx}`}
                  className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm ring-1 ring-white/[0.04]"
                >
                  <span className="text-slate-200">{d.title}</span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-200 ring-1 ring-emerald-500/20">
                    Completed
                  </span>
                </li>
              ))
            )}
          </ul>
        </article>

        <article className="rounded-2xl bg-[#0c1222]/72 p-5 ring-1 ring-white/[0.04] sm:p-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pending Work</h3>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-white">{pendingItems}</p>
          <p className="text-sm text-slate-500">items in progress</p>
          <Link
            to={projectHref}
            className="mt-4 inline-flex rounded-lg bg-white/[0.08] px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/[0.12] transition hover:bg-white/[0.12]"
          >
            Open project view
          </Link>
        </article>
      </section>
    </div>
  )
}
