import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ExternalLink, Loader2, MessageSquareWarning, SplitSquareHorizontal, X } from 'lucide-react'
import { ApiError, apiRequest, fetchProtectedBlob, openProtectedFile } from '../../lib/api'

type AttachmentItem = {
  id: number
  original_name: string
  url: string
  mime_type?: string | null
}

type TaskRow = {
  id: number
  title: string
  status: string
  instructions?: string | null
  submission_link?: string | null
  submission_notes?: string | null
  submitted_at?: string | null
  admin_feedback?: string | null
  attachments?: AttachmentItem[]
  project?: { id: number; name: string; client?: { name: string } | null } | null
  assignee?: { id: number; name: string } | null
  agency_service?: { id: number; name: string; period_label: string | null } | null
}

type PreviewKind = 'image' | 'video' | 'pdf' | 'other'

function previewKind(mime: string | null | undefined, file: string): PreviewKind {
  const m = (mime ?? '').toLowerCase()
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  if (m.startsWith('image/') || /^(png|jpe?g|gif|webp|bmp|svg)$/.test(ext)) return 'image'
  if (m.startsWith('video/') || /^(mp4|mov|webm|avi|mkv)$/.test(ext)) return 'video'
  if (m.includes('pdf') || ext === 'pdf') return 'pdf'
  return 'other'
}

function unitLabel(title: string, serviceName?: string | null): string {
  const m = /(\d+)\s*$/.exec(title)
  if (!m) return title
  return `${serviceName ?? 'Item'} #${m[1]}`
}

function parseDeliverableInfo(task: TaskRow): string {
  const source = `${task.title}\n${task.instructions ?? ''}`
  const m = /deliverable\s+(\d+)\s+of\s+(\d+)/i.exec(source)
  if (m) return `Deliverable ${m[1]} of ${m[2]}`
  const tail = /(\d+)\s*$/.exec(task.title)
  if (tail) return `Deliverable ${tail[1]}`
  return 'Deliverable'
}

function timeLabel(iso: string | null | undefined): string {
  if (!iso) return 'Unknown time'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Unknown time'
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  return isToday
    ? `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function useObjectUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!path) {
      setUrl(null)
      setLoading(false)
      setError(false)
      return
    }
    let revoke: string | null = null
    let cancelled = false
    setLoading(true)
    setError(false)
    void fetchProtectedBlob(path).then(
      (blob) => {
        if (cancelled) return
        revoke = URL.createObjectURL(blob)
        setUrl(revoke)
        setLoading(false)
      },
      () => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [path])

  return { url, loading, error }
}

function LargePreview({ file }: { file: AttachmentItem | null }) {
  const kind = file ? previewKind(file.mime_type, file.original_name) : 'other'
  const { url, loading, error } = useObjectUrl(file?.url ?? null)
  if (!file) return null

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-white/[0.08] bg-black/25 text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading preview...
      </div>
    )
  }
  if (error || !url) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-black/25 p-4 text-sm text-slate-400">
        Preview unavailable.{' '}
        <button className="text-emerald-300 underline" onClick={() => void openProtectedFile(file.url)} type="button">
          Open file
        </button>
      </div>
    )
  }
  if (kind === 'image') {
    return <img src={url} alt={file.original_name} className="h-72 w-full rounded-xl object-contain bg-black/40" />
  }
  if (kind === 'video') {
    return (
      <div className="relative h-72 w-full overflow-hidden rounded-xl bg-black">
        <video src={url} muted className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-xl" aria-hidden />
        <video src={url} controls className="relative h-full w-full object-contain" />
      </div>
    )
  }
  if (kind === 'pdf') {
    return (
      <div className="space-y-2">
        <iframe title={file.original_name} src={url} className="h-72 w-full rounded-xl bg-white" />
        <button
          type="button"
          onClick={() => void openProtectedFile(file.url)}
          className="inline-flex items-center gap-1 rounded-md border border-white/[0.12] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/[0.06]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open full PDF
        </button>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => void openProtectedFile(file.url)}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.12] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/[0.06]"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      Open file
    </button>
  )
}

export function ApprovalsPage() {
  const [rows, setRows] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [feedbackOpenId, setFeedbackOpenId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [splitView, setSplitView] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedFileIndex, setSelectedFileIndex] = useState<Record<number, number>>({})
  const itemRefs = useRef<Record<number, HTMLLIElement | null>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<TaskRow[]>('/api/admin/approvals')
      setRows(data)
      setActiveIndex((prev) => Math.max(0, Math.min(prev, Math.max(0, data.length - 1))))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load queue')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function goTo(index: number) {
    const next = Math.max(0, Math.min(index, rows.length - 1))
    setActiveIndex(next)
    const id = rows[next]?.id
    if (id && itemRefs.current[id]) {
      itemRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  async function approve(id: number) {
    setBusyId(id)
    setError(null)
    try {
      await apiRequest(`/api/admin/approvals/${id}/approve`, { method: 'POST', body: '{}' })
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Approve failed')
    } finally {
      setBusyId(null)
    }
  }

  async function sendRevision(id: number) {
    const text = feedback.trim()
    if (!text) {
      setError('Add feedback before sending revision.')
      return
    }
    setBusyId(id)
    setError(null)
    try {
      await apiRequest(`/api/admin/approvals/${id}/revision`, {
        method: 'POST',
        body: JSON.stringify({ admin_feedback: text }),
      })
      setFeedbackOpenId(null)
      setFeedback('')
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not request revision')
    } finally {
      setBusyId(null)
    }
  }

  async function returnToDoing(id: number) {
    if (
      !window.confirm(
        'Return this task to Doing? The assignee can redo the work and submit again when ready.',
      )
    ) {
      return
    }
    setBusyId(id)
    setError(null)
    try {
      await apiRequest(`/api/admin/approvals/${id}/return-to-doing`, { method: 'POST', body: '{}' })
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not return task to Doing')
    } finally {
      setBusyId(null)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (feedbackOpenId) return
      const active = rows[activeIndex]
      if (!active) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goTo(activeIndex - 1)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goTo(activeIndex + 1)
        return
      }
      if (e.key.toLowerCase() === 'a') {
        const hasSubmission =
          (active.attachments?.length ?? 0) > 0 || Boolean((active.submission_link ?? '').trim())
        if (!hasSubmission) return
        e.preventDefault()
        void approve(active.id)
        return
      }
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        setFeedbackOpenId(active.id)
        setFeedback(active.admin_feedback ?? '')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows, activeIndex, feedbackOpenId])

  const versionById = useMemo(() => {
    const m: Record<number, number> = {}
    rows.forEach((r) => {
      m[r.id] = (r.admin_feedback ?? '').trim() ? 2 : 1
    })
    return m
  }, [rows])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-5 ring-1 ring-white/[0.04]">
        <div className="inline-flex items-center gap-2 text-amber-200/90">
          <MessageSquareWarning className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Approvals</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">Team submissions waiting for your review.</p>
        {rows.length > 1 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => goTo(activeIndex - 1)} className="rounded-md border border-white/[0.12] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]">
              ← Previous
            </button>
            <button type="button" onClick={() => goTo(activeIndex + 1)} className="rounded-md border border-white/[0.12] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]">
              Next →
            </button>
            <span className="text-xs text-slate-500">{activeIndex + 1} / {rows.length}</span>
            <button type="button" onClick={() => setSplitView((v) => !v)} className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/[0.12] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]">
              <SplitSquareHorizontal className="h-3.5 w-3.5" />
              {splitView ? 'Stacked view' : 'Split view'}
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-white/[0.08] bg-[#0c1222]/80 p-5">
              <div className="h-4 w-48 rounded bg-white/[0.08]" />
              <div className="mt-3 grid gap-4 lg:grid-cols-[35%_65%]">
                <div className="h-36 rounded-xl bg-white/[0.06]" />
                <div className="h-36 rounded-xl bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 py-12 text-center">
          <p className="text-lg font-semibold text-emerald-200">All caught up</p>
          <p className="mt-1 text-sm text-slate-400">No pending approvals right now.</p>
        </div>
      ) : (
        <ul className="space-y-5">
          {rows.map((t, idx) => {
            const files = t.attachments ?? []
            const selectedIdx = Math.min(selectedFileIndex[t.id] ?? 0, Math.max(0, files.length - 1))
            const selected = files[selectedIdx] ?? null
            const hasSubmission = files.length > 0 || Boolean((t.submission_link ?? '').trim())
            return (
              <li
                key={t.id}
                ref={(el) => {
                  itemRefs.current[t.id] = el
                }}
                className={`rounded-2xl border p-5 ring-1 transition ${
                  idx === activeIndex
                    ? 'border-amber-400/30 bg-[#0d1527] ring-amber-500/20'
                    : 'border-white/[0.08] bg-[#0c1222]/90 ring-white/[0.05]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-white">{unitLabel(t.title, t.agency_service?.name)}</p>
                    <p className="mt-1 text-xs text-slate-400">{parseDeliverableInfo(t)} • {t.agency_service?.name ?? 'Item'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Project: {t.project?.name ?? 'Project'}{t.project?.client?.name ? ` · ${t.project.client.name}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-amber-200">🟡 Waiting for your review</p>
                    <p className="text-[11px] text-slate-500">v{versionById[t.id] ?? 1}</p>
                  </div>
                </div>

                <div className={`mt-4 grid gap-4 ${splitView ? 'lg:grid-cols-[35%_65%]' : 'grid-cols-1'}`}>
                  <section className={`rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 ${splitView ? '' : 'order-2'}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Brief</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{(t.instructions ?? '').trim() || 'No brief added.'}</p>
                    {(t.admin_feedback ?? '').trim() ? (
                      <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200">Last feedback</p>
                        <p className="mt-1 text-xs text-amber-100/90">{t.admin_feedback}</p>
                      </div>
                    ) : null}
                    {t.submission_notes ? (
                      <p className="mt-3 rounded-md border border-white/[0.08] bg-black/20 p-2 text-xs leading-relaxed text-slate-400">{t.submission_notes}</p>
                    ) : null}
                  </section>

                  <section className={`rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 ${splitView ? '' : 'order-1'}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Submitted work</p>
                    <div className="mt-2">
                      {selected ? (
                        <LargePreview file={selected} />
                      ) : t.submission_link ? (
                        <a href={t.submission_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open submitted link
                        </a>
                      ) : (
                        <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                          <p className="text-xs text-amber-100">⚠ No submission uploaded</p>
                          <button
                            type="button"
                            onClick={() => {
                              setFeedbackOpenId(t.id)
                              setFeedback('Please upload your submission preview (image/video/pdf/link) for approval.')
                            }}
                            className="rounded-md bg-amber-500/90 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-500"
                          >
                            Request update from team
                          </button>
                        </div>
                      )}
                    </div>

                    {files.length > 0 ? (
                      <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {files.map((f, i) => {
                          const kind = previewKind(f.mime_type, f.original_name)
                          const active = i === selectedIdx
                          return (
                            <li key={f.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedFileIndex((prev) => ({ ...prev, [t.id]: i }))}
                                className={`flex h-16 w-24 items-center justify-center rounded-lg border px-1 text-[10px] ${
                                  active
                                    ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                                    : 'border-white/[0.1] bg-black/20 text-slate-300'
                                }`}
                                title={f.original_name}
                              >
                                {kind === 'image'
                                  ? `🖼 ${(f.original_name.split('.').pop() ?? 'IMG').toUpperCase()}`
                                  : kind === 'video'
                                    ? `🎥 ${(f.original_name.split('.').pop() ?? 'VID').toUpperCase()}`
                                    : kind === 'pdf'
                                      ? '📄 PDF'
                                      : `📎 ${(f.original_name.split('.').pop() ?? 'FILE').toUpperCase()}`}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}

                    <p className="mt-3 text-xs text-slate-500">
                      Submitted by <span className="text-slate-300">{t.assignee?.name ?? 'Unassigned'}</span> • {timeLabel(t.submitted_at)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === t.id || !hasSubmission}
                        onClick={() => void approve(t.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        ✓ Approve
                      </button>
                      {!hasSubmission ? (
                        <button
                          type="button"
                          onClick={() => {
                            setFeedbackOpenId(t.id)
                            setFeedback('Please upload your submission preview (image/video/pdf/link) for approval.')
                          }}
                          className="rounded-xl bg-amber-500/90 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500"
                        >
                          Request update from team
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setFeedbackOpenId(t.id)
                          setFeedback(t.admin_feedback ?? '')
                        }}
                        className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
                      >
                        ✎ Request changes
                      </button>
                      <button
                        type="button"
                        disabled={busyId === t.id}
                        onClick={() => void returnToDoing(t.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
                      >
                        {busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Return to Doing
                      </button>
                    </div>
                  </section>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {feedbackOpenId ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/[0.12] bg-[#0b1324] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">Request revision</h3>
                <p className="mt-1 text-sm text-slate-500">What needs to be changed?</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFeedbackOpenId(null)
                  setFeedback('')
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={5}
              placeholder="Example: Change color to blue, increase logo size, and align CTA with brand guidelines."
              className="mt-4 w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setFeedbackOpenId(null)
                  setFeedback('')
                }}
                className="rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void sendRevision(feedbackOpenId)}
                disabled={busyId === feedbackOpenId}
                className="rounded-lg bg-amber-500/90 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busyId === feedbackOpenId ? 'Sending...' : 'Send feedback'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

