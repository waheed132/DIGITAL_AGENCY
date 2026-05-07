import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  FolderKanban,
  ListTodo,
  Users,
  ArrowUpRight,
  Sparkles,
  Clock,
  Receipt,
} from 'lucide-react'
import { apiRequest, ApiError } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

type StatsPayload = {
  expenses?: {
    today_total: string
    month_total: string
  }
  counts: {
    clients: number
    projects: number
    tasks_total: number
    tasks: Record<string, number>
    team_members: number
  }
  projects_by_status: Record<string, number>
  recent_tasks: Array<{
    id: number
    title: string
    status: string
    priority: string
    deadline: string | null
    project: { id: number; name: string } | null
    assignee: { id: number; name: string } | null
  }>
  recent_clients: Array<{
    id: number
    name: string
    company: string | null
    created_at: string | null
  }>
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    todo: 'To do',
    doing: 'Doing',
    review: 'Review',
    revision: 'Revision',
    done: 'Done',
  }
  return map[s] ?? s
}

function statusStyle(s: string): string {
  const map: Record<string, string> = {
    todo: 'bg-slate-500/15 text-slate-300 ring-slate-500/20',
    doing: 'bg-amber-500/15 text-amber-200 ring-amber-500/25',
    review: 'bg-violet-500/15 text-violet-200 ring-violet-500/25',
    revision: 'bg-orange-500/15 text-orange-200 ring-orange-500/25',
    done: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/25',
  }
  return map[s] ?? 'bg-slate-500/15 text-slate-300'
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isTaskOverdue(task: { deadline: string | null; status: string }): boolean {
  if (!task.deadline || task.status === 'done') return false
  const dueDay = startOfLocalDay(new Date(task.deadline))
  const today = startOfLocalDay(new Date())
  return dueDay < today
}

function badgeClassForTask(task: {
  deadline: string | null
  status: string
}): string {
  if (isTaskOverdue(task)) {
    return 'bg-red-500/15 text-red-200 ring-red-500/35'
  }
  return statusStyle(task.status)
}

function badgeLabelForTask(task: {
  deadline: string | null
  status: string
}): string {
  if (isTaskOverdue(task)) return 'Overdue'
  return statusLabel(task.status)
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<StatsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiRequest<StatsPayload>('/api/admin/dashboard/stats')
      .then((d) => {
        if (!cancelled) {
          setData(d)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Could not load dashboard')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const pipeline = useMemo(() => {
    if (!data) {
      return []
    }
    const order = ['todo', 'doing', 'review', 'done'] as const
    const total = Math.max(
      1,
      order.reduce((s, k) => s + (data.counts.tasks[k] ?? 0), 0),
    )
    return order.map((k) => ({
      key: k,
      label: statusLabel(k),
      n: data.counts.tasks[k] ?? 0,
      pct: ((data.counts.tasks[k] ?? 0) / total) * 100,
    }))
  }, [data])

  return (
    <div className="w-full space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-transparent p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
              Command center
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {greeting()}, {user?.name?.split(' ')[0] ?? 'there'}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              One place to align clients, projects, and your team — so the right
              work reaches the right people, on time.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Link
              to="/admin/tasks"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
            >
              Review tasks
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link
              to="/admin/projects"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
            >
              Open projects
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {/* KPI cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Clients"
          value={data?.counts.clients ?? '—'}
          caption="Active relationships"
          loading={!data}
          accent="from-emerald-400/20 to-transparent"
        />
        <StatCard
          icon={FolderKanban}
          label="Projects"
          value={data?.counts.projects ?? '—'}
          caption="In the pipeline"
          loading={!data}
          accent="from-cyan-400/15 to-transparent"
        />
        <StatCard
          icon={ListTodo}
          label="Tasks"
          value={data?.counts.tasks_total ?? '—'}
          caption="Total tracked work"
          loading={!data}
          accent="from-violet-400/15 to-transparent"
        />
        <StatCard
          icon={Users}
          label="Team"
          value={data?.counts.team_members ?? '—'}
          caption="Active contributors"
          loading={!data}
          accent="from-amber-400/15 to-transparent"
        />
      </section>

      {data?.expenses ? (
        <Link
          to="/admin/expenses"
          className="flex flex-col gap-3 rounded-2xl border border-cyan-500/15 bg-gradient-to-r from-cyan-950/40 to-[#0c1222]/90 p-4 ring-1 ring-cyan-500/10 transition hover:border-cyan-500/25 sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-400/20">
              <Receipt className="h-5 w-5 text-cyan-300/90" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400/90">Expenses</p>
              <p className="mt-0.5 text-sm text-slate-300">
                <span className="font-semibold tabular-nums text-white">
                  PKR {Number(data.expenses.today_total || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>{' '}
                <span className="text-slate-500">today</span>
                <span className="text-slate-600"> · </span>
                <span className="tabular-nums text-slate-400">
                  PKR {Number(data.expenses.month_total || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>{' '}
                <span className="text-slate-500">this month</span>
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-cyan-400/90 sm:shrink-0">
            View
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </span>
        </Link>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Pipeline */}
        <section className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-5 ring-1 ring-white/[0.04] backdrop-blur lg:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">Task flow</h3>
            <span className="text-xs text-slate-500">By status</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            A quick read on where work sits — from backlog to done.
          </p>
          <div className="mt-6 space-y-4">
            {data
              ? pipeline.map((row) => (
                  <div key={row.key}>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="font-medium text-slate-300">
                        {row.label}
                      </span>
                      <span className="tabular-nums text-slate-500">
                        {row.n}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500/80 to-cyan-500/60 transition-all duration-500"
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </div>
                ))
              : [1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
                    <div className="h-2 animate-pulse rounded-full bg-white/[0.06]" />
                  </div>
                ))}
          </div>
        </section>

        {/* Recent clients */}
        <section className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-5 ring-1 ring-white/[0.04] backdrop-blur lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Recent clients</h3>
            <Link
              to="/admin/clients"
              className="text-xs font-medium text-emerald-400/90 hover:text-emerald-300"
            >
              View all
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {data?.recent_clients?.length
              ? data.recent_clients.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">
                        {c.name}
                      </p>
                      {c.company ? (
                        <p className="truncate text-xs text-slate-500">
                          {c.company}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))
              : !data
                ? [1, 2, 3].map((i) => (
                    <li
                      key={i}
                      className="h-14 animate-pulse rounded-xl bg-white/[0.04]"
                    />
                  ))
                : (
                    <li className="text-sm text-slate-500">
                      No clients yet — add your first account.
                    </li>
                  )}
          </ul>
        </section>
      </div>

      {/* Recent tasks table */}
      <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 ring-1 ring-white/[0.04] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Latest tasks</h3>
            <p className="text-xs text-slate-500">
              Newest updates across projects
            </p>
          </div>
          <Link
            to="/admin/tasks"
            className="text-xs font-medium text-emerald-400/90 hover:text-emerald-300"
          >
            Manage tasks
          </Link>
        </div>
        {/* Mobile: stacked cards — no horizontal scroll */}
        <ul className="divide-y divide-white/[0.04] md:hidden">
          {data?.recent_tasks?.length
            ? data.recent_tasks.map((t) => (
                <li key={t.id} className="px-4 py-4">
                  <p className="text-[15px] font-semibold leading-snug tracking-[-0.02em] text-white">
                    {t.title}
                  </p>
                  <dl className="mt-3 space-y-2 text-[13px]">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-slate-500">Project</dt>
                      <dd className="min-w-0 text-right font-medium text-slate-300">
                        {t.project?.name ?? '—'}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-slate-500">Owner</dt>
                      <dd className="min-w-0 text-right text-slate-300">
                        {t.assignee?.name ?? (
                          <span className="text-slate-600">Unassigned</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                      <dt className="sr-only">Status</dt>
                      <dd>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${badgeClassForTask(t)}`}
                        >
                          {badgeLabelForTask(t)}
                        </span>
                      </dd>
                      <dd className="text-slate-500">
                        {t.deadline ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 opacity-60" />
                            <span>
                              Due{' '}
                              {new Date(t.deadline).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-600">No due date</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))
            : !data
              ? [1, 2, 3, 4].map((i) => (
                  <li key={i} className="px-4 py-4">
                    <div className="h-5 w-2/3 animate-pulse rounded bg-white/[0.06]" />
                    <div className="mt-3 space-y-2">
                      <div className="h-3 w-full animate-pulse rounded bg-white/[0.05]" />
                      <div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.05]" />
                    </div>
                  </li>
                ))
              : (
                  <li className="px-4 py-10 text-center text-sm text-slate-500">
                    No tasks yet — create a project and assign work.
                  </li>
                )}
        </ul>

        {/* md+: table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3 font-medium">Task</th>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Owner</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="hidden px-5 py-3 font-medium sm:table-cell">
                  Due
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {data?.recent_tasks?.length
                ? data.recent_tasks.map((t) => (
                    <tr
                      key={t.id}
                      className="transition hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-200">
                        {t.title}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {t.project?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {t.assignee?.name ?? (
                          <span className="text-slate-600">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${badgeClassForTask(t)}`}
                        >
                          {badgeLabelForTask(t)}
                        </span>
                      </td>
                      <td className="hidden px-5 py-3.5 text-slate-500 sm:table-cell">
                        {t.deadline ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 opacity-50" />
                            {new Date(t.deadline).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                : !data
                  ? [1, 2, 3, 4].map((i) => (
                      <tr key={i}>
                        <td colSpan={5} className="px-5 py-3">
                          <div className="h-4 animate-pulse rounded bg-white/[0.06]" />
                        </td>
                      </tr>
                    ))
                  : (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-10 text-center text-slate-500"
                        >
                          No tasks yet — create a project and assign work.
                        </td>
                      </tr>
                    )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  caption,
  loading,
  accent,
}: {
  icon: typeof Building2
  label: string
  value: number | string
  caption: string
  loading: boolean
  accent: string
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br ${accent} p-5 ring-1 ring-white/[0.04]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-white">
            {loading ? (
              <span className="inline-block h-9 w-12 animate-pulse rounded bg-white/[0.08]" />
            ) : (
              value
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">{caption}</p>
        </div>
        <div className="rounded-xl bg-white/[0.06] p-2.5 ring-1 ring-white/[0.06]">
          <Icon className="h-5 w-5 text-emerald-400/90" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  )
}

