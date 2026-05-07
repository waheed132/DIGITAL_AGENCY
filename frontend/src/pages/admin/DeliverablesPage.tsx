import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { ApiError, apiRequest } from '../../lib/api'

type ServiceOpt = {
  id: number
  name: string
  period_label: string | null
  project?: { id: number; name: string; client: { id: number; name: string } | null } | null
}

type DeliverableRow = {
  id: number
  service_id: number
  title: string
  description: string | null
  status: 'pending' | 'submitted' | 'approved'
  submission_url: string | null
  internal_notes: string | null
  submitted_at: string | null
  approved_at: string | null
  service?: ServiceOpt | null
}

const statusStyle: Record<string, string> = {
  pending: 'bg-slate-500/15 text-slate-300 ring-slate-500/25',
  submitted: 'bg-amber-500/12 text-amber-200 ring-amber-500/30',
  approved: 'bg-emerald-500/12 text-emerald-200 ring-emerald-500/30',
}

export function DeliverablesPage() {
  const [rows, setRows] = useState<DeliverableRow[]>([])
  const [services, setServices] = useState<ServiceOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    service_id: '',
    title: '',
    description: '',
    status: 'pending' as DeliverableRow['status'],
    submission_url: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [d, s] = await Promise.all([
        apiRequest<DeliverableRow[]>('/api/admin/deliverables'),
        apiRequest<Array<ServiceOpt & { project_id: number }>>('/api/admin/agency-services'),
      ])
      setRows(d)
      setServices(s)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load deliverables')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditingId(null)
    setForm({ service_id: services[0] ? String(services[0].id) : '', title: '', description: '', status: 'pending', submission_url: '' })
    setModalOpen(true)
  }

  function openEdit(d: DeliverableRow) {
    setEditingId(d.id)
    setForm({
      service_id: String(d.service_id),
      title: d.title,
      description: d.description ?? '',
      status: d.status,
      submission_url: d.submission_url ?? '',
    })
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = {
        service_id: Number(form.service_id),
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        submission_url: form.submission_url.trim() || null,
      }
      if (editingId) {
        await apiRequest(`/api/admin/deliverables/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        await apiRequest('/api/admin/deliverables', { method: 'POST', body: JSON.stringify(payload) })
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function removeRow(d: DeliverableRow) {
    if (!window.confirm(`Remove deliverable “${d.title}”?`)) return
    setBusy(true)
    try {
      await apiRequest(`/api/admin/deliverables/${d.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-5 ring-1 ring-white/[0.04]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-violet-300/90">
              <Package className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">Client outputs</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Track what you actually ship (posts, videos, links, reports)—linked to a service so clients see clear output, not only internal tasks.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            disabled={services.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-500/90 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            New deliverable
          </button>
        </div>
        {services.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
            Create a <strong className="font-semibold">service</strong> under a project first—deliverables attach to services.
          </p>
        ) : null}
      </div>

      {error ? <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-12 text-center text-sm text-slate-500">
          No deliverables yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((d) => (
            <li
              key={d.id}
              className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-4 ring-1 ring-white/[0.04]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{d.title}</p>
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${statusStyle[d.status] ?? statusStyle.pending}`}
                    >
                      {d.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {d.service?.project?.name ?? 'Project'} · {d.service?.name ?? 'Service'}
                    {d.service?.project?.client?.name ? ` · ${d.service.project.client.name}` : ''}
                  </p>
                  {d.submission_url ? (
                    <a
                      href={d.submission_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block truncate text-xs text-emerald-400/90 hover:underline"
                    >
                      {d.submission_url}
                    </a>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(d)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.08]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeRow(d)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#0b1324] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">{editingId ? 'Edit deliverable' : 'New deliverable'}</h3>
            <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
              <label className="block text-xs text-slate-400">
                Service *
                <select
                  required
                  value={form.service_id}
                  onChange={(e) => setForm((f) => ({ ...f, service_id: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.project?.name ?? 'Project'} — {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-400">
                Title *
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. 10 Instagram posts"
                  className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
                />
              </label>
              <label className="block text-xs text-slate-400">
                Description
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
                />
              </label>
              <label className="block text-xs text-slate-400">
                Status
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DeliverableRow['status'] }))}
                  className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
                >
                  <option value="pending">Pending</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                </select>
              </label>
              <label className="block text-xs text-slate-400">
                Link (Drive, live URL, Loom…)
                <input
                  value={form.submission_url}
                  onChange={(e) => setForm((f) => ({ ...f, submission_url: e.target.value }))}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-white/[0.1] px-4 py-2 text-sm text-slate-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
