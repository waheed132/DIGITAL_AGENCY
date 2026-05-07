import { useEffect, useState } from 'react'
import { BellRing, CheckCircle2, CircleDollarSign, RefreshCcw } from 'lucide-react'
import { ApiError, apiRequest } from '../../lib/api'
import type { ClientNotificationsPayload } from '../../lib/clientPortal'

const kindLabel: Record<string, string> = {
  delivery: 'Delivery',
  invoice: 'Invoice',
  revision: 'Revision',
}

const kindIcon: Record<string, typeof BellRing> = {
  delivery: BellRing,
  invoice: CircleDollarSign,
  revision: RefreshCcw,
}

export function ClientNotificationsPage() {
  const [payload, setPayload] = useState<ClientNotificationsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiRequest<ClientNotificationsPayload>('/api/client/notifications')
      setPayload(res)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'Could not load notifications')
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const items = payload?.notifications ?? []

  return (
    <section className="rounded-2xl bg-[#0c1222]/75 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.04] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-white">Notifications</h2>
          <p className="mt-1 text-sm text-slate-500">
            Delivery uploads, invoices, and revision updates from your agency.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">
          {error}
        </p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {loading && items.length === 0 ? (
          <li className="text-sm text-slate-500">Loading…</li>
        ) : items.length === 0 ? (
          <li className="text-sm text-slate-500">No notifications yet.</li>
        ) : (
          items.map((item) => {
            const Icon = kindIcon[item.kind] ?? BellRing
            return (
              <li
                key={item.id}
                className="rounded-xl bg-white/[0.03] px-3 py-3 ring-1 ring-white/[0.05]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 rounded-lg bg-white/[0.06] p-1.5 text-emerald-400/90 ring-1 ring-white/[0.08]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-100">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{item.body}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{kindLabel[item.kind] ?? item.kind}</span>
                        <span>•</span>
                        <span>{item.at}</span>
                      </div>
                    </div>
                  </div>
                  {item.unread ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-200 ring-1 ring-emerald-500/25">
                      <CheckCircle2 className="h-3 w-3" />
                      New
                    </span>
                  ) : null}
                </div>
              </li>
            )
          })
        )}
      </ul>
    </section>
  )
}
