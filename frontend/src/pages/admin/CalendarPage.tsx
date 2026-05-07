import { useEffect, useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { ApiError, apiRequest } from '../../lib/api'

type CalTask = {
  id: number
  title: string
  status: string
  deadline: string | null
  is_overdue: boolean
  project?: { id: number; name: string } | null
  assignee?: { id: number; name: string } | null
  agency_service?: { id: number; name: string; period_label: string | null } | null
}

function weekRange(): { from: string; to: string } {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay())
  const end = new Date(start)
  end.setDate(start.getDate() + 13)
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

export function CalendarPage() {
  const initial = useMemo(() => weekRange(), [])
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [rows, setRows] = useState<CalTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const q = new URLSearchParams({ from, to })
        const data = await apiRequest<CalTask[]>(`/api/admin/calendar/tasks?${q.toString()}`)
        setRows(data)
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load calendar')
      } finally {
        setLoading(false)
      }
    })()
  }, [from, to])

  const byDay = useMemo(() => {
    const map: Record<string, CalTask[]> = {}
    for (const t of rows) {
      if (!t.deadline) continue
      const day = t.deadline.slice(0, 10)
      if (!map[day]) map[day] = []
      map[day].push(t)
    }
    return map
  }, [rows])

  const days = Object.keys(byDay).sort()

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-5 ring-1 ring-white/[0.04]">
        <div className="inline-flex items-center gap-2 text-cyan-300/90">
          <CalendarDays className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Schedule</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          See tasks with due dates in your chosen range—plan the week and spot overdue work before it slips.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="text-xs text-slate-500">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="text-xs text-slate-500">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
            />
          </label>
        </div>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      {!loading && days.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] py-12 text-center text-sm text-slate-500">
          No deadlines in this range.
        </p>
      ) : null}

      <div className="space-y-6">
        {days.map((day) => (
          <section key={day}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {new Date(day + 'T12:00:00').toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </h3>
            <ul className="space-y-2">
              {byDay[day].map((t) => (
                <li
                  key={t.id}
                  className={`rounded-xl border px-4 py-3 text-sm ring-1 ${
                    t.is_overdue
                      ? 'border-rose-500/25 bg-rose-500/5 ring-rose-500/15'
                      : 'border-white/[0.06] bg-white/[0.02] ring-white/[0.04]'
                  }`}
                >
                  <p className="font-medium text-white">{t.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t.project?.name ?? 'Project'} · {t.assignee?.name ?? 'Unassigned'}
                    {t.agency_service ? ` · ${t.agency_service.name}` : ''} ·{' '}
                    <span className="text-slate-400">{t.status}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
