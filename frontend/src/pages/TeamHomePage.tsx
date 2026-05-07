import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, apiRequest } from '../lib/api'
import { useAuth } from '../context/AuthContext'

type Analytics = {
  tasks_total: number
  tasks_by_status: Record<string, number>
  overdue_tasks: number
  projects_total: number
}

type TeamProject = {
  id: number
  name: string
  client?: { name: string }
}

type TaskRow = {
  id: number
  title: string
  status: string
  priority: string
  deadline: string | null
  description?: string | null
  instructions?: string | null
  project?: { name: string; client?: { name: string } }
}

export function TeamHomePage() {
  const { user, logout } = useAuth()
  const [tasks, setTasks] = useState<TaskRow[] | null>(null)
  const [projects, setProjects] = useState<TeamProject[] | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null)

  async function loadWorkspace() {
    let cancelled = false
    try {
      const [t, a, p] = await Promise.all([
        apiRequest<TaskRow[]>('/api/team/tasks'),
        apiRequest<Analytics>('/api/team/analytics'),
        apiRequest<TeamProject[]>('/api/team/projects'),
      ])
      if (cancelled) return
      setTasks(t)
      setAnalytics(a)
      setProjects(p)
      setError(null)
    } catch (e: unknown) {
      if (!cancelled) {
        setError(e instanceof Error ? e.message : 'Could not load workspace')
      }
    }

    return () => {
      cancelled = true
    }
  }

  useEffect(() => {
    void loadWorkspace()
  }, [])

  const grouped = useMemo(() => {
    const map: Record<string, TaskRow[]> = { todo: [], doing: [], review: [], done: [] }
    if (!tasks) return map
    for (const task of tasks) {
      const key = map[task.status] ? task.status : 'todo'
      map[key].push(task)
    }
    return map
  }, [tasks])

  async function updateTaskStatus(taskId: number, status: 'todo' | 'doing' | 'review' | 'done') {
    setSavingTaskId(taskId)
    setError(null)
    try {
      const updated = await apiRequest<TaskRow>(`/api/team/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setTasks((prev) => (prev ? prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t)) : prev))
      const a = await apiRequest<Analytics>('/api/team/analytics')
      setAnalytics(a)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update task status')
    } finally {
      setSavingTaskId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-sky-400/90">Team workspace</p>
            <p className="font-medium text-white">{user?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-slate-400 hover:text-white">Home</Link>
            <button
              type="button"
              onClick={() => void loadWorkspace()}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-white">My workspace</h1>
        <p className="mt-2 text-slate-400">
          Your assigned projects, task execution board, and personal analytics.
        </p>

        {projects ? (
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">My projects</p>
            {projects.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No project assigned yet.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {projects.map((p) => (
                  <span key={p.id} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                    {p.name}
                    {p.client ? ` · ${p.client.name}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {analytics ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="My projects" value={analytics.projects_total} />
            <MetricCard label="My tasks" value={analytics.tasks_total} />
            <MetricCard label="In progress" value={(analytics.tasks_by_status.doing ?? 0) + (analytics.tasks_by_status.review ?? 0)} />
            <MetricCard label="Overdue" value={analytics.overdue_tasks} danger={analytics.overdue_tasks > 0} />
          </div>
        ) : null}

        {error ? (
          <p className="mt-6 text-sm text-red-400">{error}</p>
        ) : tasks === null ? (
          <p className="mt-6 text-slate-500">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-slate-400">
            No tasks yet. Admin assigns projects and tasks to you.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <TaskColumn title="To Do" tasks={grouped.todo} savingTaskId={savingTaskId} onMove={(id) => void updateTaskStatus(id, 'doing')} actionLabel="Start" />
            <TaskColumn title="Doing" tasks={grouped.doing} savingTaskId={savingTaskId} onMove={(id) => void updateTaskStatus(id, 'review')} actionLabel="Send Review" />
            <TaskColumn title="Review" tasks={grouped.review} savingTaskId={savingTaskId} onMove={(id) => void updateTaskStatus(id, 'done')} actionLabel="Mark Done" />
            <TaskColumn title="Done" tasks={grouped.done} savingTaskId={savingTaskId} />
          </div>
        )}
      </main>
    </div>
  )
}

function MetricCard({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${danger ? 'text-red-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function TaskColumn({
  title,
  tasks,
  savingTaskId,
  onMove,
  actionLabel,
}: {
  title: string
  tasks: TaskRow[]
  savingTaskId: number | null
  onMove?: (taskId: number) => void
  actionLabel?: string
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-slate-500">No tasks</p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li key={t.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <p className="font-medium text-white">{t.title}</p>
              {t.project ? (
                <p className="mt-1 text-xs text-slate-500">
                  {t.project.name}
                  {t.project.client ? ` · ${t.project.client.name}` : ''}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{t.priority}</span>
                <span>{t.deadline ? `Due ${new Date(t.deadline).toLocaleDateString()}` : 'No deadline'}</span>
              </div>
              {onMove && actionLabel ? (
                <button
                  type="button"
                  disabled={savingTaskId === t.id}
                  onClick={() => onMove(t.id)}
                  className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {savingTaskId === t.id ? 'Updating…' : actionLabel}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
