import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { apiRequest } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useTeamProfileAvatar } from '../../lib/teamProfile'

type Analytics = {
  tasks_total: number
  tasks_by_status: Record<string, number>
  overdue_tasks: number
  projects_total: number
}

type TaskRow = {
  id: number
  project_id?: number
  title: string
  status: string
  priority: string
  deadline: string | null
  project?: { name: string; client?: { name: string } }
}

type ActivityItem = {
  id: number
  action: string
  subject_id: number | null
  properties: { title?: string; project_id?: number } | null
  created_at: string | null
  user: { id: number; name: string; email: string; role: string } | null
}

type DueBuckets = { overdue: TaskRow[]; today: TaskRow[]; upcoming: TaskRow[] }

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function compareDeadline(a: TaskRow, b: TaskRow): number {
  if (!a.deadline && !b.deadline) return 0
  if (!a.deadline) return 1
  if (!b.deadline) return -1
  return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
}

function groupTasksByDue(tasks: TaskRow[] | null): DueBuckets {
  const buckets: DueBuckets = { overdue: [], today: [], upcoming: [] }
  if (!tasks) return buckets

  const now = new Date()
  const todayStart = startOfLocalDay(now)

  for (const t of tasks) {
    if (t.status === 'done') continue
    if (!t.deadline) {
      buckets.upcoming.push(t)
      continue
    }
    const raw = new Date(t.deadline)
    const dayStart = startOfLocalDay(raw)
    if (dayStart.getTime() < todayStart.getTime()) buckets.overdue.push(t)
    else if (dayStart.getTime() === todayStart.getTime()) buckets.today.push(t)
    else buckets.upcoming.push(t)
  }

  buckets.overdue.sort(compareDeadline)
  buckets.today.sort(compareDeadline)
  buckets.upcoming.sort(compareDeadline)
  return buckets
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    todo: 'To do',
    doing: 'In progress',
    review: 'In review',
    revision: 'Revision',
    done: 'Done',
  }
  return map[status] ?? status
}

function formatActivityLine(row: ActivityItem): string {
  const title = row.properties?.title
  const actor = row.user?.role === 'admin' ? 'Admin' : row.user?.name ?? 'Someone'
  if (row.action === 'task.revision_requested') {
    return title ? `${actor} requested revision on “${title}”` : `${actor} requested a revision`
  }
  if (row.action === 'task.approved') {
    return title ? `${actor} approved “${title}”` : `${actor} approved a task`
  }
  return row.action.replace(/\./g, ' ')
}

function isHighPriority(task: TaskRow): boolean {
  return String(task.priority).toLowerCase() === 'high'
}

function pickFocusTask(tasks: TaskRow[] | null): TaskRow | null {
  if (!tasks) return null
  const open = tasks.filter((t) => t.status !== 'done')
  if (open.length === 0) return null
  const today = startOfLocalDay(new Date())
  const ranked = [...open].sort((a, b) => {
    const ad = a.deadline ? startOfLocalDay(new Date(a.deadline)) : null
    const bd = b.deadline ? startOfLocalDay(new Date(b.deadline)) : null
    const aOverdue = ad ? ad.getTime() < today.getTime() : false
    const bOverdue = bd ? bd.getTime() < today.getTime() : false
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
    const aToday = ad ? ad.getTime() === today.getTime() : false
    const bToday = bd ? bd.getTime() === today.getTime() : false
    if (aToday !== bToday) return aToday ? -1 : 1
    if (isHighPriority(a) !== isHighPriority(b)) return isHighPriority(a) ? -1 : 1
    return compareDeadline(a, b)
  })
  return ranked[0] ?? null
}

function greetingByTime(name: string | null | undefined): string {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  if (!name) return part
  const first = name.trim().split(/\s+/)[0]
  return `${part}, ${first}`
}

function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function TeamDashboardPage() {
  const { user } = useAuth()
  const avatar = useTeamProfileAvatar()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [tasks, setTasks] = useState<TaskRow[] | null>(null)
  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadDashboard() {
    setLoading(true)
    setError(null)

    try {
      const [a, t, act] = await Promise.all([
        apiRequest<Analytics>('/api/team/analytics'),
        apiRequest<TaskRow[]>('/api/team/tasks'),
        apiRequest<ActivityItem[]>('/api/team/activity'),
      ])
      setAnalytics(a)
      setTasks(t)
      setActivity(act)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const dueBuckets = useMemo(() => groupTasksByDue(tasks), [tasks])
  const focusTask = useMemo(() => pickFocusTask(tasks), [tasks])
  const inReviewCount = analytics?.tasks_by_status.review ?? 0
  const focusCount = (dueBuckets.today.length + dueBuckets.overdue.length + inReviewCount)
  const greeting = greetingByTime(user?.name)
  const heroSubtext = `You have ${focusCount} task${focusCount === 1 ? '' : 's'} to focus on today`

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-[#0c1222]/75 px-5 py-5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.04] sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">{greeting}</h2>
            <p className="mt-1 text-sm text-slate-400">{heroSubtext}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Sync
            </button>
            <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-900 ring-1 ring-white/[0.1]">
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-300">
                  {initials(user?.name)}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <PriorityCard task={focusTask} loading={loading} />

      <section className="rounded-2xl bg-[#0c1222]/72 p-5 ring-1 ring-white/[0.04] sm:p-6">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Today Summary</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <TaskCard label="Due today" value={dueBuckets.today.length} tone="text-amber-200" />
          <TaskCard label="Overdue" value={dueBuckets.overdue.length} tone="text-rose-300" />
          <TaskCard label="In review" value={inReviewCount} tone="text-sky-200" />
        </ul>
      </section>

      <section className="rounded-2xl bg-[#0c1222]/70 p-5 ring-1 ring-white/[0.04] sm:p-6">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recent Activity</h3>
        <div className="mt-3 space-y-2.5">
          {!activity ? (
            <p className="text-sm text-slate-500">Loading activity…</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-slate-500">No recent updates yet.</p>
          ) : (
            activity.slice(0, 4).map((row) => (
              <ActivityItem key={row.id} line={formatActivityLine(row)} at={row.created_at} />
            ))
          )}
        </div>
      </section>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  )
}

function PriorityCard({ task, loading }: { task: TaskRow | null; loading: boolean }) {
  if (loading && !task) {
    return (
      <section className="rounded-2xl bg-[#0f172a]/80 p-6 ring-1 ring-white/[0.05]">
        <p className="text-sm text-slate-500">Loading priority task…</p>
      </section>
    )
  }
  if (!task) {
    return (
      <section className="rounded-2xl bg-[#0f172a]/80 p-6 ring-1 ring-white/[0.05]">
        <p className="text-sm text-slate-400">No priority task right now.</p>
        <p className="mt-1 text-xs text-slate-500">You are all caught up for the moment.</p>
      </section>
    )
  }

  const statusText = statusLabel(task.status)
  const dueText = task.deadline
    ? `Due ${new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : 'No due date'

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0b1220_0%,#0f1f2f_60%,#0e2a2a_100%)] p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_18px_36px_rgba(0,0,0,0.32)] transition md:hover:-translate-y-0.5 md:hover:shadow-[0_0_0_1px_rgba(16,185,129,0.22),0_22px_42px_rgba(0,0,0,0.34)] sm:p-6">
      <p className="text-[1.9rem] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[2rem]">{task.title}</p>
      <p className="mt-1.5 text-base text-slate-300">{task.project?.client?.name ?? task.project?.name ?? 'Client not linked'}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-300/75">Priority task</p>
      <p className="mt-3 text-sm text-slate-300">{statusText} • {dueText}</p>
      <Link
        to={`/team/tasks#task-${task.id}`}
        className="mt-5 inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400"
      >
        Continue →
      </Link>
    </section>
  )
}

function TaskCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: string
}) {
  return (
    <li className="flex items-center justify-between rounded-xl bg-slate-900/45 px-3.5 py-2.5">
      <p className="text-sm text-slate-300">{label}</p>
      <p className={`text-sm font-semibold ${tone}`}>
        {value}
      </p>
    </li>
  )
}

function ActivityItem({
  line,
  at,
}: {
  line: string
  at: string | null
}) {
  return (
    <article className="flex items-start justify-between gap-3 rounded-xl bg-slate-900/45 px-3.5 py-2.5">
      <p className="text-sm text-slate-200">{line}</p>
      <time className="shrink-0 text-xs text-slate-500">{at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time>
    </article>
  )
}
