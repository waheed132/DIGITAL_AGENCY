import { useEffect, useMemo, useState } from 'react'
import { FileImage, FileVideo, FileText, FolderOpen, Search, Download, ExternalLink } from 'lucide-react'
import { ApiError, apiRequest, downloadProtectedFile, openProtectedFile } from '../../lib/api'

type AssetRow = {
  id: number
  original_name: string
  mime_type: string | null
  size: number | null
  url: string
  uploaded_at: string | null
  task: { id: number; title: string } | null
  project: { id: number; name: string; client: { id: number; name: string } | null } | null
  service: { id: number; name: string; period_label: string | null } | null
  uploader: { id: number; name: string; role: string } | null
}

export function AssetsPage() {
  const [rows, setRows] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'images' | 'videos' | 'pdfs' | 'logo' | 'instagram'>('all')

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiRequest<AssetRow[]>('/api/admin/assets')
        setRows(data)
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load assets')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((a) => {
      const mime = (a.mime_type ?? '').toLowerCase()
      const name = a.original_name.toLowerCase()
      const service = (a.service?.name ?? '').toLowerCase()
      const task = (a.task?.title ?? '').toLowerCase()
      const project = (a.project?.name ?? '').toLowerCase()
      const client = (a.project?.client?.name ?? '').toLowerCase()

      const matchesQuery =
        q.length === 0 ||
        [name, service, task, project, client].some((v) => v.includes(q))

      const matchesFilter =
        filter === 'all' ? true
        : filter === 'images' ? mime.startsWith('image/')
        : filter === 'videos' ? mime.startsWith('video/')
        : filter === 'pdfs' ? mime === 'application/pdf' || name.endsWith('.pdf')
        : filter === 'logo' ? name.includes('logo') || task.includes('logo') || service.includes('logo')
        : name.includes('instagram') || task.includes('instagram') || service.includes('instagram')

      return matchesQuery && matchesFilter
    })
  }, [rows, query, filter])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-5 ring-1 ring-white/[0.04]">
        <div className="inline-flex items-center gap-2 text-indigo-300/90">
          <FolderOpen className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Library</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Agency asset library with quick preview, download, and task context.
        </p>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      {!loading ? (
        <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-[#0c1222]/70 p-4 ring-1 ring-white/[0.04]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by file, project, or task"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-500/40"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {([
              ['all', 'All'],
              ['images', 'Images'],
              ['videos', 'Videos'],
              ['pdfs', 'PDFs'],
              ['logo', 'Logo'],
              ['instagram', 'Instagram'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1.5 text-xs transition ${
                  filter === key
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'bg-white/[0.03] text-slate-400 ring-1 ring-white/[0.07] hover:bg-white/[0.06]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && filteredRows.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] py-12 text-center text-sm text-slate-500">
          No assets uploaded yet. Files will appear here when team submits work.
        </p>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((a) => {
            const isImage = (a.mime_type ?? '').startsWith('image/')
            const isVideo = (a.mime_type ?? '').startsWith('video/')
            const isPdf = (a.mime_type ?? '') === 'application/pdf' || a.original_name.toLowerCase().endsWith('.pdf')
            const typeLabel = isImage ? 'Image' : isVideo ? 'Video' : isPdf ? 'PDF' : 'File'
            const typeClass = isImage ? 'text-sky-300' : isVideo ? 'text-fuchsia-300' : isPdf ? 'text-amber-300' : 'text-slate-300'
            const prettySize = a.size ? `${(a.size / (1024 * 1024)).toFixed(1)} MB` : '—'
            const dateLabel = a.uploaded_at ? new Date(a.uploaded_at).toLocaleDateString() : '—'

            return (
              <article key={a.id} className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/75 p-4 ring-1 ring-white/[0.04]">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
                    {isImage ? <FileImage className="h-5 w-5 text-sky-300" /> : isVideo ? <FileVideo className="h-5 w-5 text-fuchsia-300" /> : <FileText className={`h-5 w-5 ${typeClass}`} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100">{a.original_name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {a.project?.name ?? 'Project'}{a.project?.client?.name ? ` · ${a.project.client.name}` : ''}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-600">{a.task?.title ?? 'No task linked'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className={`rounded-full bg-white/[0.04] px-2 py-1 ${typeClass}`}>{typeLabel}</span>
                      <span className="rounded-full bg-white/[0.04] px-2 py-1 text-slate-400">{prettySize}</span>
                      <span className="rounded-full bg-white/[0.04] px-2 py-1 text-slate-500">{dateLabel}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => void openProtectedFile(a.url)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.12] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/[0.06]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => void downloadProtectedFile(a.url, a.original_name)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.12] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/[0.06]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                    {a.task?.id ? (
                      <button
                        type="button"
                        onClick={() => { window.location.assign(`/admin/tasks#task-${a.task!.id}`) }}
                        className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/25 hover:bg-emerald-500/25"
                      >
                        Open Task
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
