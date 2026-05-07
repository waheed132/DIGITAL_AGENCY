import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FolderKanban,
  PartyPopper,
  Search,
  Sparkles,
} from 'lucide-react'
import { apiRequest } from '../../lib/api'

type WorkHealth = 'overdue' | 'due_soon' | 'on_track'

type TeamProjectHub = {
  id: number
  name: string
  status: string
  deadline?: string | null
  priority?: string
  client?: { name: string } | null
  my_tasks_total?: number
  my_tasks_done?: number
  my_tasks_progress_pct?: number
  deliverables_total?: number
  deliverables_completed?: number
  deliverables_progress_pct?: number
  work_health?: WorkHealth
  needs_attention?: boolean
  project_deadline_due_today?: boolean
  has_open_work?: boolean
  next_task?: {
    id: number
    title: string
    status: string
    deadline: string | null
    context_line: string
  } | null
  signals?: {
    overdue_open_tasks: number
    due_today_open_tasks: number
    due_soon_open_tasks?: number
    revision_tasks: number
    review_tasks?: number
  }
}

/** @deprecated — kept for older responses */
type LegacyCounts = {
  tasks_count?: number
  completed_tasks_count?: number
}

function formatStatusLabel(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Readable title — avoids all-lowercase project names feeling unfinished */
function formatProjectTitle(name: string): string {
  const t = name.trim()
  if (!t) return t
  return t
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 1) return word.toUpperCase()
      const lower = word.toLowerCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

function relativeDueLine(iso: string | null): string {
  if (!iso) return 'No due date'
  const d = new Date(iso)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((d.getTime() - startToday.getTime()) / (24 * 3600 * 1000))
  if (diffDays < 0) return `Overdue (${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})`
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  if (diffDays <= 4) return `Due in ${diffDays} days`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function healthBadge(health: WorkHealth | undefined) {
  switch (health) {
    case 'overdue':
      return { label: 'Overdue', className: 'bg-red-500/15 text-red-200 ring-1 ring-red-500/35' }
    case 'due_soon':
      return { label: 'Due soon', className: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/35' }
    default:
      return { label: 'On track', className: 'bg-emerald-500/12 text-emerald-200 ring-1 ring-emerald-500/25' }
  }
}

function ProgressBar({ pct, ariaLabel, complete }: { pct: number; ariaLabel: string; complete?: boolean }) {
  const safe = Math.max(0, Math.min(100, pct))
  return (
    <div
      className="h-3 w-full overflow-hidden rounded-full bg-white/[0.06] shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.05]"
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${
          complete
            ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.25)]'
            : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400'
        }`}
        style={{ width: `${safe}%` }}
      />
    </div>
  )
}

type FilterKey = 'all' | 'active' | 'due_today' | 'attention' | 'completed'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'due_today', label: 'Due today' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'completed', label: 'Completed' },
]

export function TeamProjectsPage() {
  const [projects, setProjects] = useState<TeamProjectHub[] | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('active')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiRequest<(TeamProjectHub & LegacyCounts)[]>('/api/team/projects')
      .then((rows) => {
        setProjects(rows as TeamProjectHub[])
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load projects'))
  }, [])

  useEffect(() => {
    if (!projects?.length) return
    const hash = window.location.hash
    if (!hash.startsWith('#project-')) return
    requestAnimationFrame(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [projects])

  const filtered = useMemo(() => {
    if (!projects) return []
    const q = query.trim().toLowerCase()
    let rows = q
      ? projects.filter((p) => `${p.name} ${p.client?.name ?? ''}`.toLowerCase().includes(q))
      : projects

    const dueToday = (p: TeamProjectHub) =>
      Boolean(p.project_deadline_due_today) || (p.signals?.due_today_open_tasks ?? 0) > 0

    switch (filter) {
      case 'active':
        rows = rows.filter((p) => p.status === 'active')
        break
      case 'due_today':
        rows = rows.filter(dueToday)
        break
      case 'attention':
        rows = rows.filter((p) => p.needs_attention || p.work_health === 'overdue')
        break
      case 'completed':
        rows = rows.filter((p) => p.status === 'completed')
        break
      default:
        break
    }

    return rows
  }, [projects, query, filter])

  return (
    <div className="w-full min-w-0 space-y-7 md:space-y-9">
      <p className="w-full max-w-2xl text-pretty text-[15px] leading-relaxed text-slate-400 md:text-base">
        Your assigned work, progress, and what to open next — in one calm view.
      </p>

      <div className="flex w-full min-w-0 flex-col gap-5">
        <div className="relative w-full min-w-0">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by project or client"
            className="min-h-[48px] w-full min-w-0 rounded-2xl border border-white/[0.08] bg-[#0a0f18]/90 py-3 pl-11 pr-4 text-[15px] text-slate-100 shadow-inner shadow-black/20 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
          />
        </div>

        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
          role="tablist"
          aria-label="Filter projects"
        >
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`shrink-0 rounded-full px-4 py-2.5 text-[13px] font-medium tracking-tight transition duration-200 active:scale-[0.98] min-h-[44px] ${
                filter === key
                  ? 'border border-emerald-400/30 bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]'
                  : 'border border-white/[0.07] bg-white/[0.03] text-slate-400 hover:border-white/12 hover:bg-white/[0.06] hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {!projects ? (
        <p className="text-slate-500">Loading projects…</p>
      ) : filtered.length === 0 ? (
        <div className="w-full rounded-2xl border border-dashed border-slate-600/50 bg-gradient-to-b from-slate-900/40 to-slate-950/30 px-6 py-16 text-center ring-1 ring-white/[0.03]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 ring-1 ring-white/10">
            <FolderKanban className="h-6 w-6 text-slate-400" aria-hidden />
          </div>
          <p className="mt-4 text-[15px] font-medium text-slate-200">No projects here</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">Try another filter or clear your search.</p>
        </div>
      ) : (
        <ul className="grid w-full min-w-0 list-none gap-4 sm:gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,17.5rem),1fr))]">
          {filtered.map((p) => {
            const hb = healthBadge(p.work_health)
            const dTot = p.deliverables_total ?? 0
            const dDone = p.deliverables_completed ?? 0
            const dPct = p.deliverables_progress_pct ?? 0
            const myTot = Number(
              p.my_tasks_total ??
                ((p as LegacyCounts).tasks_count != null ? (p as LegacyCounts).tasks_count : 0) ??
                0,
            )
            const myDone = Number(
              p.my_tasks_done ??
                ((p as LegacyCounts).completed_tasks_count != null
                  ? (p as LegacyCounts).completed_tasks_count
                  : 0) ??
                0,
            )
            const myPct =
              p.my_tasks_progress_pct ??
              (myTot > 0 ? Math.round((100 * myDone) / myTot) : 0)

            const showDeliverableRow = dTot > 0
            const overdueN = p.signals?.overdue_open_tasks ?? 0
            const reviewN = p.signals?.review_tasks ?? 0
            const cancelled = p.status === 'cancelled'

            const tasksBoardUrl = `/team/tasks?project=${p.id}`
            const continueUrl = p.next_task ? `${tasksBoardUrl}&task=${p.next_task.id}` : tasksBoardUrl
            const allMyTasksComplete = myTot > 0 && myDone >= myTot
            const noAssignments = myTot === 0

            return (
              <li key={p.id} id={`project-${p.id}`} className="scroll-mt-24">
                <article
                  className={`group relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-[1.25rem] border bg-gradient-to-br from-[#101622] via-[#0c1018] to-[#080c12] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.45)] ring-1 transition duration-300 md:p-7 ${
                    cancelled
                      ? 'border-slate-800/60 opacity-60'
                      : p.work_health === 'overdue'
                        ? 'border-red-500/30 ring-red-500/15 hover:border-red-500/40'
                        : 'border-white/[0.08] ring-white/[0.04] hover:border-emerald-500/25 hover:shadow-[0_24px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(52,211,153,0.08)]'
                  }`}
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    aria-hidden
                  />
                  <div
                    className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-500/[0.07] blur-3xl transition duration-500 group-hover:bg-emerald-500/[0.11]"
                    aria-hidden
                  />

                  <div className="relative flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${hb.className}`}
                          title="Based on deadlines and revisions on your open tasks"
                        >
                          {p.work_health === 'overdue' ? (
                            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                          ) : null}
                          {hb.label}
                        </span>
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          {formatStatusLabel(p.status)}
                        </span>
                      </div>
                      <h2 className="text-[1.35rem] font-semibold leading-snug tracking-[-0.02em] text-white sm:text-[1.65rem] sm:leading-tight">
                        {formatProjectTitle(p.name)}
                      </h2>
                      <p className="text-[14px] text-slate-400">
                        {p.client?.name ? (
                          <>
                            <span className="text-slate-500">Client</span>{' '}
                            <span className="font-medium text-slate-200">{formatProjectTitle(p.client.name)}</span>
                          </>
                        ) : (
                          <span className="text-slate-500">No client linked</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="relative mt-5 min-w-0 space-y-4 lg:mt-6">
                    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] xl:items-start xl:gap-8">
                      <div className="min-w-0 space-y-4">
                        {showDeliverableRow ? (
                          <div className="min-w-0">
                            <div className="mb-2 flex items-baseline justify-between gap-2 text-[13px]">
                              <span className="font-medium text-slate-400">Deliverables</span>
                              <span className="tabular-nums text-slate-200">
                                {dDone} / {dTot}
                                <span className="ml-1.5 text-slate-500">· {dPct}%</span>
                              </span>
                            </div>
                            <ProgressBar
                              pct={dPct}
                              complete={dPct >= 100}
                              ariaLabel={`Deliverables ${dDone} of ${dTot} complete`}
                            />
                          </div>
                        ) : null}

                        <div className="min-w-0">
                          <div className="mb-2 flex items-baseline justify-between gap-2 text-[13px]">
                            <span className="font-medium text-slate-400">Your tasks</span>
                            <span className="tabular-nums text-slate-200">
                              {myDone} / {myTot}
                              {myTot > 0 ? <span className="ml-1.5 text-slate-500">· {myPct}%</span> : null}
                            </span>
                          </div>
                          <ProgressBar
                            pct={myPct}
                            complete={myTot > 0 && myPct >= 100}
                            ariaLabel={`Your tasks ${myDone} of ${myTot} complete`}
                          />
                        </div>

                        {(overdueN > 0 || reviewN > 0) && (
                          <p className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            {overdueN > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-red-200/90">
                                <span className="text-red-400" aria-hidden>
                                  ●
                                </span>
                                {overdueN} overdue task{overdueN === 1 ? '' : 's'}
                              </span>
                            ) : null}
                            {reviewN > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-amber-200/90">
                                <span className="text-amber-400" aria-hidden>
                                  ●
                                </span>
                                {reviewN} in admin review
                              </span>
                            ) : null}
                          </p>
                        )}
                      </div>

                      <div className="min-w-0 rounded-2xl border border-emerald-500/10 bg-gradient-to-b from-white/[0.04] to-transparent p-4 shadow-inner shadow-black/20 ring-1 ring-white/[0.05] lg:p-5">
                        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/90">
                          {p.next_task ? (
                            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                          ) : allMyTasksComplete ? (
                            <PartyPopper className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                          ) : (
                            <CalendarClock className="h-3.5 w-3.5 opacity-70" strokeWidth={2} aria-hidden />
                          )}
                          {p.next_task
                            ? 'Next up'
                            : allMyTasksComplete
                              ? 'All caught up'
                              : p.status === 'completed'
                                ? 'Project closed'
                                : 'Your queue'}
                        </p>
                        {p.next_task ? (
                          <>
                            <p className="mt-2.5 line-clamp-2 text-[15px] font-semibold leading-snug text-white">
                              {p.next_task.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-slate-400">
                              {p.next_task.context_line}
                            </p>
                            <p className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-emerald-500/60" aria-hidden />
                              <span className="text-slate-400">{relativeDueLine(p.next_task.deadline)}</span>
                              <span className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                {formatStatusLabel(p.next_task.status)}
                              </span>
                            </p>
                          </>
                        ) : p.status === 'completed' ? (
                          <p className="mt-3 flex gap-2.5 text-[14px] leading-relaxed text-slate-300">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400/90" aria-hidden />
                            <span>
                              This project is marked complete. Open the board anytime for files and history.
                            </span>
                          </p>
                        ) : allMyTasksComplete ? (
                          <p className="mt-3 flex gap-2.5 text-[14px] leading-relaxed text-slate-300">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400/90" aria-hidden />
                            <span>
                              You finished every task assigned to you here. Nicely done — check the board if you need
                              references or handoff notes.
                            </span>
                          </p>
                        ) : noAssignments ? (
                          <p className="mt-3 text-[14px] leading-relaxed text-slate-400">
                            No tasks are assigned to you in this project yet. When your lead adds work, it will show up
                            here and on <span className="text-slate-300">My Tasks</span>.
                          </p>
                        ) : (
                          <p className="mt-3 text-[14px] leading-relaxed text-slate-400">
                            Open the task board to see your queue for this project — your next step is there.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-6 flex min-w-0 flex-col gap-3 sm:mt-7 sm:flex-row sm:flex-wrap lg:mt-8">
                    <Link
                      to={tasksBoardUrl}
                      className="inline-flex min-h-[46px] w-full min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-slate-100 shadow-sm transition duration-200 hover:border-white/[0.14] hover:bg-white/[0.07] active:scale-[0.99] sm:w-auto sm:min-w-[10.5rem]"
                    >
                      Open board
                      <ChevronRight className="h-4 w-4 opacity-80" aria-hidden />
                    </Link>
                    <Link
                      to={continueUrl}
                      className={`inline-flex min-h-[46px] w-full min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold shadow-lg transition duration-200 active:scale-[0.99] sm:w-auto sm:min-w-[10.5rem] ${
                        allMyTasksComplete || p.status === 'completed'
                          ? 'border border-emerald-400/25 bg-gradient-to-b from-emerald-500/90 to-emerald-600 text-white shadow-emerald-900/25 hover:from-emerald-400 hover:to-emerald-500'
                          : 'border border-emerald-400/20 bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-emerald-900/30 hover:from-emerald-400 hover:to-emerald-600'
                      }`}
                    >
                      {allMyTasksComplete || p.status === 'completed' ? 'Review work' : 'Continue'}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
