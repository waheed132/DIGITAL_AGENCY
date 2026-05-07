import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Eye,
  ListTodo,
  PlayCircle,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react'
import { apiRequest } from '../../lib/api'

type RangeKey = 'week' | 'month' | 'all'

type FocusAlert = {
  severity: 'warning' | 'info'
  title: string
  body: string
}

type TeamAnalytics = {
  range: RangeKey
  period_label: string
  tasks_total: number
  tasks_by_status: Record<string, number>
  open_tasks?: number
  overdue_tasks: number
  projects_total: number
  done_in_period: number
  completion_rate_pct: number
  on_time_pct: number | null
  on_time_denominator: number
  weekly_activity: { date: string; label: string; count: number }[]
  chart_caption: string
  insights: string[]
  performance_tier: 'strong' | 'solid' | 'needs_attention'
  focus_alerts: FocusAlert[]
  signals?: {
    due_tomorrow: number
    due_today: number
    stuck_in_review: number
    revision_open: number
  }
}

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
]

const STATUS_ROWS: {
  key: string
  label: string
  meaning: string
  icon: typeof ListTodo
}[] = [
  { key: 'todo', label: 'To do', meaning: 'Queued — needs a start date or pick-up', icon: ListTodo },
  { key: 'doing', label: 'Doing', meaning: 'In progress — your active work', icon: PlayCircle },
  { key: 'review', label: 'Review', meaning: 'Waiting on admin approval', icon: Eye },
  { key: 'revision', label: 'Revision', meaning: 'Changes requested — fix & resubmit', icon: RefreshCw },
  { key: 'done', label: 'Done', meaning: 'Completed & off your plate', icon: CheckCircle2 },
]

function tierCopy(tier: TeamAnalytics['performance_tier']): { headline: string; sub: string; className: string } {
  switch (tier) {
    case 'needs_attention':
      return {
        headline: 'Needs improvement',
        sub: 'Overdue work or tight on-time delivery — reprioritize dates and admin follow-ups.',
        className: 'border-amber-500/30 bg-amber-500/[0.07] text-amber-100',
      }
    case 'solid':
      return {
        headline: 'On track',
        sub: 'Solid rhythm — clear reviews and revisions to stay ahead.',
        className: 'border-sky-500/25 bg-sky-500/[0.06] text-sky-100',
      }
    default:
      return {
        headline: 'Strong',
        sub: 'Healthy flow — keep shipping with the same discipline.',
        className: 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-100',
      }
  }
}

function maxBarCount(rows: { count: number }[]): number {
  const m = Math.max(0, ...rows.map((r) => r.count))
  return m > 0 ? m : 1
}

export function TeamAnalyticsPage() {
  const [range, setRange] = useState<RangeKey>('week')
  const [data, setData] = useState<TeamAnalytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, setLoading] = useState(true)

  const load = useCallback(async (opts?: { preserve?: boolean }) => {
    if (!opts?.preserve) {
      setData(null)
    }
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ range })
      const row = await apiRequest<TeamAnalytics>(`/api/team/analytics?${q.toString()}`)
      setData(row)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load analytics')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>
  }

  if (!data) {
    return (
      <div className="flex w-full min-w-0 items-center gap-3 text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
        Loading analytics…
      </div>
    )
  }

  const tier = tierCopy(data.performance_tier)
  const barMax = maxBarCount(data.weekly_activity)
  const todo = data.tasks_by_status.todo ?? 0
  const doing = data.tasks_by_status.doing ?? 0
  const review = data.tasks_by_status.review ?? 0
  const revision = data.tasks_by_status.revision ?? 0
  const open = data.open_tasks ?? todo + doing + review + revision

  return (
    <div className="w-full min-w-0 space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-slate-400">
          See how you are performing, what is due, and where to focus — not just raw counts.
        </p>
        <div className="flex flex-wrap gap-2">
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`min-h-[44px] rounded-full px-4 py-2 text-xs font-semibold transition active:scale-[0.98] ${
                range === key
                  ? 'border border-emerald-500/90 bg-emerald-600 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.18)]'
                  : 'border border-white/10 bg-slate-900/55 text-slate-400 hover:border-white/18 hover:bg-slate-800/70 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load({ preserve: true })}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/10 bg-slate-900/55 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {/* Performance summary */}
      <section className={`rounded-2xl border p-5 ring-1 ring-white/[0.04] md:p-6 ${tier.className}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/70">
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-300/90" aria-hidden />
              Your performance
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{tier.headline}</h2>
            <p className="max-w-xl text-sm leading-relaxed text-slate-300/90">{tier.sub}</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[min(100%,28rem)]">
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Done ({data.period_label})</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-white">{data.done_in_period}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Completion</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-white">{data.completion_rate_pct}%</p>
              <p className="mt-0.5 text-[10px] text-slate-500">of all assigned</p>
            </div>
            <div className="col-span-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center sm:col-span-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">On-time (with deadline)</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-white">
                {data.on_time_pct != null ? `${data.on_time_pct}%` : '—'}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {data.on_time_denominator > 0 ? `${data.on_time_denominator} task(s) in range` : 'No scored tasks'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick snapshot */}
      <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr))]">
        <Snapshot label="Active projects" value={data.projects_total} icon={Target} />
        <Snapshot label="Total assigned" value={data.tasks_total} icon={ClipboardList} />
        <Snapshot label="Open tasks" value={open} icon={ListTodo} accent={open > 0 ? 'text-slate-200' : 'text-slate-400'} />
        <Snapshot
          label="Overdue"
          value={data.overdue_tasks}
          icon={AlertTriangle}
          danger={data.overdue_tasks > 0}
        />
      </div>

      {/* Insights */}
      <section className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-5 ring-1 ring-white/[0.04] md:p-6">
        <h3 className="text-sm font-semibold text-white">What this means</h3>
        <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-300">
          {data.insights.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/80" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid w-full min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:items-start xl:gap-6">
        {/* Weekly activity */}
        <section className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-5 ring-1 ring-white/[0.04] md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">{data.chart_caption}</h3>
              <p className="mt-1 text-xs text-slate-500">Based on when tasks were last updated to Done.</p>
            </div>
          </div>
          <div className="mt-6 flex min-h-[140px] items-end justify-between gap-1.5 sm:gap-2" role="img" aria-label="Daily completions">
            {data.weekly_activity.map((d) => {
              const hPct = d.count === 0 ? 0 : Math.round((d.count / barMax) * 100)
              const barHeight = d.count === 0 ? '4px' : `${Math.max(12, hPct)}%`
              return (
                <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-28 w-full max-w-[3.25rem] flex-col justify-end sm:h-32">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-emerald-900/50 to-emerald-400/90 transition-all"
                      style={{ height: barHeight }}
                      title={`${d.count} on ${d.date}`}
                    />
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{d.label}</span>
                  <span className="text-xs font-semibold tabular-nums text-slate-300">{d.count}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Focus alerts */}
        <section className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-5 ring-1 ring-white/[0.04] md:p-6">
          <h3 className="text-sm font-semibold text-white">Focus</h3>
          <p className="mt-1 text-xs text-slate-500">Actionable items from your current assignments.</p>
          {data.focus_alerts.length === 0 ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-emerald-200/90">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              Nothing urgent here — check My Tasks for your next move.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.focus_alerts.map((a, i) => (
                <li
                  key={`${a.title}-${i}`}
                  className={`rounded-xl border px-3.5 py-3 text-sm ${
                    a.severity === 'warning'
                      ? 'border-amber-500/25 bg-amber-500/[0.06] text-amber-100'
                      : 'border-sky-500/20 bg-sky-500/[0.05] text-sky-100'
                  }`}
                >
                  <p className="font-semibold text-white">{a.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300/95">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/team/tasks"
            className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Open My Tasks
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      </div>

      {/* Status breakdown with meaning */}
      <section className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-5 ring-1 ring-white/[0.04] md:p-6">
        <h3 className="text-sm font-semibold text-white">Status breakdown</h3>
        <p className="mt-1 text-xs text-slate-500">Each stage explained — so the board matches how you actually work.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {STATUS_ROWS.map(({ key, label, meaning, icon: Icon }) => {
            const value = data.tasks_by_status[key] ?? 0
            return (
              <li
                key={key}
                className="flex min-w-0 flex-col rounded-xl border border-slate-800/90 bg-slate-950/40 px-3.5 py-3 ring-1 ring-white/[0.03]"
              >
                <div className="flex items-center gap-2 text-slate-400">
                  <Icon className="h-4 w-4 shrink-0 text-emerald-500/80" strokeWidth={1.75} aria-hidden />
                  <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
                </div>
                <p className="mt-2 text-3xl font-bold tabular-nums text-white">{value}</p>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">{meaning}</p>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function Snapshot({
  label,
  value,
  icon: Icon,
  accent,
  danger,
}: {
  label: string
  value: number
  icon: typeof Target
  accent?: string
  danger?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-800/90 bg-slate-900/45 px-4 py-3 ring-1 ring-white/[0.03]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className={`h-4 w-4 shrink-0 ${danger ? 'text-red-400' : 'text-slate-500'}`} strokeWidth={1.75} aria-hidden />
      </div>
      <p
        className={`mt-1.5 text-3xl font-bold tabular-nums tracking-tight ${danger ? 'text-red-400' : accent ?? 'text-white'}`}
      >
        {value}
      </p>
    </div>
  )
}
