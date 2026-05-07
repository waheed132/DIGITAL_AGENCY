import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, apiRequest, openProtectedFile } from '../../lib/api'
import type { ClientProjectDetailPayload } from '../../lib/clientPortal'

function fmtPkr(amount: number): string {
  return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function ClientProjectPage() {
  const { id } = useParams()
  const [data, setData] = useState<ClientProjectDetailPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const pid = id ?? ''

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await apiRequest<ClientProjectDetailPayload>(`/api/client/projects/${pid}`)
        if (!cancelled) setData(res)
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof ApiError ? e.message : 'Could not load project'
          setError(msg)
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading && !data) {
    return (
      <div className="rounded-2xl bg-[#0c1222]/72 p-8 ring-1 ring-white/[0.04]">
        <p className="text-sm text-slate-500">Loading project…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-red-500/10 px-4 py-4 text-sm text-red-300 ring-1 ring-red-500/20">
        {error ?? 'Project not found.'}
      </div>
    )
  }

  const { project, deliverables, invoices, feedback } = data

  const statusLabel =
    project.status === 'active'
      ? { text: 'Active', className: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/25' }
      : { text: project.status, className: 'bg-white/[0.08] text-slate-200 ring-white/[0.1]' }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-[#0c1222]/75 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.04] sm:p-6">
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">{project.name}</h2>
        <p className="mt-1 text-sm text-slate-400">
          {project.service_label} · {project.total_items} items · {project.completed_items} completed
        </p>
        <div className="mt-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusLabel.className}`}
          >
            Status: {statusLabel.text}
          </span>
        </div>
      </section>

      <section className="rounded-2xl bg-[#0c1222]/72 p-5 ring-1 ring-white/[0.04] sm:p-6">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Deliverables</h3>
        <ul className="mt-3 space-y-2">
          {deliverables.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm ring-1 ring-white/[0.04]"
            >
              <div>
                <p className="font-medium text-slate-100">{item.title}</p>
                <p className="text-xs text-slate-500">
                  {item.service_name ? `${item.service_name} · ` : null}
                  {item.due_label}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                    item.is_complete
                      ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/25'
                      : 'bg-amber-500/15 text-amber-200 ring-amber-500/25'
                  }`}
                >
                  {item.status_label}
                </span>
                {item.preview_url ? (
                  <a
                    href={item.preview_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-xs text-slate-200 transition hover:bg-white/[0.08]"
                  >
                    View
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl bg-[#0c1222]/72 p-5 ring-1 ring-white/[0.04] sm:p-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Billing</h3>
          <ul className="mt-3 space-y-2">
            {invoices.length === 0 ? (
              <li className="text-sm text-slate-500">No invoices yet.</li>
            ) : (
              invoices.map((invoice) => (
                <li
                  key={invoice.id}
                  className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm ring-1 ring-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-100">Invoice #{invoice.number}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                        invoice.status === 'paid'
                          ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/25'
                          : 'bg-amber-500/15 text-amber-200 ring-amber-500/25'
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {fmtPkr(invoice.amount)} · {invoice.issued_at}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void openProtectedFile(invoice.pdf_url)}
                      className="rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-xs text-slate-200 transition hover:bg-white/[0.08]"
                    >
                      View PDF
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </article>

        <article className="rounded-2xl bg-[#0c1222]/72 p-5 ring-1 ring-white/[0.04] sm:p-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Feedback</h3>
          {feedback.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No messages yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {feedback.map((comment) => (
                <li
                  key={comment.id}
                  className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm ring-1 ring-white/[0.04]"
                >
                  <p className="font-medium text-slate-200">
                    {comment.author === 'client' ? 'You' : 'Agency'}
                  </p>
                  <p className="mt-1 text-slate-300">{comment.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{comment.at}</p>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/client/notifications"
            className="mt-4 inline-flex text-sm font-medium text-emerald-300/90 hover:text-emerald-200"
          >
            See updates in notifications →
          </Link>
        </article>
      </section>
    </div>
  )
}
