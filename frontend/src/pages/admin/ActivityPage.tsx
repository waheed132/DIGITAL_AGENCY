import { useEffect, useState } from 'react'
import { Activity as ActivityIcon } from 'lucide-react'
import { ApiError, apiRequest } from '../../lib/api'

type LogRow = {
  id: number
  action: string
  subject_type: string | null
  subject_id: number | null
  properties: Record<string, unknown> | null
  created_at: string | null
  user: { id: number; name: string; email: string; role: string } | null
}

function humanizeAction(action: string): string {
  return action.replace(/\./g, ' · ')
}

export function ActivityPage() {
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiRequest<LogRow[]>('/api/admin/activity')
        setRows(data)
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load activity')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-5 ring-1 ring-white/[0.04]">
        <div className="inline-flex items-center gap-2 text-sky-300/90">
          <ActivityIcon className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Timeline</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          A running log of important changes—who did what, and when—so the team stays aligned without digging through chat.
        </p>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] py-12 text-center text-sm text-slate-500">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-sm"
            >
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-sky-500/80" />
              <div className="min-w-0 flex-1">
                <p className="text-slate-200">
                  <span className="font-medium text-white">{r.user?.name ?? 'System'}</span>{' '}
                  <span className="text-slate-500">{humanizeAction(r.action)}</span>
                </p>
                {r.created_at ? (
                  <p className="mt-1 text-[11px] text-slate-600">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
