import { useEffect, useState } from 'react'
import { AlertTriangle, Users } from 'lucide-react'
import { ApiError, apiRequest } from '../../lib/api'

type Row = {
  user: { id: number; name: string; email: string; role: string }
  open_tasks: number
  overdue_tasks: number
  is_overloaded: boolean
  by_status: Record<string, number>
  next_deadlines: Array<{ id: number; title: string; deadline: string | null; status: string; project_id: number }>
}

export function WorkloadPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiRequest<Row[]>('/api/admin/workload')
        setRows(data)
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load workload')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-5 ring-1 ring-white/[0.04]">
        <div className="inline-flex items-center gap-2 text-emerald-300/90">
          <Users className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Capacity</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          See open work and overdue items per teammate—helps balance assignments before burnout shows up in deadlines.
        </p>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      {!loading && !error ? (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <div
              key={r.user.id}
              className={`rounded-2xl border p-5 ring-1 ${
                r.is_overloaded
                  ? 'border-rose-500/25 bg-rose-500/5 ring-rose-500/15'
                  : 'border-white/[0.06] bg-[#0c1222]/80 ring-white/[0.04]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">{r.user.name}</p>
                  <p className="text-[11px] text-slate-500">{r.user.role}</p>
                </div>
                {r.is_overloaded ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-200 ring-1 ring-rose-500/30">
                    <AlertTriangle className="h-3 w-3" />
                    High load
                  </span>
                ) : null}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                  <dt className="text-slate-500">Open</dt>
                  <dd className="text-lg font-semibold text-white">{r.open_tasks}</dd>
                </div>
                <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                  <dt className="text-slate-500">Overdue</dt>
                  <dd className={`text-lg font-semibold ${r.overdue_tasks > 0 ? 'text-rose-300' : 'text-slate-300'}`}>
                    {r.overdue_tasks}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] text-slate-500">
                todo {r.by_status.todo ?? 0} · doing {r.by_status.doing ?? 0} · review {r.by_status.review ?? 0} ·
                revision {r.by_status.revision ?? 0} · done {r.by_status.done ?? 0}
              </p>
              {r.next_deadlines.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-white/[0.06] pt-3 text-[11px] text-slate-400">
                  {r.next_deadlines.map((d) => (
                    <li key={d.id} className="truncate">
                      {d.title}{' '}
                      <span className="text-slate-600">
                        · {d.deadline ? new Date(d.deadline).toLocaleDateString() : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
