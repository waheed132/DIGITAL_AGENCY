import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Film,
  Flag,
  Globe,
  Image,
  Inbox,
  Loader2,
  ExternalLink,
  Mail,
  MapPin,
  Palette,
  Paperclip,
  Phone,
  Pin,
  RefreshCw,
  Sparkles,
  Upload,
  X,
  ClipboardCopy,
} from 'lucide-react'
import { ApiError, apiRequest, downloadProtectedFile, fetchProtectedBlob, openProtectedFile } from '../../lib/api'

type ClientBrandKit = {
  id: number
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  address?: string | null
  brand_primary?: string | null
  brand_secondary?: string | null
  brand_colors?: string[] | null
  logo_url?: string | null
  business_profile_url?: string | null
}

function normalizedBrandPalette(client: ClientBrandKit): string[] {
  const raw = client.brand_colors
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((c) => typeof c === 'string' && c.trim() !== '')
  }
  return [client.brand_primary, client.brand_secondary].filter(Boolean) as string[]
}

type TaskStatusKey = 'todo' | 'doing' | 'review' | 'revision' | 'done'

type TaskRow = {
  id: number
  project_id?: number
  title: string
  status: string
  priority: string
  deadline: string | null
  service_id?: number | null
  deliverable_type?: string
  submission_link?: string | null
  submission_notes?: string | null
  admin_feedback?: string | null
  description?: string | null
  instructions?: string | null
  client_content?: string | null
  reference_url?: string | null
  attachments?: AttachmentItem[]
  assignee?: { id: number; name: string } | null
  agency_service?: { id: number; name: string; period_label?: string | null; planned_quantity?: number } | null
  service_progress?: {
    completed: number
    total: number
    unassigned?: number
    yours?: number
    with_others?: number
  } | null
  service_unit?: { index: number; total: number } | null
  project?: { name: string; client?: ClientBrandKit }
}

type AttachmentItem = {
  id: number
  original_name: string
  url: string
  mime_type?: string | null
  attachment_type?: 'asset' | 'submission' | null
  uploader?: { id?: number; name?: string; role?: 'admin' | 'employee' } | null
}

const STATUS_ORDER: TaskStatusKey[] = ['todo', 'doing', 'review', 'revision', 'done']
const DESKTOP_STATUS_ORDER: TaskStatusKey[] = ['todo', 'doing', 'review', 'revision', 'done']

const STATUS_LABEL: Record<TaskStatusKey, string> = {
  todo: 'To Do',
  doing: 'Doing',
  review: 'Review',
  revision: 'Revision',
  done: 'Done',
}

const EMPTY_HINT: Record<TaskStatusKey, string> = {
  todo: "You're all caught up 🚀\nNew tasks will appear here automatically.",
  doing: "No tasks in progress.\nPick a task from To Do to start working.",
  review: "You're all caught up 🚀\nNew review items will appear here automatically.",
  revision: "Nothing to redo right now.\nKeep shipping great work — you've got this.",
  done: "Nothing completed in this view yet.\nFinished work will stack here for reference.",
}

function formatDueShort(deadline: string | null): string {
  if (!deadline) return 'No due date'
  const d = new Date(deadline)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function isDueToday(deadline: string | null): boolean {
  if (!deadline) return false
  const t = new Date(deadline)
  const now = new Date()
  return t.toDateString() === now.toDateString()
}

/** Removes stray single-character lines (e.g. “w”) so DB junk doesn’t look broken in UI */
function cleanBodyText(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      if (!l.length) return false
      if (l.length < 2) return false
      return true
    })
  if (!lines.length) return null
  const joined = lines.join('\n').trim()
  return joined.length >= 2 ? joined : null
}

function referenceHref(url: string): string {
  const t = url.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

/** Works over HTTP on many browsers via fallback (clipboard API often fails on non-HTTPS). */
async function copyToClipboard(text: string): Promise<boolean> {
  const value = text.replace(/\u0000/g, '').trim()
  if (!value) return false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    ta.style.top = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function copyText(value: string) {
  void copyToClipboard(value)
}

type InstructionToken =
  | { kind: 'text'; value: string }
  | { kind: 'link'; value: string }
  | { kind: 'color'; value: string }

function tokenizeInstructionLine(line: string): InstructionToken[] {
  const tokens: InstructionToken[] = []
  const re = /(https?:\/\/[^\s]+)|(#(?:[0-9A-Fa-f]{6}))/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(line)) !== null) {
    if (match.index > last) {
      tokens.push({ kind: 'text', value: line.slice(last, match.index) })
    }
    const token = match[0]
    if (token.startsWith('#')) tokens.push({ kind: 'color', value: token.toUpperCase() })
    else tokens.push({ kind: 'link', value: token })
    last = match.index + token.length
  }
  if (last < line.length) tokens.push({ kind: 'text', value: line.slice(last) })
  return tokens
}

function parseInstructionLines(raw: string | null | undefined): string[] {
  const cleaned = cleanBodyText(raw)
  if (!cleaned) return []
  return cleaned.split('\n').map((l) => l.trim()).filter(Boolean)
}

type DeadlineUrgency = 'overdue' | 'today' | 'tomorrow' | 'upcoming'

function deadlineDayParts(deadline: string): { y: number; m: number; d: number } | null {
  const t = deadline.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (m) return { y: +m[1], m: +m[2], d: +m[3] }
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return null
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }
}

function todayDayParts(): { y: number; m: number; d: number } {
  const t = new Date()
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }
}

function compareDay(
  a: { y: number; m: number; d: number },
  b: { y: number; m: number; d: number },
): number {
  if (a.y !== b.y) return a.y - b.y
  if (a.m !== b.m) return a.m - b.m
  return a.d - b.d
}

function dueUrgency(deadline: string | null, statusKey: TaskStatusKey): DeadlineUrgency {
  if (!deadline || statusKey === 'done') return 'upcoming'
  const due = deadlineDayParts(deadline)
  if (!due) return 'upcoming'
  const today = todayDayParts()
  const c = compareDay(due, today)
  if (c < 0) return 'overdue'
  if (c === 0) return 'today'
  if (c === 1) return 'tomorrow'
  return 'upcoming'
}

function referenceAttachments(attachments: AttachmentItem[] | undefined): AttachmentItem[] {
  return (attachments ?? []).filter(
    (a) => a.attachment_type === 'asset' || (!a.attachment_type && a.uploader?.role === 'admin'),
  )
}

function submissionAttachments(attachments: AttachmentItem[] | undefined): AttachmentItem[] {
  return (attachments ?? []).filter(
    (a) => a.attachment_type === 'submission' || (!a.attachment_type && a.uploader?.role !== 'admin'),
  )
}

type AttachmentKind = 'image' | 'video' | 'pdf' | 'other'

function attachmentKind(mime: string | null | undefined, name: string): AttachmentKind {
  const m = (mime ?? '').toLowerCase()
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (m.startsWith('image/') || /^(png|jpe?g|jfif|gif|webp|svg|bmp|heic|heif)$/.test(ext)) return 'image'
  if (m.startsWith('video/') || /^(mp4|webm|mov|mkv|avi)$/.test(ext)) return 'video'
  if (m === 'application/pdf' || m.includes('pdf') || ext === 'pdf') return 'pdf'
  return 'other'
}

function fileKindLabel(kind: AttachmentKind): string {
  switch (kind) {
    case 'image':
      return 'Image'
    case 'video':
      return 'Video'
    case 'pdf':
      return 'PDF'
    default:
      return 'File'
  }
}

function AssetPreviewModal({
  attachment,
  onClose,
}: {
  attachment: AttachmentItem | null
  onClose: () => void
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [dragY, setDragY] = useState(0)
  const touchStart = useRef<number | null>(null)

  useEffect(() => {
    if (!attachment) {
      setBlobUrl(null)
      setLoadState('loading')
      return
    }
    setLoadState('loading')
    setBlobUrl(null)
    let created: string | null = null
    let cancelled = false
    void fetchProtectedBlob(attachment.url).then(
      (blob) => {
        if (cancelled) return
        created = URL.createObjectURL(blob)
        if (cancelled) {
          URL.revokeObjectURL(created)
          return
        }
        setBlobUrl(created)
        setLoadState('ready')
      },
      () => {
        if (!cancelled) {
          setLoadState('error')
        }
      },
    )
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [attachment])

  useEffect(() => {
    setDragY(0)
  }, [attachment?.id])

  if (!attachment) return null

  const kind = attachmentKind(attachment.mime_type, attachment.original_name)
  const showImage = kind === 'image' && loadState === 'ready' && blobUrl
  const showVideo = kind === 'video' && loadState === 'ready' && blobUrl
  const showPdf = kind === 'pdf' && loadState === 'ready' && blobUrl

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${attachment.original_name}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div
        className="relative z-[121] flex w-full max-w-[min(100%,26rem)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b1220] shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-cyan-400/10 sm:max-w-2xl lg:max-w-3xl"
        style={{
          maxHeight: 'min(90dvh, 56rem)',
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragY === 0 ? 'transform 0.2s ease-out' : undefined,
        }}
        onTouchStart={(e) => {
          touchStart.current = e.touches[0]?.clientY ?? null
        }}
        onTouchMove={(e) => {
          if (touchStart.current == null) return
          const y = e.touches[0]?.clientY ?? 0
          const dy = y - touchStart.current
          if (dy > 0) setDragY(Math.min(dy, 160))
        }}
        onTouchEnd={() => {
          touchStart.current = null
          if (dragY > 72) {
            onClose()
          }
          setDragY(0)
        }}
      >
        <div className="relative shrink-0 border-b border-white/[0.06] bg-gradient-to-b from-cyan-500/[0.06] to-transparent px-4 pb-3 pt-3.5 sm:px-5 sm:pb-4 sm:pt-4">
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-slate-500/80 sm:mb-2 sm:hidden" aria-hidden />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 rounded-full border border-white/[0.08] bg-white/[0.06] p-2 text-slate-300 shadow-sm backdrop-blur-sm transition hover:bg-white/[0.1] hover:text-white sm:right-4 sm:top-4"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mx-auto max-w-md px-6 text-center sm:mx-0 sm:max-w-none sm:px-0 sm:pr-14 sm:text-left">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Preview</p>
            <h2
              className="mt-1 line-clamp-4 text-[15px] font-semibold leading-snug tracking-tight text-white sm:text-[17px]"
              title={attachment.original_name}
            >
              {attachment.original_name}
            </h2>
            <p className="mt-2 text-[11px] text-slate-500 sm:text-xs">{fileKindLabel(kind)}</p>
          </div>
        </div>

        {/* Fixed-height media stage: same box for loading / ready so the shell never jumps (CLS). */}
        <div className="flex min-h-0 shrink-0 flex-col overflow-x-hidden">
          <div className="shrink-0 px-3 pb-1 pt-2 sm:px-5 sm:pb-2 sm:pt-3">
            <div className="relative flex h-[min(52dvh,400px)] w-full flex-col overflow-hidden rounded-xl bg-slate-950/65 ring-1 ring-inset ring-white/[0.07] sm:h-[min(56dvh,460px)]">
              {loadState === 'loading' ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-slate-500">
                  <Loader2 className="h-9 w-9 animate-spin text-emerald-400/90" aria-hidden />
                  <p className="text-sm text-slate-400">Loading preview…</p>
                </div>
              ) : null}

              {loadState === 'error' ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
                  <p className="text-sm text-slate-400">We couldn&apos;t show a preview for this file.</p>
                  <p className="text-xs text-slate-500">Try download or open in a new tab below.</p>
                </div>
              ) : null}

              {showImage && blobUrl ? (
                <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-3">
                  <img
                    src={blobUrl}
                    alt={attachment.original_name}
                    className="max-h-full max-w-full rounded-lg object-contain shadow-lg shadow-black/25"
                  />
                </div>
              ) : null}

              {showVideo && blobUrl ? (
                <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-3">
                  <video
                    src={blobUrl}
                    className="max-h-full max-w-full rounded-lg bg-black shadow-lg"
                    controls
                    playsInline
                    preload="metadata"
                  />
                </div>
              ) : null}

              {showPdf && blobUrl ? (
                <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3">
                  <iframe
                    title={attachment.original_name}
                    src={blobUrl}
                    className="min-h-0 flex-1 w-full rounded-lg border-0 bg-white shadow-lg"
                  />
                </div>
              ) : null}

              {loadState === 'ready' && blobUrl && kind === 'other' ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
                  <p className="text-sm text-slate-300">No preview for this file type</p>
                  <p className="text-xs text-slate-500">Use the buttons below to download or open it.</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 border-t border-white/[0.06] bg-[#080c14]/98 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5">
              <button
                type="button"
                onClick={() => void downloadProtectedFile(attachment.url, attachment.original_name)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-700/80 sm:min-h-[44px]"
              >
                <Download className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                Download
              </button>
              <button
                type="button"
                onClick={() => void openProtectedFile(attachment.url)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-500/20 transition hover:bg-emerald-500/25 sm:min-h-[44px]"
              >
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                Open in new tab
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.1] sm:min-h-[44px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** In-app logo viewer — avoids raw new-tab image; stable height (no CLS). */
function BrandLogoPreviewModal({
  open,
  onClose,
  clientName,
  logoUrl,
}: {
  open: boolean
  onClose: () => void
  clientName: string
  logoUrl: string
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  useEffect(() => {
    if (!open || !logoUrl) {
      setPhase('idle')
      setBlobUrl(null)
      return
    }
    let cancelled = false
    let created: string | null = null
    setPhase('loading')
    setBlobUrl(null)
    void fetchProtectedBlob(logoUrl).then(
      (blob) => {
        if (cancelled) return
        if (!blob.type.startsWith('image/')) {
          setPhase('error')
          return
        }
        created = URL.createObjectURL(blob)
        setBlobUrl(created)
        setPhase('ready')
      },
      () => {
        if (!cancelled) setPhase('error')
      },
    )
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [open, logoUrl])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open || !logoUrl) return null

  const safeFilename = `${clientName.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_').trim() || 'logo'}-logo`

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Logo — ${clientName}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        aria-label="Close logo preview"
        onClick={onClose}
      />
      <div className="relative z-[131] flex w-full max-w-[min(100%,24rem)] flex-col overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#0b1220] shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.06] sm:max-w-lg">
        <div className="relative shrink-0 border-b border-white/[0.06] px-4 pb-3 pt-3.5 sm:px-5 sm:pt-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full border border-white/[0.1] bg-white/[0.06] p-2 text-slate-300 transition hover:bg-white/[0.1] hover:text-white sm:right-4 sm:top-3.5"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="pr-12 text-center sm:text-left">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-400/85">Brand logo</p>
            <h2 className="mt-1 truncate text-[17px] font-semibold tracking-tight text-white">{clientName}</h2>
          </div>
        </div>

        <div className="shrink-0 px-3 pb-2 pt-3 sm:px-5 sm:pb-3 sm:pt-4">
          <div className="flex h-[min(42dvh,280px)] w-full flex-col overflow-hidden rounded-xl bg-slate-950/50 ring-1 ring-inset ring-white/[0.08] sm:h-[min(46dvh,340px)]">
            {phase === 'loading' ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="h-9 w-9 animate-spin text-emerald-400/90" aria-hidden />
                <p className="text-sm text-slate-400">Loading logo…</p>
              </div>
            ) : null}
            {phase === 'error' ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
                <p className="text-sm text-slate-400">Couldn&apos;t load this logo.</p>
                <p className="text-xs text-slate-500">Try Download below.</p>
              </div>
            ) : null}
            {phase === 'ready' && blobUrl ? (
              <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-4">
                <div className="flex h-full w-full items-center justify-center rounded-lg bg-white p-4 shadow-inner sm:p-8">
                  <img
                    src={blobUrl}
                    alt={`${clientName} logo`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/[0.06] bg-[#080c14]/98 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-3 sm:px-5">
          <button
            type="button"
            onClick={() => void downloadProtectedFile(logoUrl, safeFilename)}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-emerald-500/45 bg-emerald-500/15 px-3 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-500/15 transition hover:bg-emerald-500/25 sm:min-h-[44px]"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 text-sm font-semibold text-white transition hover:bg-white/[0.1] sm:min-h-[44px]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function ProtectedAttachmentThumb({ attachment }: { attachment: AttachmentItem }) {
  const kind = attachmentKind(attachment.mime_type, attachment.original_name)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [thumbFailed, setThumbFailed] = useState(false)

  useEffect(() => {
    if (kind !== 'image') return
    let created: string | null = null
    let cancelled = false
    setThumbFailed(false)
    void fetchProtectedBlob(attachment.url).then(
      (blob) => {
        if (cancelled) return
        created = URL.createObjectURL(blob)
        setThumbUrl(created)
      },
      () => {
        if (!cancelled) setThumbFailed(true)
      },
    )
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [attachment.url, attachment.mime_type, attachment.original_name, kind])

  if (kind === 'image' && thumbUrl && !thumbFailed) {
    return (
      <span className="relative flex h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
        <img src={thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      </span>
    )
  }

  if (kind === 'image' && !thumbFailed && thumbUrl === null) {
    return <span className="flex h-12 w-12 shrink-0 animate-pulse rounded-lg bg-slate-800 ring-1 ring-white/5" />
  }

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800/90 ring-1 ring-white/5">
      {kind === 'image' ? (
        <Image className="h-5 w-5 text-sky-400" aria-hidden />
      ) : kind === 'video' ? (
        <Film className="h-5 w-5 text-violet-400" aria-hidden />
      ) : kind === 'pdf' ? (
        <FileText className="h-5 w-5 text-amber-400" aria-hidden />
      ) : (
        <Paperclip className="h-5 w-5 text-slate-400" aria-hidden />
      )}
    </span>
  )
}

/** Keys shown in the mobile stacked list for the current filter */
function mobileKeysForScope(scope: 'all' | 'active' | 'review' | 'today'): TaskStatusKey[] {
  if (scope === 'review') return ['review']
  if (scope === 'active') return ['todo', 'doing', 'review', 'revision']
  return [...STATUS_ORDER]
}

function MobileTasksEmptyHero({
  mobileScope,
  assignedFromApi,
  onRefresh,
}: {
  mobileScope: 'all' | 'active' | 'review' | 'today'
  assignedFromApi: boolean
  onRefresh: () => void
}) {
  const copy = !assignedFromApi
    ? {
        Icon: Inbox,
        title: 'No tasks assigned yet',
        body: 'When your admin assigns work to you, it will appear here automatically—you can check back anytime.',
      }
    : mobileScope === 'active'
      ? {
          Icon: CheckCircle2,
          title: "You're all caught up",
          body: 'Nothing in your open work right now. Completed tasks stay under All → Done.',
        }
      : mobileScope === 'review'
        ? {
            Icon: Sparkles,
            title: 'Nothing in review',
            body: 'No tasks are waiting on admin in this view. Try Open or All to see other work.',
          }
        : mobileScope === 'today'
          ? {
              Icon: Sparkles,
              title: 'Nothing due today',
              body: 'No tasks with today’s due date. Other due dates show when you change the filter.',
            }
          : {
              Icon: Inbox,
              title: 'Nothing in this view',
              body: 'Try a different filter to see tasks in other stages.',
            }

  const { Icon, title, body } = copy

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/30 via-[#0a1018]/95 to-[#070b12] px-5 py-7 text-center ring-1 ring-emerald-500/10">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/[0.12] ring-1 ring-emerald-400/25">
        <Icon className="h-7 w-7 text-emerald-400" strokeWidth={1.75} />
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
      <button
        type="button"
        onClick={onRefresh}
        className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500 active:scale-[0.99]"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Check for updates
      </button>
    </div>
  )
}

function statusBadgeStyles(sk: TaskStatusKey): string {
  switch (sk) {
    case 'todo':
      return 'bg-slate-700/80 text-slate-200 ring-1 ring-white/10'
    case 'doing':
      return 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30'
    case 'review':
      return 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/35'
    case 'revision':
      return 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/35'
    case 'done':
      return 'bg-slate-600/50 text-slate-200 ring-1 ring-white/10'
    default:
      return 'bg-slate-700 text-slate-200'
  }
}

export function TeamTasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const projectParam = searchParams.get('project')
  const taskFocusParam = searchParams.get('task')
  const projectFilterId =
    projectParam && /^\d+$/.test(projectParam.trim()) ? Number(projectParam.trim()) : null

  const [tasks, setTasks] = useState<TaskRow[] | null>(null)
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null)
  const [uploadingTaskId, setUploadingTaskId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploadSuccessByTask, setUploadSuccessByTask] = useState<Record<number, string | null>>({})
  const [drafts, setDrafts] = useState<Record<number, { submission_link: string; submission_notes: string }>>({})
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null)
  const [assetPreview, setAssetPreview] = useState<AttachmentItem | null>(null)
  const [mobileScope, setMobileScope] = useState<'all' | 'active' | 'review' | 'today'>('active')
  const [desktopFocus, setDesktopFocus] = useState<'all' | 'in_progress' | 'today' | 'high_priority'>('all')

  const boardTasks = useMemo(() => {
    if (!tasks) return null
    if (projectFilterId == null) return tasks
    return tasks.filter((t) => (t.project_id ?? null) === projectFilterId)
  }, [tasks, projectFilterId])

  const filteredProjectLabel = useMemo(() => {
    if (!tasks || projectFilterId == null) return null
    const hit = tasks.find((x) => (x.project_id ?? null) === projectFilterId)
    return hit?.project?.name ?? `Project #${projectFilterId}`
  }, [tasks, projectFilterId])

  function clearProjectFilter() {
    const next = new URLSearchParams(searchParams)
    next.delete('project')
    next.delete('task')
    setSearchParams(next, { replace: true })
  }

  async function loadTasks() {
    try {
      const t = await apiRequest<TaskRow[]>('/api/team/tasks')
      setTasks(t)
      setError(null)
      setDrafts((prev) => {
        const next = { ...prev }
        for (const task of t) {
          if (!next[task.id]) {
            next[task.id] = {
              submission_link: task.submission_link ?? '',
              submission_notes: task.submission_notes ?? '',
            }
          }
        }
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tasks')
    }
  }

  useEffect(() => {
    void loadTasks()
  }, [])

  useEffect(() => {
    if (!tasks?.length) return
    const hash = window.location.hash
    if (!hash.startsWith('#task-')) return
    requestAnimationFrame(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [tasks])

  useEffect(() => {
    if (!tasks?.length || !taskFocusParam || !/^\d+$/.test(taskFocusParam.trim())) return
    const id = Number(taskFocusParam.trim())
    if (!tasks.some((t) => t.id === id)) return
    setDetailTaskId(id)
    requestAnimationFrame(() => {
      document.querySelector(`#task-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [tasks, taskFocusParam])

  const grouped = useMemo(() => {
    const map: Record<TaskStatusKey, TaskRow[]> = {
      todo: [],
      doing: [],
      review: [],
      revision: [],
      done: [],
    }
    if (!boardTasks) return map
    for (const task of boardTasks) {
      const key = (map[task.status as TaskStatusKey] ? task.status : 'todo') as TaskStatusKey
      map[key].push(task)
    }
    return map
  }, [boardTasks])

  const desktopGrouped = useMemo(() => {
    const g = { ...grouped }
    const keep = (t: TaskRow): boolean => {
      if (desktopFocus === 'all') return true
      if (desktopFocus === 'in_progress') return t.status === 'doing' || t.status === 'revision'
      if (desktopFocus === 'today') return isDueToday(t.deadline)
      if (desktopFocus === 'high_priority') return String(t.priority).toLowerCase() === 'high'
      return true
    }
    return {
      todo: g.todo.filter(keep),
      doing: g.doing.filter(keep),
      review: g.review.filter(keep),
      revision: g.revision.filter(keep),
      done: g.done.filter(keep),
    }
  }, [grouped, desktopFocus])

  /** First not-done unit per service (by unit index) — the team’s “current” work item. */
  const currentUnitTaskIdByService = useMemo(() => {
    if (!boardTasks?.length) return {} as Record<number, number>
    const byService = new Map<number, TaskRow[]>()
    for (const t of boardTasks) {
      if (t.service_id == null || !t.service_unit) continue
      if (!byService.has(t.service_id)) byService.set(t.service_id, [])
      byService.get(t.service_id)!.push(t)
    }
    const out: Record<number, number> = {}
    for (const [sid, list] of byService) {
      const ordered = [...list].sort((a, b) => (a.service_unit?.index ?? 0) - (b.service_unit?.index ?? 0))
      const next = ordered.find((x) => x.status !== 'done')
      if (next) out[sid] = next.id
    }
    return out
  }, [boardTasks])

  const filteredGrouped = useMemo(() => {
    const g = { ...grouped }
    const filterList = (list: TaskRow[]) => {
      if (mobileScope === 'today') return list.filter((t) => isDueToday(t.deadline))
      return list
    }
    if (mobileScope === 'review') {
      return {
        todo: [],
        doing: [],
        review: filterList(g.review),
        revision: [],
        done: [],
      }
    }
    if (mobileScope === 'active') {
      return {
        ...g,
        done: [],
        todo: filterList(g.todo),
        doing: filterList(g.doing),
        review: filterList(g.review),
        revision: filterList(g.revision),
      }
    }
    if (mobileScope === 'today') {
      return {
        todo: filterList(g.todo),
        doing: filterList(g.doing),
        review: filterList(g.review),
        revision: filterList(g.revision),
        done: filterList(g.done),
      }
    }
    return {
      todo: filterList(g.todo),
      doing: filterList(g.doing),
      review: filterList(g.review),
      revision: filterList(g.revision),
      done: filterList(g.done),
    }
  }, [grouped, mobileScope])

  const mobileListKeys = useMemo(() => mobileKeysForScope(mobileScope), [mobileScope])

  const mobileVisibleTaskCount = useMemo(() => {
    return mobileListKeys.reduce((n, k) => n + filteredGrouped[k].length, 0)
  }, [filteredGrouped, mobileListKeys])
  const mobileDueTodayCount = useMemo(() => {
    return mobileListKeys.reduce((n, k) => n + filteredGrouped[k].filter((t) => isDueToday(t.deadline)).length, 0)
  }, [filteredGrouped, mobileListKeys])

  async function updateTaskStatus(
    taskId: number,
    status: TaskStatusKey,
    includeSubmission = false,
  ) {
    setSavingTaskId(taskId)
    setError(null)
    setSuccess(null)
    try {
      const payload: Record<string, unknown> = { status }
      if (includeSubmission) {
        payload.submission_link = drafts[taskId]?.submission_link?.trim() || null
        payload.submission_notes = drafts[taskId]?.submission_notes?.trim() || null
      }

      const updated = await apiRequest<TaskRow>(`/api/team/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setTasks((prev) => (prev ? prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t)) : prev))
      if (status === 'review' && includeSubmission) {
        setSuccess('Work submitted successfully. Waiting for admin review.')
        setDetailTaskId(null)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update task status')
    } finally {
      setSavingTaskId(null)
    }
  }

  /** Explicit Doing → Review (never automatic). Warns if nothing submitted yet. */
  async function submitForReview(taskId: number) {
    const task = tasks?.find((x) => x.id === taskId)
    if (!task) return
    const teamSubs = submissionAttachments(task.attachments ?? [])
    const linkDraft = drafts[taskId]?.submission_link?.trim()
    const linkLive = (task.submission_link ?? '').trim()
    const hasLink = Boolean(linkDraft || linkLive)
    if (!hasLink && teamSubs.length === 0) {
      const ok = window.confirm(
        'No submission link or uploaded files yet. Send to admin review anyway?',
      )
      if (!ok) return
    }
    await updateTaskStatus(taskId, 'review', true)
  }

  function updateDraft(taskId: number, key: 'submission_link' | 'submission_notes', value: string) {
    setDrafts((prev) => ({
      ...prev,
      [taskId]: {
        submission_link: prev[taskId]?.submission_link ?? '',
        submission_notes: prev[taskId]?.submission_notes ?? '',
        [key]: value,
      },
    }))
  }

  async function uploadAttachment(taskId: number, file: File) {
    setUploadingTaskId(taskId)
    setError(null)
    setSuccess(null)
    setUploadSuccessByTask((prev) => ({ ...prev, [taskId]: null }))
    try {
      const body = new FormData()
      body.append('file', file)
      const created = await apiRequest<AttachmentItem>(`/api/team/tasks/${taskId}/attachments`, {
        method: 'POST',
        body,
      })
      setTasks((prev) =>
        prev
          ? prev.map((task) =>
              task.id === taskId
                ? { ...task, attachments: [created, ...(task.attachments ?? [])] }
                : task,
            )
          : prev,
      )
      setUploadSuccessByTask((prev) => ({ ...prev, [taskId]: `${created.original_name} added` }))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not upload file')
    } finally {
      setUploadingTaskId(null)
    }
  }

  async function deleteAttachment(taskId: number, attachmentId: number) {
    setError(null)
    try {
      await apiRequest(`/api/team/tasks/${taskId}/attachments/${attachmentId}`, { method: 'DELETE' })
      setTasks((prev) =>
        prev
          ? prev.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    attachments: (task.attachments ?? []).filter((a) => a.id !== attachmentId),
                  }
                : task,
            )
          : prev,
      )
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete file')
    }
  }

  const detailTask = useMemo(
    () => (detailTaskId != null && tasks ? tasks.find((t) => t.id === detailTaskId) ?? null : null),
    [detailTaskId, tasks],
  )

  const openDetail = useCallback((id: number) => setDetailTaskId(id), [])
  const closeDetail = useCallback(() => setDetailTaskId(null), [])
  const closeAssetPreview = useCallback(() => setAssetPreview(null), [])
  const jumpToAssigned = useCallback(() => {
    const firstKey = mobileListKeys.find((k) => filteredGrouped[k].length > 0)
    if (!firstKey) return
    const target =
      document.querySelector(`#mobile-section-${firstKey}`) ??
      document.querySelector(`#task-${filteredGrouped[firstKey][0]?.id ?? ''}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [mobileListKeys, filteredGrouped])

  useEffect(() => {
    if (!detailTaskId && !assetPreview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (assetPreview) {
        closeAssetPreview()
        return
      }
      if (detailTaskId) closeDetail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailTaskId, closeDetail, assetPreview, closeAssetPreview])

  return (
    <div className="space-y-6 max-md:space-y-6 md:space-y-4">
      {projectFilterId != null && filteredProjectLabel ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-200">
            <span className="font-semibold text-white">Filtered:</span>{' '}
            <span className="text-emerald-200/95">{filteredProjectLabel}</span>
            <span className="text-slate-500"> — only tasks for this project are shown.</span>
          </p>
          <button
            type="button"
            onClick={() => clearProjectFilter()}
            className="min-h-[40px] shrink-0 rounded-xl border border-white/15 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            Show all projects
          </button>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {/* Mobile filters — single column list, no horizontal kanban */}
        <div className="md:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ['all', 'All'],
                  ['active', 'Open'],
                  ['review', 'In review'],
                  ['today', 'Due today'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMobileScope(key)}
                  className={`min-h-[44px] rounded-full px-4 py-2 text-xs font-medium transition active:scale-[0.98] ${
                    mobileScope === key
                      ? 'border border-emerald-500/90 bg-emerald-600 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.2)]'
                      : 'border border-white/10 bg-slate-900/45 text-slate-400 hover:border-white/15 hover:bg-slate-800/70 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={jumpToAssigned}
              className="min-h-[44px] shrink-0 rounded-xl border border-transparent px-2 py-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 active:scale-[0.98]"
            >
              View assigned tasks ↓
            </button>
          </div>
          <div className="mt-5 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {mobileVisibleTaskCount} task{mobileVisibleTaskCount === 1 ? '' : 's'} • {mobileDueTodayCount} due today
            </p>
            <button
              type="button"
              onClick={() => void loadTasks()}
              className="min-h-[40px] shrink-0 rounded-lg border border-slate-700/80 px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800/80 active:scale-[0.98]"
            >
              Refresh
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadTasks()}
          className="hidden min-h-11 self-end rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 active:scale-[0.98] sm:self-auto md:inline-flex md:min-h-0 md:rounded-lg md:px-3 md:py-1.5"
        >
          Refresh
        </button>
      </div>
      <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
        {(
          [
            ['all', 'All'],
            ['in_progress', 'In Progress'],
            ['today', 'Due Today'],
            ['high_priority', 'High Priority'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setDesktopFocus(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              desktopFocus === key
                ? 'border border-emerald-500 bg-emerald-600 text-white'
                : 'border border-slate-700/90 bg-slate-900/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

      {!tasks ? (
        <p className="text-slate-500">Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <>
          <p className="hidden rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-slate-400 md:block">
            No tasks assigned yet.
          </p>
          <div className="md:hidden">
            <MobileTasksEmptyHero
              mobileScope={mobileScope}
              assignedFromApi={false}
              onRefresh={() => void loadTasks()}
            />
          </div>
        </>
      ) : projectFilterId != null && (boardTasks ?? []).length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center text-slate-400 md:text-left">
          <p className="text-sm text-slate-300">
            No tasks assigned to you in{' '}
            <span className="font-semibold text-white">{filteredProjectLabel ?? 'this project'}</span>.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Clear the filter to see all work, or ask an admin if you should have tasks on this project.
          </p>
          <button
            type="button"
            onClick={() => clearProjectFilter()}
            className="mt-4 min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Show all projects
          </button>
        </div>
      ) : (
        <>
          {/* Desktop: responsive kanban grid, no horizontal scroll */}
          <div className="hidden md:block">
            <div
              className="grid gap-3 pb-3 pt-1"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}
            >
              {DESKTOP_STATUS_ORDER.map((statusKey) => (
                <KanbanColumn
                  key={statusKey}
                  statusKey={statusKey}
                  tasks={desktopGrouped[statusKey]}
                  savingTaskId={savingTaskId}
                  currentUnitTaskIdByService={currentUnitTaskIdByService}
                  updateTaskStatus={updateTaskStatus}
                  submitForReview={submitForReview}
                  onOpenDetail={openDetail}
                />
              ))}
            </div>
          </div>

          {/* Mobile: consolidated empty OR stacked sections (empty columns hidden) */}
          <div className="md:hidden">
            {mobileVisibleTaskCount === 0 ? (
              <MobileTasksEmptyHero
                mobileScope={mobileScope}
                assignedFromApi
                onRefresh={() => void loadTasks()}
              />
            ) : (
              <div className="space-y-5">
                {mobileListKeys.map((statusKey) => {
                  const list = filteredGrouped[statusKey]
                  if (list.length === 0) return null

                  return (
                    <section
                      key={statusKey}
                      id={`mobile-section-${statusKey}`}
                      className="scroll-mt-24 rounded-2xl border border-white/[0.06] bg-[#0a1018]/80 p-4 ring-1 ring-white/[0.03]"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h2 className="text-[15px] font-semibold tracking-tight text-white">
                          {STATUS_LABEL[statusKey]}
                          <span className="ml-2 font-normal text-slate-500">({list.length})</span>
                        </h2>
                      </div>
                      <ul className="space-y-4">
                        {list.map((t) => (
                          <li key={t.id} id={`task-${t.id}`}>
                            <CompactTaskCard
                              task={t}
                              statusKey={statusKey}
                              savingTaskId={savingTaskId}
                              isCurrentUnit={
                                t.service_id != null && currentUnitTaskIdByService[t.service_id] === t.id
                              }
                              onOpenDetail={() => openDetail(t.id)}
                              onStart={() => void updateTaskStatus(t.id, 'doing')}
                              onSubmitWork={() => openDetail(t.id)}
                              onSubmitForReview={() => void submitForReview(t.id)}
                              onContinue={() => void updateTaskStatus(t.id, 'doing')}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {detailTask ? (
        <TaskDetailModal
          task={detailTask}
          drafts={drafts}
          updateDraft={updateDraft}
          savingTaskId={savingTaskId}
          uploadingTaskId={uploadingTaskId}
          onClose={closeDetail}
          onUpload={uploadAttachment}
          onDeleteAttachment={deleteAttachment}
          updateTaskStatus={updateTaskStatus}
          uploadSuccessMessage={uploadSuccessByTask[detailTask.id] ?? null}
          onPreviewAttachment={setAssetPreview}
        />
      ) : null}
      <AssetPreviewModal attachment={assetPreview} onClose={closeAssetPreview} />
    </div>
  )
}

function KanbanColumn({
  statusKey,
  tasks,
  savingTaskId,
  currentUnitTaskIdByService,
  updateTaskStatus,
  submitForReview,
  onOpenDetail,
}: {
  statusKey: TaskStatusKey
  tasks: TaskRow[]
  savingTaskId: number | null
  currentUnitTaskIdByService: Record<number, number>
  updateTaskStatus: (taskId: number, status: TaskStatusKey, includeSubmission?: boolean) => Promise<void>
  submitForReview: (taskId: number) => Promise<void>
  onOpenDetail: (id: number) => void
}) {
  const isDone = statusKey === 'done'
  const [showAllDone, setShowAllDone] = useState(false)
  const visibleTasks = isDone && !showAllDone ? tasks.slice(0, 3) : tasks
  const hiddenCount = isDone && !showAllDone ? Math.max(0, tasks.length - visibleTasks.length) : 0
  const progress = useMemo(() => {
    const seen = new Set<number>()
    let completed = 0
    let total = 0
    for (const t of tasks) {
      if (!t.service_id || !t.service_progress) continue
      if (seen.has(t.service_id)) continue
      seen.add(t.service_id)
      completed += Number(t.service_progress.completed ?? 0)
      total += Number(t.service_progress.total ?? 0)
    }
    return { completed, total }
  }, [tasks])

  return (
    <section className="min-w-0 rounded-xl border border-slate-800/80 bg-slate-900/35">
      <div className="sticky top-0 z-[1] border-b border-slate-800/80 bg-slate-900/95 px-3 py-2.5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-200">
            {STATUS_LABEL[statusKey]}
          </h2>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">{tasks.length}</span>
        </div>
        {progress.total > 0 ? (
          <p className="mt-1 text-[10px] text-slate-500">
            Progress: <span className="text-slate-300">{progress.completed} / {progress.total} completed</span>
          </p>
        ) : null}
      </div>
      <div className="space-y-2 px-2.5 py-3">
        {tasks.length === 0 ? (
          <p className="whitespace-pre-line px-0.5 py-6 text-center text-[11px] leading-relaxed text-slate-500">
            {EMPTY_HINT[statusKey]}
          </p>
        ) : (
          <ul className="space-y-3.5">
            {visibleTasks.map((t) => (
              <li key={t.id} id={`task-${t.id}`} className="scroll-mt-28">
                <CompactTaskCard
                  task={t}
                  statusKey={statusKey}
                  savingTaskId={savingTaskId}
                  isCurrentUnit={t.service_id != null && currentUnitTaskIdByService[t.service_id] === t.id}
                  onOpenDetail={() => onOpenDetail(t.id)}
                  onStart={() => void updateTaskStatus(t.id, 'doing')}
                  onSubmitWork={() => onOpenDetail(t.id)}
                  onSubmitForReview={() => void submitForReview(t.id)}
                  onContinue={() => void updateTaskStatus(t.id, 'doing')}
                />
              </li>
            ))}
            {hiddenCount > 0 ? (
              <li>
                <button
                  type="button"
                  onClick={() => setShowAllDone(true)}
                  className="w-full rounded-lg border border-slate-700/80 bg-slate-900/55 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
                >
                  View all → ({hiddenCount} more)
                </button>
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </section>
  )
}

function CompactTaskCard({
  task: t,
  statusKey: columnStatusKey,
  savingTaskId,
  isCurrentUnit = false,
  onOpenDetail,
  onStart,
  onSubmitWork,
  onSubmitForReview,
  onContinue,
}: {
  task: TaskRow
  statusKey: TaskStatusKey
  savingTaskId: number | null
  isCurrentUnit?: boolean
  onOpenDetail: () => void
  onStart: () => void
  onSubmitWork: () => void
  onSubmitForReview: () => void
  onContinue: () => void
}) {
  const submittedFiles = submissionAttachments(t.attachments)
  const taskStatusKey = (['todo', 'doing', 'review', 'revision', 'done'].includes(t.status)
    ? t.status
    : columnStatusKey) as TaskStatusKey
  const isMinimalFocusCard = taskStatusKey === 'doing'
  const projectName = t.project?.name ?? null
  const clientName = t.project?.client?.name ?? null
  const client = t.project?.client ?? null
  const serviceProgress = t.service_progress
  const unitLabel = t.service_unit ? `Deliverable ${t.service_unit.index} of ${t.service_unit.total}` : null
  const urgency = dueUrgency(t.deadline, taskStatusKey)
  const dueClass =
    urgency === 'overdue' && taskStatusKey !== 'done'
      ? 'font-semibold text-red-400'
      : urgency === 'today' && taskStatusKey !== 'done'
        ? 'font-semibold text-red-300'
        : urgency === 'tomorrow' && taskStatusKey !== 'done'
          ? 'font-semibold text-amber-400'
        : 'text-slate-400'
  const dueLabel =
    !t.deadline || taskStatusKey === 'done'
      ? 'No due date'
      : urgency === 'today'
        ? '🔴 Due Today'
        : urgency === 'tomorrow'
          ? '🟠 Due Tomorrow'
          : urgency === 'overdue'
            ? `Overdue · ${formatDueShort(t.deadline)}`
            : `Due ${formatDueShort(t.deadline)}`
  const statusStripClass =
    urgency === 'overdue' && taskStatusKey !== 'done'
      ? 'bg-red-500'
      : (urgency === 'today' || urgency === 'tomorrow') && taskStatusKey !== 'done'
        ? 'bg-amber-400'
        : taskStatusKey === 'doing' || taskStatusKey === 'revision'
          ? 'bg-sky-500'
          : taskStatusKey === 'todo'
            ? 'bg-emerald-500'
            : 'bg-slate-500'
  const [isClientKitQuickOpen, setIsClientKitQuickOpen] = useState(false)

  return (
    <div
      className="relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950/90 p-4 shadow-sm md:px-3.5 md:py-3.5"
    >
      <span className={`absolute inset-y-0 left-0 w-0.5 ${statusStripClass}`} aria-hidden />
      <div>
      <p className="line-clamp-2 text-lg font-bold leading-tight text-white md:text-[16px] md:leading-snug">
        {t.title}
      </p>
      {(clientName || projectName) ? (
        <p className="mt-1.5 line-clamp-1 text-xs text-slate-300">
          {clientName ? `Client: ${clientName}` : projectName}
        </p>
      ) : null}
      {!isMinimalFocusCard && unitLabel ? (
        <p className="mt-2 text-sm font-semibold text-white">{unitLabel}</p>
      ) : null}
      {!isMinimalFocusCard && isCurrentUnit && unitLabel ? (
        <p className="mt-1 text-xs font-medium text-emerald-300">⚡ Active - {unitLabel}</p>
      ) : null}
      {!isMinimalFocusCard ? (
        <>
          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            {serviceProgress && serviceProgress.total > 0 ? (
              <span className="text-slate-300">
                Progress: {serviceProgress.completed} of {serviceProgress.total} completed
              </span>
            ) : <span />}
            {isCurrentUnit ? <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">Active</span> : null}
          </div>
          <p className={`mt-1.5 inline-flex items-center gap-1 text-[11px] ${dueClass}`} aria-label={t.deadline ? 'Due date' : undefined}>
            <CalendarDays className="h-3.5 w-3.5" />
            {dueLabel}
            <span className="text-slate-500">•</span>
            <Flag className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-slate-300">{t.priority}</span>
          </p>
        </>
      ) : null}
      </div>
      <div className={`border-slate-800/50 ${isMinimalFocusCard ? 'mt-4 border-t pt-4' : 'mt-3 border-t pt-2.5'}`}>
      {!isMinimalFocusCard ? (
        <p className="mt-1.5 text-[10px] text-slate-500 md:hidden">
          <span className="text-slate-600">Status</span> {STATUS_LABEL[taskStatusKey]}
        </p>
      ) : null}

      <div
        className="mt-3.5 flex flex-col gap-2.5 max-md:mt-4 max-md:gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {client ? (
          <div className="rounded-md border border-slate-700/80 bg-slate-900/40 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Client Kit</p>
            <button
              type="button"
              onClick={() => setIsClientKitQuickOpen(true)}
              className="mt-1.5 w-full rounded-md border border-slate-600/80 bg-slate-900/70 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
            >
              Open
            </button>
          </div>
        ) : null}
        {taskStatusKey !== 'done' && submittedFiles.length > 0 ? (
          <p className="text-[10px] text-slate-500">
            Your submission: <span className="text-slate-300">{submittedFiles.length} file(s)</span>
          </p>
        ) : null}
        {taskStatusKey === 'todo' ? (
          <button
            type="button"
            disabled={savingTaskId === t.id}
            onClick={() => onStart()}
            className="w-full min-h-[48px] rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 max-md:text-sm md:min-h-0 md:rounded-md md:py-2.5 md:text-xs"
          >
            {savingTaskId === t.id ? 'Starting…' : 'Start Work →'}
          </button>
        ) : null}
        {taskStatusKey === 'doing' ? (
          <>
            <button
              type="button"
              disabled={savingTaskId === t.id}
              onClick={() => onSubmitForReview()}
              className="w-full min-h-[48px] rounded-xl bg-emerald-600 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 max-md:text-sm md:min-h-0 md:rounded-lg md:py-2.5 md:text-xs"
            >
              {savingTaskId === t.id ? 'Sending…' : 'Submit for review'}
            </button>
            <button
              type="button"
              disabled={savingTaskId === t.id}
              onClick={() => onSubmitWork()}
              className="w-full min-h-11 rounded-xl border border-slate-600/90 bg-slate-900/60 py-2.5 text-center text-xs font-semibold text-slate-200 hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50 max-md:min-h-12 md:min-h-0 md:rounded-md md:py-2.5"
            >
              Add files & details →
            </button>
          </>
        ) : null}
        {taskStatusKey === 'revision' ? (
          <button
            type="button"
            disabled={savingTaskId === t.id}
            onClick={() => onContinue()}
            className="w-full min-h-[48px] rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-500 active:scale-[0.99] disabled:opacity-50 max-md:text-sm md:min-h-0 md:rounded-md md:py-2.5 md:text-xs"
          >
            {savingTaskId === t.id ? 'Updating…' : 'Continue Work →'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenDetail}
          className="w-full rounded-md border border-slate-700/80 bg-slate-900/50 py-2 text-[11px] font-medium text-slate-300 hover:bg-slate-800/90"
        >
          View Full Details
        </button>
        {taskStatusKey === 'review' ? (
          <button
            type="button"
            onClick={() => onOpenDetail()}
            className="w-full min-h-[48px] rounded-xl border border-slate-600/80 bg-slate-900/50 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/90 active:scale-[0.99] max-md:text-sm md:min-h-0 md:rounded-md md:py-2.5 md:text-xs"
          >
            View submission
          </button>
        ) : null}
        {taskStatusKey === 'done' ? (
          <button
            type="button"
            onClick={() => onOpenDetail()}
            className="w-full min-h-[48px] rounded-xl border border-slate-600/80 bg-slate-900/50 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/90 active:scale-[0.99] max-md:text-sm md:min-h-0 md:rounded-md md:py-2.5 md:text-xs"
          >
            View
          </button>
        ) : null}
      </div>
      </div>
      {client && isClientKitQuickOpen ? (
        <ClientKitQuickModal client={client} onClose={() => setIsClientKitQuickOpen(false)} />
      ) : null}
    </div>
  )
}

function ClientKitQuickModal({ client, onClose }: { client: ClientBrandKit; onClose: () => void }) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [brandLogoOpen, setBrandLogoOpen] = useState(false)

  async function handleCopy(value: string, label: string) {
    if (!value) return
    const ok = await copyToClipboard(value)
    if (!ok) return
    setCopiedField(label)
    window.setTimeout(() => setCopiedField((cur) => (cur === label ? null : cur)), 1600)
  }

  return (
    <>
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-[3px]"
        aria-label="Close client kit"
        onClick={onClose}
      />
      <div className="relative z-[121] w-full max-w-md overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#0b1220] p-5 shadow-[0_24px_80px_rgba(2,12,32,0.75)] sm:p-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-70"
          style={{ background: 'linear-gradient(180deg, rgba(34,211,238,0.12), rgba(34,211,238,0.00))' }}
          aria-hidden
        />
        {copiedField ? (
          <div className="absolute right-4 top-4 rounded-full border border-emerald-300/30 bg-emerald-500/20 px-2.5 py-1 text-[10px] font-medium text-emerald-200 shadow-lg">
            Copied {copiedField}
          </div>
        ) : null}
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
              Client Kit
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">{client.name}</h3>
            <p className="mt-0.5 text-xs text-slate-500">Quick brand and contact access</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 border-t border-slate-800/90" />

        <div className="mt-4 space-y-2.5 text-sm">
          {client.phone ? (
            <div className="group flex items-center justify-between rounded-xl border border-slate-700/90 bg-slate-900/65 px-3 py-2.5 text-slate-200 transition hover:border-cyan-400/35 hover:bg-slate-900">
              <span><span className="text-slate-400">Phone:</span> {client.phone}</span>
              <button
                type="button"
                onClick={() => void handleCopy(client.phone ?? '', 'Phone')}
                className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 p-2 text-emerald-300 ring-1 ring-emerald-500/15 transition hover:bg-emerald-500/25 hover:text-emerald-100 active:scale-[0.96]"
                aria-label="Copy phone number"
              >
                <ClipboardCopy className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          {client.email ? (
            <div className="group flex items-center justify-between rounded-xl border border-slate-700/90 bg-slate-900/65 px-3 py-2.5 text-slate-200 transition hover:border-cyan-400/35 hover:bg-slate-900">
              <span><span className="text-slate-400">Email:</span> {client.email}</span>
              <button
                type="button"
                onClick={() => void handleCopy(client.email ?? '', 'Email')}
                className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 p-2 text-emerald-300 ring-1 ring-emerald-500/15 transition hover:bg-emerald-500/25 hover:text-emerald-100 active:scale-[0.96]"
                aria-label="Copy email"
              >
                <ClipboardCopy className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          {client.address ? (
            <div className="group flex items-start justify-between rounded-xl border border-slate-700/90 bg-slate-900/65 px-3 py-2.5 text-slate-200 transition hover:border-cyan-400/35 hover:bg-slate-900">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Address</p>
                <p className="mt-1 whitespace-pre-line leading-relaxed">
                  {client.address.replace(/\s*,\s*/g, '\n')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy(client.address ?? '', 'Address')}
                className="mt-0.5 inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center self-start rounded-lg border border-emerald-500/40 bg-emerald-500/15 p-2 text-emerald-300 ring-1 ring-emerald-500/15 transition hover:bg-emerald-500/25 hover:text-emerald-100 active:scale-[0.96]"
                aria-label="Copy address"
              >
                <ClipboardCopy className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        {normalizedBrandPalette(client).length > 0 ? (
          <div className="mt-5 border-t border-slate-800/90 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Brand Colors</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {normalizedBrandPalette(client).map((hex, idx) => (
                <button
                  key={`${hex}-${idx}`}
                  type="button"
                  onClick={() => void handleCopy(hex, `color ${hex}`)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-emerald-400/40 hover:bg-slate-800"
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white/30" style={{ backgroundColor: hex }} />
                  #{hex.replace(/^#/, '')}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 border-t border-slate-800/90 pt-4">
          {client.logo_url ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="w-full text-[10px] font-semibold uppercase tracking-wide text-slate-500">Logo</p>
              <button
                type="button"
                onClick={() => setBrandLogoOpen(true)}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/12 px-3 py-1.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/15 transition hover:bg-emerald-500/22"
              >
                Preview logo
              </button>
              <button
                type="button"
                onClick={() => void downloadProtectedFile(client.logo_url!, `${client.name}-logo`)}
                className="rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25 hover:shadow-[0_0_0_1px_rgba(52,211,153,0.25)]"
              >
                Download Logo
              </button>
            </div>
          ) : null}
        </div>

        {client.business_profile_url ? (
          <div className="mt-5 border-t border-slate-800/90 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Business Profile</p>
            <button
              type="button"
              onClick={() => void openProtectedFile(client.business_profile_url!)}
              className="mt-2 rounded-md border border-violet-500/35 bg-violet-500/12 px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:bg-violet-500/22"
            >
              Open PDF
            </button>
          </div>
        ) : null}

        <div className="mt-5 border-t border-slate-800/90 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
    {client.logo_url ? (
      <BrandLogoPreviewModal
        open={brandLogoOpen}
        onClose={() => setBrandLogoOpen(false)}
        clientName={client.name}
        logoUrl={client.logo_url}
      />
    ) : null}
    </>
  )
}

function TaskDetailModal({
  task: t,
  drafts,
  updateDraft,
  savingTaskId,
  uploadingTaskId,
  uploadSuccessMessage,
  onClose,
  onUpload,
  onDeleteAttachment,
  updateTaskStatus,
  onPreviewAttachment,
}: {
  task: TaskRow
  drafts: Record<number, { submission_link: string; submission_notes: string }>
  updateDraft: (taskId: number, key: 'submission_link' | 'submission_notes', value: string) => void
  savingTaskId: number | null
  uploadingTaskId: number | null
  uploadSuccessMessage: string | null
  onClose: () => void
  onUpload: (taskId: number, file: File) => Promise<void>
  onDeleteAttachment: (taskId: number, attachmentId: number) => Promise<void>
  updateTaskStatus: (taskId: number, status: TaskStatusKey, includeSubmission?: boolean) => Promise<void>
  onPreviewAttachment: (attachment: AttachmentItem) => void
}) {
  const statusKey = (['todo', 'doing', 'review', 'revision', 'done'].includes(t.status)
    ? t.status
    : 'todo') as TaskStatusKey
  const adminFiles = referenceAttachments(t.attachments)
  const teamFiles = submissionAttachments(t.attachments)

  const description = cleanBodyText(t.description)
  const instructions = cleanBodyText(t.instructions)
  const instructionLines = useMemo(() => parseInstructionLines(instructions), [instructions])
  const clientContent = cleanBodyText(t.client_content)
  const refUrl = t.reference_url?.trim() ?? ''
  const [isDragOverUpload, setIsDragOverUpload] = useState(false)
  const [isInstructionsExpanded, setIsInstructionsExpanded] = useState(false)

  const primaryFooter =
    statusKey === 'todo'
      ? {
          label: savingTaskId === t.id ? 'Starting…' : 'Start task',
          onClick: () => void updateTaskStatus(t.id, 'doing'),
          disabled: savingTaskId === t.id,
          variant: 'emerald' as const,
        }
      : statusKey === 'doing'
        ? {
            label:
              savingTaskId === t.id
                ? 'Sending…'
                : t.service_unit
                  ? `Submit Unit #${t.service_unit.index} for review →`
                  : 'Submit for Review →',
            onClick: () => void updateTaskStatus(t.id, 'review', true),
            disabled: savingTaskId === t.id,
            variant: 'emerald' as const,
          }
        : statusKey === 'revision'
          ? {
              label: savingTaskId === t.id ? 'Updating…' : 'Continue task',
              onClick: () => void updateTaskStatus(t.id, 'doing'),
              disabled: savingTaskId === t.id,
              variant: 'sky' as const,
            }
          : {
              label: 'Back to board',
              onClick: () => onClose(),
              disabled: false,
              variant: 'emerald' as const,
            }
  const dueTone = dueUrgency(t.deadline, statusKey)
  const dueText =
    !t.deadline || statusKey === 'done'
      ? 'No due date'
      : dueTone === 'today'
        ? 'Due today'
        : dueTone === 'tomorrow'
          ? 'Due tomorrow'
          : dueTone === 'overdue'
            ? `Overdue - ${formatDueShort(t.deadline)}`
            : `Due ${formatDueShort(t.deadline)}`
  const deliverableText = t.service_unit
    ? `${t.service_unit.index} of ${t.service_unit.total}`
    : 'Not set'
  const isSubmissionFocus = statusKey === 'doing'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-[3px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-[101] flex max-h-[min(88svh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#0b1220] shadow-[0_24px_90px_rgba(2,12,32,0.85)] sm:max-h-[min(92vh,760px)]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-70"
          style={{ background: 'linear-gradient(180deg, rgba(34,211,238,0.14), rgba(34,211,238,0.00))' }}
          aria-hidden
        />
        {/* Header */}
        <div className="relative flex shrink-0 items-start justify-between gap-3 border-b border-slate-800/90 px-4 pb-3.5 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
          <div className="min-w-0 flex-1 pr-1">
            <p className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-200 sm:text-[10px] sm:tracking-[0.14em]">
              Task Details
            </p>
            <p
              id="task-detail-title"
              className="mt-1.5 text-[1.18rem] font-bold leading-tight tracking-tight text-white sm:mt-2 sm:text-xl"
            >
              {t.title}
            </p>
            <div className="mt-1 space-y-0.5 text-[13px] text-slate-400 sm:text-sm">
              {t.project?.client?.name ? <p>Client: {t.project.client.name}</p> : null}
              {t.agency_service?.name ? <p>Service: {t.agency_service.name}</p> : null}
              <p>Deliverable: {deliverableText}</p>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:mt-3 sm:gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeStyles(statusKey)}`}>
                {STATUS_LABEL[statusKey]}
              </span>
              <span className="rounded-full bg-slate-800/40 px-2.5 py-1 text-[11px] text-slate-300">
                {dueText}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white active:scale-[0.98]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5 sm:px-6 sm:py-6 [scrollbar-width:thin]">
          {!isSubmissionFocus ? (
            <>
              <section aria-label="Task info" className="space-y-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:space-y-3 sm:p-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Task info</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-800/90 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                    {t.priority}
                  </span>
                  {t.deliverable_type && t.deliverable_type !== 'other' ? (
                    <span className="rounded-full bg-slate-800/90 px-2.5 py-1 text-[11px] font-medium text-slate-400">
                      {t.deliverable_type}
                    </span>
                  ) : null}
                  {t.agency_service ? (
                    <span className="rounded-full bg-slate-800/50 px-2.5 py-1 text-[11px] text-slate-300">
                      {t.agency_service.name}
                    </span>
                  ) : null}
                </div>
              </section>

              {description ? (
                <section className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:mt-4 sm:p-4">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">What to do</h3>
                  <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-100 sm:mt-2 sm:text-sm">{description}</p>
                </section>
              ) : null}

              {instructions ? (
                <section className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:mt-6 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                      <Pin className="h-3.5 w-3.5 text-emerald-400/90" />
                      Instructions
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => copyText(instructionLines.join('\n'))}
                        className="rounded-md border border-white/[0.12] bg-white/[0.02] px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/[0.06]"
                      >
                        Copy
                      </button>
                      {instructionLines.length > 3 ? (
                        <button
                          type="button"
                          onClick={() => setIsInstructionsExpanded((v) => !v)}
                          className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20"
                        >
                          {isInstructionsExpanded ? 'Collapse ↑' : 'Expand ↓'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 rounded-lg border border-white/[0.05] border-l-[3px] border-l-emerald-500/80 bg-white/[0.025] p-3">
                    <div
                      className={`overflow-hidden transition-[max-height] duration-300 ease-out ${isInstructionsExpanded ? 'max-h-[220px] overflow-y-auto pr-1' : 'max-h-[140px]'}`}
                    >
                      <ul className="space-y-2">
                        {(isInstructionsExpanded ? instructionLines : instructionLines.slice(0, 3)).map((line, idx) => (
                          <li key={`instruction-${idx}`} className="text-[14px] leading-[1.6] tracking-[0.2px] text-slate-200">
                            <span className="mr-1.5 align-top text-emerald-300">•</span>
                            <span className="inline-flex flex-wrap items-center gap-1.5">
                              {tokenizeInstructionLine(line).map((token, tokenIdx) => {
                                if (token.kind === 'color') {
                                  return (
                                    <button
                                      key={`instruction-token-${idx}-${tokenIdx}`}
                                      type="button"
                                      onClick={() => copyText(token.value)}
                                      className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[12px] text-emerald-200 hover:bg-emerald-500/20"
                                    >
                                      <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/30" style={{ backgroundColor: token.value }} />
                                      {token.value}
                                    </button>
                                  )
                                }
                                if (token.kind === 'link') {
                                  return (
                                    <a
                                      key={`instruction-token-${idx}-${tokenIdx}`}
                                      href={referenceHref(token.value)}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      className="text-emerald-300 underline-offset-2 hover:underline"
                                    >
                                      {token.value}
                                    </a>
                                  )
                                }
                                return <span key={`instruction-token-${idx}-${tokenIdx}`}>{token.value}</span>
                              })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {instructionLines.length > 3 ? (
                      <button
                        type="button"
                        onClick={() => setIsInstructionsExpanded((v) => !v)}
                        className="mt-2 inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
                      >
                        {isInstructionsExpanded ? 'Collapse instructions ↑' : 'View full instructions →'}
                      </button>
                    ) : null}
                  </div>
                </section>
              ) : (
                <section className="mt-3 rounded-xl border border-amber-500/20 bg-amber-950/20 px-3 py-2.5 sm:mt-4">
                  <p className="text-xs text-amber-100/90">No brief on this task yet. Ask the admin to add a clear brief.</p>
                </section>
              )}

              {clientContent ? (
                <section className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:mt-4 sm:p-4">
                  <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                    <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                    Output Required / Reference Notes
                  </h3>
                  <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-slate-200 sm:mt-2 sm:text-sm">{clientContent}</p>
                </section>
              ) : null}

              {refUrl ? (
                <section className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:mt-4 sm:p-4">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">Reference / style</h3>
                  <a
                    href={referenceHref(refUrl)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 inline-block break-all text-[13px] text-emerald-400 underline-offset-2 hover:underline sm:text-sm"
                  >
                    {refUrl}
                  </a>
                </section>
              ) : null}

              {t.project?.client ? <ClientBrandPanel client={t.project.client} className="mt-4" /> : null}

              {t.admin_feedback ? (
                <section className="mt-3 rounded-xl border border-amber-500/25 bg-amber-950/25 px-3 py-2.5 sm:mt-4 sm:px-4 sm:py-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90">Admin feedback</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-amber-100/95 sm:mt-2 sm:text-sm">{t.admin_feedback}</p>
                </section>
              ) : null}

              {/* References from admin */}
              {adminFiles.length > 0 ? (
                <section className="mt-4 sm:mt-6">
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-300">Assets (Reference)</h3>
                  <AttachmentBlock
                    className="mt-0"
                    title=""
                    attachments={adminFiles}
                    onOpen={(a) => onPreviewAttachment(a)}
                    onDownload={(a) => void downloadProtectedFile(a.url, a.original_name)}
                  />
                </section>
              ) : null}
            </>
          ) : null}

          {/* Work & submission — grouped */}
          <section className="mt-4 border-t border-slate-800/90 pt-4 sm:mt-6 sm:pt-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Submit Your Work</h3>
            <p className="mt-1 text-xs text-slate-500">Upload final files or share a working link, then submit for review.</p>

            <div className="mt-3 space-y-3 rounded-xl border border-slate-700/60 bg-slate-950/60 p-3 ring-1 ring-white/[0.04] sm:mt-4 sm:space-y-4 sm:p-4">
              {statusKey === 'doing' ? (
                <div className="space-y-4 border-b border-slate-800/90 pb-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 sm:text-xs">Upload file</label>
                    <p className="mt-0.5 text-[11px] text-slate-500">Drag & drop files here or click to upload</p>
                    <label
                      htmlFor={`upload-file-${t.id}`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setIsDragOverUpload(true)
                      }}
                      onDragLeave={() => setIsDragOverUpload(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setIsDragOverUpload(false)
                        const file = e.dataTransfer.files?.[0]
                        if (file) void onUpload(t.id, file)
                      }}
                      className={`mt-2 flex min-h-[92px] w-full cursor-pointer items-center justify-center rounded-xl border border-dashed px-4 py-3 text-center transition sm:min-h-[108px] sm:py-4 ${
                        isDragOverUpload
                          ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200'
                          : 'border-slate-600 bg-slate-900/70 text-slate-400 hover:border-slate-500 hover:bg-slate-900'
                      }`}
                    >
                      <div className="space-y-1">
                        <Upload className="mx-auto h-5 w-5 text-emerald-400/90" aria-hidden />
                        <p className="text-[13px] font-medium sm:text-sm">Drop files here</p>
                        <p className="text-[11px] sm:text-xs">or click to upload</p>
                      </div>
                    </label>
                    <input
                      id={`upload-file-${t.id}`}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void onUpload(t.id, file)
                        e.currentTarget.value = ''
                      }}
                      disabled={uploadingTaskId === t.id}
                    />
                    {uploadingTaskId === t.id ? <p className="mt-2 text-xs text-emerald-400/90">Uploading…</p> : null}
                    {uploadSuccessMessage ? (
                      <p className="mt-2 text-xs text-emerald-300">✔ {uploadSuccessMessage}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3 py-1 text-[11px] uppercase tracking-wide text-slate-600">
                    <span className="h-px flex-1 bg-slate-800" />
                    <span>Or</span>
                    <span className="h-px flex-1 bg-slate-800" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 sm:text-xs">Paste link</label>
                    <p className="mt-0.5 text-[11px] text-slate-500">Google Drive, Figma, or YouTube</p>
                    <input
                      value={drafts[t.id]?.submission_link ?? ''}
                      onChange={(e) => updateDraft(t.id, 'submission_link', e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-[13px] text-slate-200 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none sm:mt-2 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 sm:text-xs">Notes (optional)</label>
                    <textarea
                      rows={2}
                      value={drafts[t.id]?.submission_notes ?? ''}
                      onChange={(e) => updateDraft(t.id, 'submission_notes', e.target.value)}
                      placeholder="Add message for admin"
                      className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-[13px] text-slate-200 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none sm:mt-2 sm:text-sm"
                    />
                  </div>
                </div>
              ) : null}

              {t.submission_link ? (
                <div className={statusKey === 'doing' ? 'space-y-1' : 'space-y-1 pb-2'}>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Submitted link</p>
                  <a
                    href={t.submission_link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="break-all text-sm text-emerald-400 underline-offset-2 hover:underline"
                  >
                    {t.submission_link}
                  </a>
                </div>
              ) : null}

              {teamFiles.length > 0 ? (
                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">Submitted files</p>
                  <AttachmentBlock
                    className="mt-0"
                    title=""
                    attachments={teamFiles}
                    onOpen={(a) => onPreviewAttachment(a)}
                    onDownload={(a) => void downloadProtectedFile(a.url, a.original_name)}
                    onDelete={(a) => void onDeleteAttachment(t.id, a.id)}
                  />
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {/* Footer — primary CTA first in tab order; visual: primary on right on desktop */}
        <div className="shrink-0 border-t border-slate-800/90 bg-slate-950/40 px-4 py-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-row-reverse sm:justify-start sm:gap-3">
            <button
              type="button"
              disabled={primaryFooter.disabled}
              onClick={primaryFooter.onClick}
              className={`min-h-[44px] w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition disabled:opacity-50 sm:min-h-[48px] sm:min-w-[200px] sm:w-auto sm:py-3 ${
                primaryFooter.variant === 'sky'
                  ? 'bg-sky-600 hover:bg-sky-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {primaryFooter.label}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] w-full rounded-xl border border-slate-600 bg-transparent px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/80 sm:min-h-[44px] sm:w-auto sm:py-2.5"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ClientBrandPanel({ client, className = '' }: { client: ClientBrandKit; className?: string }) {
  const palette = normalizedBrandPalette(client)
  const hasIdentity = client.address || client.phone || client.email
  const hasBrand =
    palette.length > 0 || client.logo_url || client.business_profile_url

  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  async function handleCopyField(value: string, key: string) {
    const ok = await copyToClipboard(value)
    if (!ok) return
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    setCopiedKey(key)
    copyTimerRef.current = setTimeout(() => {
      setCopiedKey(null)
      copyTimerRef.current = null
    }, 2000)
  }

  const [brandLogoOpen, setBrandLogoOpen] = useState(false)

  const copyBtnClass =
    'inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-emerald-500/45 bg-emerald-500/15 text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.08)] transition hover:border-emerald-400/60 hover:bg-emerald-500/25 hover:text-emerald-100 active:scale-[0.96] md:min-h-10 md:min-w-10 md:rounded-lg'

  if (!hasIdentity && !hasBrand) {
    return null
  }

  return (
    <div className={`rounded-lg border border-emerald-500/25 bg-emerald-950/20 p-3 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
        Client Kit (Auto-loaded)
      </p>
      {hasIdentity ? (
        <ul className="mt-2 space-y-2 text-xs text-slate-300">
          {client.phone ? (
            <li className="flex items-start gap-2 rounded-lg py-0.5 pr-0.5">
              <Phone className="mt-1 h-4 w-4 shrink-0 text-emerald-400/80" aria-hidden />
              <span className="min-w-0 flex-1 break-all pt-0.5 leading-snug text-slate-200">{client.phone}</span>
              <button
                type="button"
                onClick={() => void handleCopyField(client.phone ?? '', 'phone')}
                className={copyBtnClass}
                aria-label="Copy phone number"
              >
                {copiedKey === 'phone' ? <Check className="h-4 w-4 text-emerald-200" aria-hidden /> : <ClipboardCopy className="h-4 w-4" aria-hidden />}
              </button>
            </li>
          ) : null}
          {client.email ? (
            <li className="flex items-start gap-2 rounded-lg py-0.5 pr-0.5">
              <Mail className="mt-1 h-4 w-4 shrink-0 text-emerald-400/80" aria-hidden />
              <span className="min-w-0 flex-1 break-all pt-0.5 leading-snug text-slate-200">{client.email}</span>
              <button
                type="button"
                onClick={() => void handleCopyField(client.email ?? '', 'email')}
                className={copyBtnClass}
                aria-label="Copy email"
              >
                {copiedKey === 'email' ? <Check className="h-4 w-4 text-emerald-200" aria-hidden /> : <ClipboardCopy className="h-4 w-4" aria-hidden />}
              </button>
            </li>
          ) : null}
          {client.website ? (
            <li className="flex items-start gap-2">
              <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
              <a
                href={client.website}
                target="_blank"
                rel="noreferrer noopener"
                className="break-all text-emerald-400 underline-offset-2 hover:underline"
              >
                {client.website.replace(/^https?:\/\//, '')}
              </a>
            </li>
          ) : null}
          {client.address ? (
            <li className="flex items-start gap-2 rounded-lg py-0.5 pr-0.5">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-emerald-400/80" aria-hidden />
              <span className="min-w-0 flex-1 whitespace-pre-wrap pt-0.5 leading-snug text-slate-200">{client.address}</span>
              <button
                type="button"
                onClick={() => void handleCopyField(client.address ?? '', 'address')}
                className={`${copyBtnClass} self-start`}
                aria-label="Copy address"
              >
                {copiedKey === 'address' ? <Check className="h-4 w-4 text-emerald-200" aria-hidden /> : <ClipboardCopy className="h-4 w-4" aria-hidden />}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {hasBrand ? (
        <div className="mt-3 border-t border-emerald-500/15 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Brand</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {palette.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Palette className="h-3.5 w-3.5 text-slate-500" />
                {palette.map((hex, idx) => (
                  <button
                    key={`${hex}-${idx}`}
                    type="button"
                    onClick={() => void handleCopyField(hex, `hex-${idx}`)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-1 py-1 transition hover:border-emerald-500/25 hover:bg-emerald-500/[0.06]"
                    title={`Copy ${hex}`}
                  >
                    <span
                      className="inline-block h-8 w-8 rounded-lg ring-1 ring-white/25"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="text-[11px] text-slate-300">{hex}</span>
                    <ClipboardCopy className="h-3.5 w-3.5 text-emerald-400/90" aria-hidden />
                  </button>
                ))}
              </div>
            ) : null}
            {client.logo_url ? (
              <button
                type="button"
                onClick={() => setBrandLogoOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/12 px-3 py-2 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/15 transition hover:bg-emerald-500/22 active:scale-[0.98]"
              >
                <Image className="h-3.5 w-3.5" aria-hidden />
                View logo
              </button>
            ) : null}
            {client.business_profile_url ? (
              <button
                type="button"
                onClick={() => void openProtectedFile(client.business_profile_url!)}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-sky-300 hover:bg-slate-700"
              >
                <FileText className="h-3.5 w-3.5" />
                Business profile (PDF)
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {client.logo_url ? (
        <BrandLogoPreviewModal
          open={brandLogoOpen}
          onClose={() => setBrandLogoOpen(false)}
          clientName={client.name}
          logoUrl={client.logo_url}
        />
      ) : null}
    </div>
  )
}

function AttachmentBlock({
  title,
  attachments,
  onOpen,
  onDownload,
  onDelete,
  className = 'mt-3',
}: {
  title: string
  attachments: AttachmentItem[]
  onOpen: (attachment: AttachmentItem) => void
  onDownload: (attachment: AttachmentItem) => void
  onDelete?: (attachment: AttachmentItem) => void
  className?: string
}) {
  if (attachments.length === 0) return null
  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 ${className}`}>
      {title ? <p className="text-[11px] uppercase tracking-wider text-slate-500">{title}</p> : null}
      <ul className={`space-y-1.5 ${title ? 'mt-2' : ''}`}>
        {attachments.map((attachment) => (
          <li key={attachment.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/60 bg-slate-950/70 p-2 text-xs">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <ProtectedAttachmentThumb attachment={attachment} />
              <span className="min-w-0 truncate text-slate-300">{attachment.original_name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpen(attachment)}
                className="rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => onDownload(attachment)}
                className="rounded-md bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-500/20"
              >
                Download
              </button>
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(attachment)}
                  className="rounded-md bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
