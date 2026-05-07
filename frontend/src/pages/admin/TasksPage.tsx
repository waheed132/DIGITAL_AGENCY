import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Plus, Pencil, Trash2, Search, X, MapPin, Phone, Palette, Image, FileText, Download, ClipboardCopy } from 'lucide-react'
import { ApiError, apiRequest, downloadProtectedFile, openProtectedFile } from '../../lib/api'
import { formatAssigneeInline, formatAssigneePickerLabel } from '../../lib/displayNames'

type ClientKit = {
  id: number
  name: string
  address?: string | null
  phone?: string | null
  brand_primary?: string | null
  brand_secondary?: string | null
  brand_colors?: string[] | null
  logo_url?: string | null
  business_profile_url?: string | null
}

function adminClientPalette(c: ClientKit): string[] {
  if (Array.isArray(c.brand_colors) && c.brand_colors.length > 0) {
    return c.brand_colors.filter((x) => typeof x === 'string' && x.trim() !== '')
  }
  return [c.brand_primary, c.brand_secondary].filter(Boolean) as string[]
}
type ProjectOption = { id: number; name: string; client?: ClientKit | null }
type AssigneeOption = { id: number; name: string; role: string; is_active: boolean }

type TaskItem = {
  id: number
  project_id: number
  service_id?: number | null
  assigned_to: number | null
  title: string
  deliverable_type: string
  description: string | null
  instructions: string | null
  client_content?: string | null
  reference_url?: string | null
  status: string
  priority: string
  deadline: string | null
  submitted_at?: string | null
  reviewed_at?: string | null
  submission_link?: string | null
  submission_notes?: string | null
  admin_feedback?: string | null
  attachments?: AttachmentItem[]
  project?: { id: number; name: string; client?: { name: string } } | null
  assignee?: { id: number; name: string } | null
  agency_service?: {
    id: number
    name: string
    period_label: string | null
    planned_quantity?: number
    unit_price?: string
  } | null
}

type ServiceOption = { id: number; project_id: number; name: string; period_label: string | null }

type AttachmentItem = {
  id: number
  original_name: string
  url: string
  uploader?: { id?: number; name?: string; role?: 'admin' | 'employee' } | null
}

type TaskForm = {
  project_id: string
  service_id: string
  assigned_to: string
  title: string
  deliverable_type: string
  description: string
  instructions: string
  client_content: string
  reference_url: string
  status: string
  priority: string
  deadline: string
  submission_link: string
  submission_notes: string
  admin_feedback: string
}

const EMPTY_FORM: TaskForm = {
  project_id: '',
  service_id: '',
  assigned_to: '',
  title: '',
  deliverable_type: 'other',
  description: '',
  instructions: '',
  client_content: '',
  reference_url: '',
  status: 'todo',
  priority: 'medium',
  deadline: '',
  submission_link: '',
  submission_notes: '',
  admin_feedback: '',
}

const deliverableOptions = [
  { value: 'video_edit', label: 'Video Edit' },
  { value: 'static_post', label: 'Static Post' },
  { value: 'document', label: 'Document' },
  { value: 'reel', label: 'Reel' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' },
]

const TASK_STATUS_SELECT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'In progress' },
  { value: 'review', label: 'In review' },
  { value: 'revision', label: 'Revision' },
  { value: 'done', label: 'Done' },
]

function taskStatusLabel(status: string): string {
  return TASK_STATUS_SELECT_OPTIONS.find((o) => o.value === status)?.label ?? status.replace(/_/g, ' ')
}

function taskPriorityLabel(priority: string): string {
  if (!priority) return priority
  return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase()
}

function deliverableTypeLabel(value: string): string {
  return deliverableOptions.find((o) => o.value === value)?.label ?? value.replace(/_/g, ' ')
}

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [services, setServices] = useState<ServiceOption[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [assignees, setAssignees] = useState<AssigneeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState<TaskForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const titleRef = useRef<HTMLInputElement | null>(null)

  const isEdit = selectedId !== null
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form, initialForm])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [taskRows, projectRows, userRows, serviceRows] = await Promise.all([
        apiRequest<TaskItem[]>('/api/admin/tasks'),
        apiRequest<ProjectOption[]>('/api/admin/projects'),
        apiRequest<AssigneeOption[]>('/api/admin/users'),
        apiRequest<ServiceOption[]>('/api/admin/agency-services'),
      ])
      setTasks(taskRows)
      setProjects(projectRows)
      setServices(serviceRows)
      setAssignees(
        userRows.filter(
          (u) => u.is_active && (u.role === 'admin' || u.role === 'employee'),
        ),
      )
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])
  useEffect(() => {
    if (!projects.length || modalOpen) return
    const params = new URLSearchParams(window.location.search)
    const clientId = params.get('client_id')
    if (!clientId) return
    const match = projects.find((p) => String(p.client?.id ?? '') === clientId)
    if (!match) return
    setForm((s) => ({ ...s, project_id: String(match.id) }))
  }, [projects, modalOpen])
  useEffect(() => {
    if (modalOpen) setTimeout(() => titleRef.current?.focus(), 0)
  }, [modalOpen])
  useEffect(() => {
    if (!modalOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeModal()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const servicesForProject = useMemo(() => {
    const pid = form.project_id ? Number(form.project_id) : null
    if (!pid) return []
    return services.filter((s) => s.project_id === pid)
  }, [form.project_id, services])
  const selectedProject = useMemo(
    () => projects.find((p) => String(p.id) === form.project_id) ?? null,
    [projects, form.project_id],
  )
  const selectedClient = selectedProject?.client ?? null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter((t) => {
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter
      if (!matchesStatus) return false
      if (!q) return true
      return [t.title, t.deliverable_type, t.status, t.priority, t.project?.name, t.assignee?.name, t.instructions, t.agency_service?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    })
  }, [tasks, search, statusFilter])

  function openCreate() {
    setSelectedId(null)
    const params = new URLSearchParams(window.location.search)
    const clientId = params.get('client_id')
    const match = clientId ? projects.find((p) => String(p.client?.id ?? '') === clientId) : null
    setForm({ ...EMPTY_FORM, project_id: match ? String(match.id) : '' })
    setInitialForm(EMPTY_FORM)
    setPendingFiles([])
    setError(null)
    setMessage(null)
    setModalOpen(true)
  }

  function openEdit(t: TaskItem) {
    const editForm: TaskForm = {
      project_id: String(t.project_id),
      service_id: t.service_id ? String(t.service_id) : '',
      assigned_to: t.assigned_to ? String(t.assigned_to) : '',
      title: t.title ?? '',
      deliverable_type: t.deliverable_type ?? 'other',
      description: t.description ?? '',
      instructions: t.instructions ?? '',
      client_content: t.client_content ?? '',
      reference_url: t.reference_url ?? '',
      status: t.status ?? 'todo',
      priority: t.priority ?? 'medium',
      deadline: t.deadline ? t.deadline.slice(0, 10) : '',
      submission_link: t.submission_link ?? '',
      submission_notes: t.submission_notes ?? '',
      admin_feedback: t.admin_feedback ?? '',
    }
    setSelectedId(t.id)
    setForm(editForm)
    setInitialForm(editForm)
    setError(null)
    setMessage(null)
    setModalOpen(true)
  }

  function closeModal() {
    if (busy) return
    if (isDirty) {
      const leave = window.confirm('Discard unsaved changes?')
      if (!leave) return
    }
    setModalOpen(false)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.project_id) return setError('Please select a project.')
    if (!form.title.trim()) return setError('Task title is required.')
    if (form.instructions.trim().length < 5) {
      return setError('Task brief (instructions) is required—at least 5 characters so the team knows what to deliver.')
    }
    if (servicesForProject.length > 0 && !form.service_id) {
      return setError('Select a service. This work should sit under a proposal line (e.g. Instagram Posts 1–20).')
    }

    setBusy(true)
    setError(null)
    setMessage(null)

    const payload = JSON.stringify({
      project_id: Number(form.project_id),
      service_id: form.service_id ? Number(form.service_id) : null,
      assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      title: form.title.trim(),
      deliverable_type: form.deliverable_type,
      description: form.description.trim() || null,
      instructions: form.instructions.trim(),
      client_content: form.client_content.trim() || null,
      reference_url: form.reference_url.trim() || null,
      status: form.status,
      priority: form.priority,
      deadline: form.deadline || null,
      submission_link: form.submission_link.trim() || null,
      submission_notes: form.submission_notes.trim() || null,
      admin_feedback: form.admin_feedback.trim() || null,
    })

    try {
      if (isEdit && selectedId) {
        await apiRequest(`/api/admin/tasks/${selectedId}`, { method: 'PATCH', body: payload })
      } else {
        const created = await apiRequest<TaskItem>('/api/admin/tasks', { method: 'POST', body: payload })
        for (const file of pendingFiles) {
          await uploadFileToTask(created.id, file)
        }
        setPendingFiles([])
      }
      setMessage(isEdit ? 'Task updated successfully.' : 'Task created successfully.')
      setInitialForm(form)
      await loadAll()
      setModalOpen(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save task')
    } finally {
      setBusy(false)
    }
  }

  async function uploadFileToTask(taskId: number, file: File) {
    setUploadingAttachment(true)
    try {
      const body = new FormData()
      body.append('file', file)
      await apiRequest(`/api/admin/tasks/${taskId}/attachments`, { method: 'POST', body })
    } finally {
      setUploadingAttachment(false)
    }
  }

  async function remove(task: TaskItem) {
    const confirmed = window.confirm(`Delete task "${task.title}"?\n\nThis action cannot be undone.`)
    if (!confirmed) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await apiRequest(`/api/admin/tasks/${task.id}`, { method: 'DELETE' })
      setMessage('Task deleted.')
      await loadAll()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete task')
    } finally {
      setBusy(false)
    }
  }

  async function uploadAttachment(file: File) {
    if (!selectedId) return
    setError(null)
    try {
      await uploadFileToTask(selectedId, file)
      await loadAll()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to upload file')
    }
  }

  async function removeAttachment(attachmentId: number) {
    if (!selectedId) return
    setError(null)
    try {
      await apiRequest(`/api/admin/tasks/${selectedId}/attachments/${attachmentId}`, { method: 'DELETE' })
      await loadAll()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to remove file')
    }
  }

  function copyText(value: string) {
    if (!value) return
    void navigator.clipboard.writeText(value)
  }

  return (
    <>
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 ring-1 ring-white/[0.04] backdrop-blur">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Task operations</h2>
            <p className="text-xs text-slate-500">Assign, receive submissions, and close work</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs text-slate-400">{tasks.length} total</span>
            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25"><Plus className="h-4 w-4" />Add task</button>
          </div>
        </header>

        <div className="grid gap-3 border-b border-white/[0.06] px-5 py-4 sm:grid-cols-[1fr_170px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, type, project, assignee" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-500/40" />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="fp-native-select cursor-pointer rounded-xl border border-white/[0.12] bg-[#121a2e] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500/40"
          >
            <option value="all">All statuses</option>
            {TASK_STATUS_SELECT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {message ? <div className="mx-5 my-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{message}</div> : null}
        {error && !modalOpen ? <div className="mx-5 my-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div> : null}

        <div className="max-h-[68vh] overflow-auto">
          {loading ? <ul className="space-y-3 p-5">{[1, 2, 3, 4].map((i) => <li key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.05]" />)}</ul> : filtered.length === 0 ? (
            <div className="px-5 py-16 text-center"><p className="text-sm font-medium text-slate-300">No tasks found</p><button type="button" onClick={openCreate} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/25 hover:bg-emerald-500/25"><Plus className="h-4 w-4" />Add first task</button></div>
          ) : (
            <ul className="divide-y divide-white/[0.05]">{filtered.map((t) => (
              <li key={t.id} className="px-5 py-4 transition hover:bg-white/[0.02]">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => openEdit(t)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold text-white">{t.title}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {t.project?.name ?? 'No project'}
                      {t.agency_service ? ` · ${t.agency_service.name}` : ''} · {deliverableTypeLabel(t.deliverable_type)} ·{' '}
                      {taskStatusLabel(t.status)} · {taskPriorityLabel(t.priority)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-600">
                      {formatAssigneeInline(t.assignee?.name)} · Due{' '}
                      {t.deadline ? new Date(t.deadline).toLocaleDateString() : '—'}
                      {t.submission_link ? ' · Submitted' : ''} · {(t.attachments ?? []).length} file
                      {(t.attachments ?? []).length === 1 ? '' : 's'}
                    </p>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => openEdit(t)} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"><Pencil className="h-4 w-4" /></button>
                    <button type="button" onClick={() => void remove(t)} className="rounded-lg p-2 text-slate-400 hover:bg-red-500/15 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </li>
            ))}</ul>
          )}
        </div>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-sm sm:items-center sm:px-4 sm:pb-0"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/[0.12] bg-[#0b1324] shadow-2xl ring-1 ring-white/[0.06] sm:h-auto sm:max-h-[min(92dvh,56rem)] sm:max-w-[min(96vw,72rem)] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <h3 id="task-modal-title" className="text-lg font-semibold tracking-[-0.02em] text-white sm:text-xl">
                  {isEdit ? 'Edit task' : 'Create task'}
                </h3>
                <p className="mt-0.5 text-xs leading-snug text-slate-500 sm:text-[13px]">
                  Brief · client content · assets · submission & review
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="shrink-0 rounded-xl p-2.5 text-slate-400 hover:bg-white/[0.06] hover:text-white sm:p-2"
                aria-label="Close"
              >
                <X className="h-5 w-5 sm:h-4 sm:w-4" />
              </button>
            </div>
            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col sm:max-h-[min(86dvh,52rem)]">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,380px)]">
                <div className="min-w-0 space-y-4">
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">1 · Task</p>
                    <Field refEl={titleRef} label="Task title *" value={form.title} onChange={(v) => setForm((s) => ({ ...s, title: v }))} placeholder="e.g. Instagram Post #1" />
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <SelectField
                        label="Project *"
                        value={form.project_id}
                        onChange={(v) => setForm((s) => ({ ...s, project_id: v, service_id: '' }))}
                        options={[{ value: '', label: 'Select project' }, ...projects.map((p) => ({ value: String(p.id), label: p.name }))]}
                      />
                      <SelectField
                        label="Assign to teammate"
                        value={form.assigned_to}
                        onChange={(v) => setForm((s) => ({ ...s, assigned_to: v }))}
                        options={[
                          { value: '', label: 'No assignee yet' },
                          ...assignees.map((u) => ({
                            value: String(u.id),
                            label: formatAssigneePickerLabel(u.name, u.role),
                          })),
                        ]}
                      />
                    </div>
                    <div className="mt-3">
                      <SelectField
                        label={servicesForProject.length > 0 ? 'Service (proposal line) *' : 'Service (optional)'}
                        value={form.service_id}
                        onChange={(v) => setForm((s) => ({ ...s, service_id: v }))}
                        options={[
                          {
                            value: '',
                            label: servicesForProject.length
                              ? 'Select service (e.g. Instagram Posts pack)'
                              : 'No services for this project yet',
                          },
                          ...servicesForProject.map((s) => ({
                            value: String(s.id),
                            label: s.period_label ? `${s.name} (${s.period_label})` : s.name,
                          })),
                        ]}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Due date" type="date" value={form.deadline} onChange={(v) => setForm((s) => ({ ...s, deadline: v }))} placeholder="" />
                      <SelectField
                        label="Status"
                        value={form.status}
                        onChange={(v) => setForm((s) => ({ ...s, status: v }))}
                        options={TASK_STATUS_SELECT_OPTIONS}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <SelectField
                        label="Deliverable type"
                        value={form.deliverable_type}
                        onChange={(v) => setForm((s) => ({ ...s, deliverable_type: v }))}
                        options={deliverableOptions}
                      />
                      <SelectField
                        label="Priority"
                        value={form.priority}
                        onChange={(v) => setForm((s) => ({ ...s, priority: v }))}
                        options={[
                          { value: 'low', label: 'Low' },
                          { value: 'medium', label: 'Medium' },
                          { value: 'high', label: 'High' },
                          { value: 'urgent', label: 'Urgent' },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3.5 ring-1 ring-emerald-500/15">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200/90">2 · Brief (required)</p>
                    <p className="mb-2 text-[11px] text-slate-500">What should be made? The team should not need to guess.</p>
                    <label className="mb-1.5 block text-xs font-medium text-slate-200">Brief / instructions *</label>
                    <textarea
                      rows={5}
                      required
                      value={form.instructions}
                      onChange={(e) => setForm((s) => ({ ...s, instructions: e.target.value }))}
                      placeholder="e.g. Create static for new LED line — highlight 40% energy savings, PKR price, store logo top-right, Urdu + English copy."
                      className={MODAL_TEXTAREA_BRIEF}
                    />
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">3 · Client input</p>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-400">Client content (text, captions, quotes)</label>
                      <textarea
                        rows={3}
                        value={form.client_content}
                        onChange={(e) => setForm((s) => ({ ...s, client_content: e.target.value }))}
                        placeholder="Exact words or direction from the client, e.g. &quot;Best LED bulbs in Pakistan&quot;"
                        className={MODAL_TEXTAREA}
                      />
                    </div>
                    <div className="mt-3">
                      <Field
                        label="Reference / style link"
                        value={form.reference_url}
                        onChange={(v) => setForm((s) => ({ ...s, reference_url: v }))}
                        placeholder="instagram.com/… or Figma / Pinterest link"
                      />
                    </div>
                    <div className="mt-3">
                      <label className="mb-1.5 block text-xs font-medium text-slate-400">Internal notes (optional)</label>
                      <textarea
                        rows={2}
                        value={form.description}
                        onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                        placeholder="Extra context for the team (not a substitute for the brief above)"
                        className={MODAL_TEXTAREA}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">4 · Assets</p>
                    <p className="mb-2 text-[11px] text-slate-500">Images, video, logo, brief PDFs. {isEdit ? 'Upload to attach to this task.' : 'Select files; they upload right after the task is created.'}</p>
                    {isEdit && selectedId ? (
                      <input
                        type="file"
                        className="block w-full cursor-pointer text-[13px] text-slate-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-700 file:px-4 file:py-3 file:text-sm file:font-medium file:text-white hover:file:bg-slate-600 sm:file:py-2 sm:file:text-xs"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void uploadAttachment(file)
                          e.currentTarget.value = ''
                        }}
                        disabled={uploadingAttachment}
                      />
                    ) : (
                      <>
                        <input
                          type="file"
                          multiple
                          className="block w-full cursor-pointer text-[13px] text-slate-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-700 file:px-4 file:py-3 file:text-sm file:font-medium file:text-white hover:file:bg-slate-600 sm:file:py-2 sm:file:text-xs"
                          onChange={(e) => {
                            const add = Array.from(e.target.files ?? [])
                            setPendingFiles((prev) => {
                              const k = (f: File) => `${f.name}-${f.size}`
                              const m = new Set(prev.map(k))
                              return [...prev, ...add.filter((f) => !m.has(k(f)))]
                            })
                            e.currentTarget.value = ''
                          }}
                        />
                        {pendingFiles.length > 0 ? (
                          <ul className="mt-3 space-y-2 text-xs text-slate-400">
                            {pendingFiles.map((f) => (
                              <li
                                key={f.name + f.size}
                                className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2"
                              >
                                <span className="min-w-0 break-words text-slate-300 sm:line-clamp-2 sm:break-normal" title={f.name}>
                                  {f.name}
                                </span>
                                <button
                                  type="button"
                                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg px-3 text-sm font-medium text-red-300 ring-1 ring-red-500/25 hover:bg-red-500/10 sm:min-h-0 sm:text-xs sm:ring-0"
                                  onClick={() => setPendingFiles((prev) => prev.filter((x) => x !== f))}
                                >
                                  Remove
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    )}
                    {isEdit && selectedId ? (
                      <div className="mt-2 space-y-2">
                        <AttachmentBlock
                          title="Reference / brand files"
                          attachments={(tasks.find((t) => t.id === selectedId)?.attachments ?? []).filter((a) => a.uploader?.role === 'admin')}
                          onOpen={(a) => void openProtectedFile(a.url)}
                          onDownload={(a) => void downloadProtectedFile(a.url, a.original_name)}
                          onRemove={(a) => void removeAttachment(a.id)}
                        />
                        <AttachmentBlock
                          title="Team uploads"
                          attachments={(tasks.find((t) => t.id === selectedId)?.attachments ?? []).filter((a) => a.uploader?.role !== 'admin')}
                          onOpen={(a) => void openProtectedFile(a.url)}
                          onDownload={(a) => void downloadProtectedFile(a.url, a.original_name)}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:max-h-[min(calc(92dvh-12rem),42rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:self-start lg:pr-1">
                  {selectedClient ? (
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-3.5">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                        Client Kit (Auto-loaded)
                      </p>
                      <div className="space-y-2 text-xs text-slate-300">
                        {selectedClient.address ? (
                          <button
                            type="button"
                            onClick={() => copyText(selectedClient.address ?? '')}
                            className="flex w-full items-start justify-between gap-2 rounded-lg border border-white/[0.08] px-2.5 py-2 hover:bg-white/[0.04]"
                          >
                            <span className="inline-flex items-start gap-1.5 text-left">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                              {selectedClient.address}
                            </span>
                            <ClipboardCopy className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          </button>
                        ) : null}
                        {selectedClient.phone ? (
                          <button
                            type="button"
                            onClick={() => copyText(selectedClient.phone ?? '')}
                            className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.08] px-2.5 py-2 hover:bg-white/[0.04]"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-slate-500" />
                              {selectedClient.phone}
                            </span>
                            <ClipboardCopy className="h-3.5 w-3.5 text-slate-400" />
                          </button>
                        ) : null}
                        {adminClientPalette(selectedClient).length > 0 ? (
                          <div className="rounded-lg border border-white/[0.08] px-2.5 py-2">
                            <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500">
                              <Palette className="h-3.5 w-3.5" />
                              Colors
                            </p>
                            <div className="space-y-1.5">
                              {adminClientPalette(selectedClient).map((hex, idx) => (
                                <button
                                  key={`${hex}-${idx}`}
                                  type="button"
                                  onClick={() => copyText(hex)}
                                  className="flex w-full items-center justify-between text-left hover:text-white"
                                >
                                  <span>{hex}</span>
                                  <ClipboardCopy className="h-3.5 w-3.5 text-slate-400" />
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          {selectedClient.logo_url ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void openProtectedFile(selectedClient.logo_url ?? '')}
                                className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-emerald-300 hover:bg-white/[0.1]"
                              >
                                <Image className="h-3.5 w-3.5" />
                                View logo
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void downloadProtectedFile(
                                    selectedClient.logo_url ?? '',
                                    `${selectedClient.name}-logo`,
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-sky-300 hover:bg-white/[0.1]"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </button>
                            </>
                          ) : null}
                          {selectedClient.business_profile_url ? (
                            <button
                              type="button"
                              onClick={() => void openProtectedFile(selectedClient.business_profile_url ?? '')}
                              className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-amber-300 hover:bg-white/[0.1]"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Open PDF
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Submission & Review</p>
                    <Field label="Submission link" value={form.submission_link} onChange={(v) => setForm((s) => ({ ...s, submission_link: v }))} placeholder="https://drive.google.com/..." />
                    <div className="mt-3">
                      <label className="mb-1.5 block text-xs font-medium text-slate-400">Submission notes</label>
                      <textarea
                        rows={3}
                        value={form.submission_notes}
                        onChange={(e) => setForm((s) => ({ ...s, submission_notes: e.target.value }))}
                        placeholder="What was completed and what to review"
                        className={MODAL_TEXTAREA}
                      />
                    </div>
                    <div className="mt-3">
                      <label className="mb-1.5 block text-xs font-medium text-slate-400">Admin feedback</label>
                      <textarea
                        rows={3}
                        value={form.admin_feedback}
                        onChange={(e) => setForm((s) => ({ ...s, admin_feedback: e.target.value }))}
                        placeholder="Approval notes or revision requests"
                        className={MODAL_TEXTAREA}
                      />
                    </div>
                  </div>
                  {isEdit ? (
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                      <p className="text-xs font-medium text-slate-300">Quick review actions</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setForm((s) => ({ ...s, status: 'done' }))} className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/25 hover:bg-emerald-500/30">Accept & Mark Done</button>
                        <button type="button" onClick={() => setForm((s) => ({ ...s, status: 'doing' }))} className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/25 hover:bg-amber-500/30">Request Changes</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              {error ? <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-white/[0.08] bg-[#0b1324]/95 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-white/[0.12] px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] sm:min-h-0 sm:w-auto sm:py-2.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60 sm:min-h-0 sm:w-auto sm:py-2.5"
                >
                  {busy ? 'Saving...' : isEdit ? 'Save changes' : 'Create task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

const MODAL_INPUT =
  'w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3.5 text-[16px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-500/40 sm:py-2.5 sm:text-sm'

const MODAL_TEXTAREA =
  `${MODAL_INPUT} resize-y leading-relaxed`

const MODAL_TEXTAREA_BRIEF =
  'w-full resize-y rounded-xl border border-white/[0.1] bg-[#0a1018] px-3 py-3.5 text-[16px] leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-500/50 sm:py-2.5 sm:text-sm'

function Field({ label, value, onChange, placeholder, type = 'text', refEl }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: 'text' | 'date'; refEl?: RefObject<HTMLInputElement | null> }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>
      <input ref={refEl} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={MODAL_INPUT} />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${MODAL_INPUT} fp-native-select cursor-pointer border-white/[0.12]`}
      >
        {options.map((o) => (
          <option key={o.value === '' ? '__empty' : o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function AttachmentBlock({ title, attachments, onOpen, onDownload, onRemove }: {
  title: string
  attachments: AttachmentItem[]
  onOpen: (attachment: AttachmentItem) => void
  onDownload: (attachment: AttachmentItem) => void
  onRemove?: (attachment: AttachmentItem) => void
}) {
  if (attachments.length === 0) return null
  return (
    <div className="mt-3 rounded-lg border border-slate-700/70 bg-slate-950/50 p-2.5">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{title}</p>
      <ul className="mt-1.5 space-y-2">
        {attachments.map((attachment) => (
          <li
            key={attachment.id}
            className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2 py-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0"
          >
            <span className="min-w-0 break-words text-slate-300 sm:truncate" title={attachment.original_name}>
              {attachment.original_name}
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:shrink-0">
              <button type="button" onClick={() => onOpen(attachment)} className="min-h-[44px] px-1 text-emerald-300 hover:underline sm:min-h-0">
                Open
              </button>
              <button type="button" onClick={() => onDownload(attachment)} className="min-h-[44px] px-1 text-sky-300 hover:underline sm:min-h-0">
                Download
              </button>
              {onRemove ? (
                <button type="button" onClick={() => onRemove(attachment)} className="min-h-[44px] px-1 text-red-300 hover:underline sm:min-h-0">
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
