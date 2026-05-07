import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, Eye, Link2, Loader2, Trash2, XCircle } from 'lucide-react'
import { ApiError, apiRequest } from '../../lib/api'

type IntakeRow = {
  id: number
  summary_brand_name: string
  contact_email: string | null
  status: 'pending' | 'rejected' | 'converted'
  client_id: number | null
  invite_id: number | null
  invite_label: string | null
  created_at: string | null
  reviewed_at: string | null
  submitted_by: { id: number; name: string; email: string } | null
}

type InviteLinkRow = {
  id: number
  token: string
  label: string | null
  expires_at: string | null
  consumed_at: string | null
  created_at: string | null
  created_by: { id: number; name: string; email: string } | null
}

type IntakeDetail = IntakeRow & {
  payload: Record<string, unknown>
  admin_note: string | null
  reviewed_by: { id: number; name: string; email: string } | null
}

export function ClientIntakesQueuePage() {
  const [rows, setRows] = useState<IntakeRow[] | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'converted' | 'rejected'>('pending')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [detail, setDetail] = useState<IntakeDetail | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [inviteLabel, setInviteLabel] = useState('')
  const [inviteDays, setInviteDays] = useState(14)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [deletingInviteId, setDeletingInviteId] = useState<number | null>(null)
  const [lastShareUrl, setLastShareUrl] = useState<string | null>(null)
  const [copyInviteState, setCopyInviteState] = useState<'idle' | 'copied'>('idle')
  const [copiedInviteRowId, setCopiedInviteRowId] = useState<number | null>(null)
  const [invites, setInvites] = useState<InviteLinkRow[] | null>(null)

  const loadInvites = useCallback(async () => {
    try {
      const data = await apiRequest<InviteLinkRow[]>('/api/admin/client-intake-invites')
      setInvites(data)
    } catch {
      setInvites([])
    }
  }, [])

  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  async function createInviteLink() {
    setCreatingInvite(true)
    setError(null)
    try {
      const r = await apiRequest<{ path: string; expires_at: string }>('/api/admin/client-intake-invites', {
        method: 'POST',
        body: JSON.stringify({
          label: inviteLabel.trim() === '' ? null : inviteLabel.trim(),
          expires_in_days: inviteDays,
        }),
      })
      const full = `${window.location.origin}${r.path}`
      setLastShareUrl(full)
      setCopyInviteState('idle')
      await loadInvites()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create link')
    } finally {
      setCreatingInvite(false)
    }
  }

  async function deleteInviteLink(invite: InviteLinkRow) {
    const name = invite.label?.trim() ? `"${invite.label}"` : 'this invite'
    const confirmed = window.confirm(`Remove ${name}? The link will stop working and disappear from this list.`)
    if (!confirmed) return

    setDeletingInviteId(invite.id)
    setError(null)
    try {
      await apiRequest(`/api/admin/client-intake-invites/${invite.id}`, { method: 'DELETE' })
      if (lastShareUrl && lastShareUrl.endsWith(`/intake/${invite.token}`)) {
        setLastShareUrl(null)
      }
      await loadInvites()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete invite')
    } finally {
      setDeletingInviteId(null)
    }
  }

  const load = useCallback(async () => {
    setError(null)
    try {
      const q = filter === 'all' ? '' : `?status=${filter}`
      const data = await apiRequest<IntakeRow[]>(`/api/admin/client-intakes${q}`)
      setRows(data)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load intakes')
      setRows([])
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  async function openDetail(id: number) {
    setError(null)
    try {
      const d = await apiRequest<IntakeDetail>(`/api/admin/client-intakes/${id}`)
      setDetail(d)
      setRejectNote('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load intake')
    }
  }

  async function approve(id: number) {
    setBusyId(id)
    setError(null)
    try {
      await apiRequest<{ client: { id: number; name: string } }>(`/api/admin/client-intakes/${id}/approve`, {
        method: 'POST',
        body: '{}',
      })
      setDetail(null)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Approve failed')
    } finally {
      setBusyId(null)
    }
  }

  async function reject(id: number) {
    setBusyId(id)
    setError(null)
    try {
      await apiRequest(`/api/admin/client-intakes/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ admin_note: rejectNote.trim() || null }),
      })
      setDetail(null)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Reject failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="mb-6 rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 ring-1 ring-white/[0.04] backdrop-blur">
        <header className="border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25">
              <Link2 className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Send a link to your client</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                They open it in a browser—no login. When they submit, the intake appears below as{' '}
                <span className="text-slate-400">pending</span>. Each link can be used once, then it closes automatically.
              </p>
            </div>
          </div>
        </header>
        <div className="space-y-4 px-5 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="block min-w-[12rem] flex-1 text-xs text-slate-400">
              Label (optional)
              <input
                value={inviteLabel}
                onChange={(e) => setInviteLabel(e.target.value)}
                placeholder="e.g. Acme — website project"
                className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
              />
            </label>
            <label className="block w-full text-xs text-slate-400 sm:w-40">
              Expires in (days)
              <select
                value={inviteDays}
                onChange={(e) => setInviteDays(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
              >
                {[7, 14, 30, 90].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={creatingInvite}
              onClick={() => void createInviteLink()}
              className="rounded-xl bg-emerald-500/90 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:shrink-0"
            >
              {creatingInvite ? 'Creating…' : 'Create link'}
            </button>
          </div>

          {lastShareUrl ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <p className="text-xs font-medium text-emerald-300/90">Copy and send this URL</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  readOnly
                  value={lastShareUrl}
                  className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 font-mono text-xs text-slate-300"
                />
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(lastShareUrl)
                    setCopyInviteState('copied')
                    window.setTimeout(() => setCopyInviteState('idle'), 2000)
                  }}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-2 text-xs font-medium text-white hover:bg-white/[0.1]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copyInviteState === 'copied' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ) : null}

          {invites && invites.length > 0 ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Recent links</p>
              <ul className="mt-3 space-y-2">
                {invites.slice(0, 8).map((inv) => {
                  const url = `${window.location.origin}/intake/${inv.token}`
                  const isUsed = Boolean(inv.consumed_at)
                  const isExpired = !isUsed && inv.expires_at != null && new Date(inv.expires_at) < new Date()
                  const badge =
                    isUsed
                      ? { label: 'Used', className: 'bg-slate-500/15 text-slate-300 ring-slate-500/25' }
                      : isExpired
                        ? { label: 'Expired', className: 'bg-amber-500/12 text-amber-200 ring-amber-500/25' }
                        : { label: 'Active', className: 'bg-emerald-500/12 text-emerald-200 ring-emerald-500/30' }
                  return (
                    <li
                      key={inv.id}
                      className="rounded-xl border border-white/[0.06] bg-[#0a101c]/80 p-3.5 ring-1 ring-white/[0.03] sm:p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-slate-100" title={inv.label || undefined}>
                              {inv.label?.trim() ? inv.label : 'Untitled invite'}
                            </p>
                            <span
                              className={[
                                'inline-flex shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
                                badge.className,
                              ].join(' ')}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <p className="truncate font-mono text-[11px] leading-relaxed text-slate-500" title={url}>
                            {url}
                          </p>
                          {inv.expires_at ? (
                            <p className="text-[11px] text-slate-600">
                              Expires {new Date(inv.expires_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(url)
                              setCopiedInviteRowId(inv.id)
                              window.setTimeout(() => setCopiedInviteRowId((id) => (id === inv.id ? null : id)), 2000)
                            }}
                            className="inline-flex min-h-[2.25rem] min-w-[5.5rem] items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 shadow-sm shadow-black/20 transition-colors hover:border-emerald-500/35 hover:bg-emerald-500/10 hover:text-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/50"
                          >
                            <Copy className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                            {copiedInviteRowId === inv.id ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            disabled={deletingInviteId === inv.id}
                            onClick={() => void deleteInviteLink(inv)}
                            aria-label={`Remove invite ${inv.label || inv.id}`}
                            className="inline-flex min-h-[2.25rem] items-center justify-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3 py-2 text-xs font-semibold text-rose-100/95 transition-colors hover:border-rose-400/40 hover:bg-rose-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400/45 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingInviteId === inv.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                            )}
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 ring-1 ring-white/[0.04] backdrop-blur">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Intake queue</h2>
            <p className="text-xs text-slate-500">Review submissions, then approve to create a client record.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'pending', 'converted', 'rejected'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-medium',
                  filter === f
                    ? 'bg-white/[0.1] text-white ring-1 ring-white/[0.12]'
                    : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.07]',
                ].join(' ')}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <Link
              to="/admin/client-intake"
              className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25"
            >
              New intake
            </Link>
          </div>
        </header>

        <div className="p-5">
          {error ? (
            <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          ) : null}

          {rows === null ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">No intakes in this filter.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{r.summary_brand_name}</p>
                    {r.contact_email ? (
                      <p className="mt-0.5 truncate text-xs text-slate-400" title={r.contact_email}>
                        {r.contact_email}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : ''} ·{' '}
                      <span
                        className={
                          r.status === 'pending'
                            ? 'text-amber-300'
                            : r.status === 'converted'
                              ? 'text-emerald-300'
                              : 'text-slate-400'
                        }
                      >
                        {r.status}
                      </span>
                      {r.invite_id ? (
                        <span className="text-slate-500">
                          {' '}
                          · Via client link{r.invite_label ? ` (${r.invite_label})` : ''}
                        </span>
                      ) : null}
                      {r.client_id ? ` · Client #${r.client_id}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void openDetail(r.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                    {r.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void approve(r.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void openDetail(r.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject…
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0b1324] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Intake #{detail.id}</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{detail.summary_brand_name}</h3>
                  {detail.contact_email ? (
                    <p className="mt-1 text-xs text-slate-400">{detail.contact_email}</p>
                  ) : null}
                  <p className="text-xs text-slate-500">
                    {detail.status} · {detail.created_at ? new Date(detail.created_at).toLocaleString() : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                  aria-label="Close"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="max-h-[55vh] overflow-auto px-5 py-4">
              <pre className="whitespace-pre-wrap break-words rounded-xl bg-black/30 p-4 text-xs text-slate-300">
                {JSON.stringify(detail.payload, null, 2)}
              </pre>
              {detail.status === 'pending' ? (
                <label className="mt-4 block text-xs text-slate-500">
                  Rejection note (optional)
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
                    placeholder="Reason if rejecting…"
                  />
                </label>
              ) : null}
              {detail.admin_note ? (
                <p className="mt-3 text-sm text-amber-300">Note: {detail.admin_note}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] px-5 py-4">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-xl border border-white/[0.12] px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.05]"
              >
                Close
              </button>
              {detail.status === 'pending' ? (
                <>
                  <button
                    type="button"
                    disabled={busyId === detail.id}
                    onClick={() => void reject(detail.id)}
                    className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={busyId === detail.id}
                    onClick={() => void approve(detail.id)}
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                  >
                    Approve &amp; create client
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
