import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Search, Users, X } from 'lucide-react'
import { ApiError, apiRequest } from '../../lib/api'

type ClientOption = { id: number; name: string; company: string | null }
type MemberOption = { id: number; name: string; role: 'admin' | 'employee'; is_active: boolean }

type Project = {
  id: number
  client_id: number
  name: string
  description: string | null
  status: string
  priority: string
  deadline: string | null
  client?: { id: number; name: string; company: string | null } | null
  members?: Array<{ id: number; name: string }>
}

type ProjectForm = {
  client_id: string
  name: string
  description: string
  status: string
  priority: string
  deadline: string
  member_ids: number[]
}

const EMPTY_FORM: ProjectForm = {
  client_id: '',
  name: '',
  description: '',
  status: 'active',
  priority: 'medium',
  deadline: '',
  member_ids: [],
}

export function ProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState<ProjectForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const isEdit = selectedId !== null
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  )

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [pRows, cRows, uRows] = await Promise.all([
        apiRequest<Project[]>('/api/admin/projects'),
        apiRequest<ClientOption[]>('/api/admin/clients'),
        apiRequest<MemberOption[]>('/api/admin/users'),
      ])
      setProjects(pRows)
      setClients(cRows)
      setMembers(uRows.filter((u) => u.is_active && u.role === 'employee'))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => nameInputRef.current?.focus(), 0)
    }
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) =>
      [p.name, p.status, p.priority, p.client?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [projects, search])

  function openCreate() {
    setSelectedId(null)
    setForm(EMPTY_FORM)
    setInitialForm(EMPTY_FORM)
    setError(null)
    setMessage(null)
    setModalOpen(true)
  }

  function openEdit(p: Project) {
    const editForm: ProjectForm = {
      client_id: String(p.client_id),
      name: p.name ?? '',
      description: p.description ?? '',
      status: p.status ?? 'active',
      priority: p.priority ?? 'medium',
      deadline: p.deadline ? p.deadline.slice(0, 10) : '',
      member_ids: p.members?.map((m) => m.id) ?? [],
    }
    setSelectedId(p.id)
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

  function toggleMember(id: number) {
    setForm((s) => ({
      ...s,
      member_ids: s.member_ids.includes(id)
        ? s.member_ids.filter((x) => x !== id)
        : [...s.member_ids, id],
    }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.client_id) {
      setError('Please select a client.')
      return
    }
    if (form.name.trim() === '') {
      setError('Project name is required.')
      return
    }

    setBusy(true)
    setError(null)
    setMessage(null)

    const payload = {
      client_id: Number(form.client_id),
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      deadline: form.deadline || null,
    }

    try {
      let projectId = selectedId
      if (isEdit && selectedId) {
        await apiRequest<Project>(`/api/admin/projects/${selectedId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        const created = await apiRequest<Project>('/api/admin/projects', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        projectId = created.id
      }

      if (projectId) {
        await apiRequest(`/api/admin/projects/${projectId}/members`, {
          method: 'POST',
          body: JSON.stringify({ user_ids: form.member_ids }),
        })
      }

      setMessage(isEdit ? 'Project updated successfully.' : 'Project created successfully.')
      setInitialForm(form)
      await loadAll()
      setModalOpen(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save project')
    } finally {
      setBusy(false)
    }
  }

  async function remove(project: Project) {
    const confirmed = window.confirm(`Delete project "${project.name}"?\n\nThis action cannot be undone.`)
    if (!confirmed) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await apiRequest(`/api/admin/projects/${project.id}`, { method: 'DELETE' })
      setMessage('Project deleted.')
      await loadAll()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete project')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 ring-1 ring-white/[0.04] backdrop-blur">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Project board</h2>
            <p className="text-xs text-slate-500">Client-linked delivery planning</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs text-slate-400">{projects.length} total</span>
            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25">
              <Plus className="h-4 w-4" />
              Add project
            </button>
          </div>
        </header>

        <div className="px-5 py-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search project, client, status, priority" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-500/40" />
          </label>
        </div>

        {message ? <div className="mx-5 mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{message}</div> : null}
        {error && !modalOpen ? <div className="mx-5 mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div> : null}

        <div className="max-h-[68vh] overflow-auto border-t border-white/[0.06]">
          {loading ? (
            <ul className="space-y-3 p-5">{[1, 2, 3, 4].map((i) => <li key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.05]" />)}</ul>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-sm font-medium text-slate-300">No projects yet</p>
              <button type="button" onClick={openCreate} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/25 hover:bg-emerald-500/25"><Plus className="h-4 w-4" />Add first project</button>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {filtered.map((p) => (
                <li key={p.id} className="px-5 py-4 transition hover:bg-white/[0.02]">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => openEdit(p)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{p.client?.name ?? 'No client'} · {p.status} · {p.priority}</p>
                      <p className="mt-0.5 inline-flex items-center gap-1 truncate text-[11px] text-slate-600"><Users className="h-3.5 w-3.5" />{p.members?.length ?? 0} team members</p>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/projects/${p.id}`)}
                        className="rounded-lg px-2.5 py-2 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/10"
                        aria-label={`Open ${p.name} workflow`}
                      >
                        Open
                      </button>
                      <button type="button" onClick={() => openEdit(p)} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white" aria-label={`Edit ${p.name}`}><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => void remove(p)} className="rounded-lg p-2 text-slate-400 hover:bg-red-500/15 hover:text-red-300" aria-label={`Delete ${p.name}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-sm sm:items-center sm:p-4"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="flex max-h-[min(92dvh,56rem)] w-full max-w-full flex-col overflow-hidden rounded-t-2xl border border-white/[0.12] bg-[#0b1324] shadow-2xl ring-1 ring-white/[0.06] sm:max-w-4xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="project-modal-title"
            aria-modal="true"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.06] px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
              <div className="min-w-0">
                <h3 id="project-modal-title" className="text-lg font-semibold text-white sm:text-xl">
                  {isEdit ? 'Edit project' : 'Add project'}
                </h3>
                <p className="mt-1 text-xs text-slate-500 sm:text-[13px]">Set client, scope, timeline, and team</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="shrink-0 rounded-lg p-2.5 text-slate-400 hover:bg-white/[0.06] hover:text-white sm:p-2"
                aria-label="Close form"
              >
                <X className="h-5 w-5 sm:h-4 sm:w-4" />
              </button>
            </div>

            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 sm:space-y-5 sm:px-6 sm:py-5">
                {/* Laptop: Client | Project name side-by-side; phones: stacked */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                  <SelectField
                    label="Client *"
                    value={form.client_id}
                    onChange={(v) => setForm((s) => ({ ...s, client_id: v }))}
                    options={[
                      { value: '', label: 'Select client' },
                      ...clients.map((c) => ({
                        value: String(c.id),
                        label: `${c.name}${c.company ? ` (${c.company})` : ''}`,
                      })),
                    ]}
                  />
                  <Field
                    refEl={nameInputRef}
                    label="Project name *"
                    value={form.name}
                    onChange={(v) => setForm((s) => ({ ...s, name: v }))}
                    placeholder="Website redesign"
                  />
                </div>

                {/* Laptop: Status | Priority | Deadline in one row; narrow screens stack */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
                  <SelectField
                    label="Status"
                    value={form.status}
                    onChange={(v) => setForm((s) => ({ ...s, status: v }))}
                    options={[
                      { value: 'active', label: 'active' },
                      { value: 'on_hold', label: 'on_hold' },
                      { value: 'completed', label: 'completed' },
                      { value: 'cancelled', label: 'cancelled' },
                    ]}
                  />
                  <SelectField
                    label="Priority"
                    value={form.priority}
                    onChange={(v) => setForm((s) => ({ ...s, priority: v }))}
                    options={[
                      { value: 'low', label: 'low' },
                      { value: 'medium', label: 'medium' },
                      { value: 'high', label: 'high' },
                      { value: 'urgent', label: 'urgent' },
                    ]}
                  />
                  <Field
                    label="Deadline"
                    type="date"
                    value={form.deadline}
                    onChange={(v) => setForm((s) => ({ ...s, deadline: v }))}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Description</label>
                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                    placeholder="Project scope and deliverables..."
                    className="min-h-[7.5rem] w-full resize-y rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-[16px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-500/40 sm:text-sm md:min-h-[5.5rem] md:py-2.5"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Team members</label>
                  <div className="max-h-[min(40vh,14rem)] space-y-1 overflow-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 sm:max-h-44 md:max-h-48">
                    {members.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-slate-500">No active members</p>
                    ) : (
                      members.map((m) => (
                        <label
                          key={m.id}
                          className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 active:bg-white/[0.06] sm:px-2 sm:py-2 sm:text-xs md:py-1.5"
                        >
                          <span className="min-w-0 flex-1 truncate">{m.name}</span>
                          <input
                            type="checkbox"
                            checked={form.member_ids.includes(m.id)}
                            onChange={() => toggleMember(m.id)}
                            className="h-5 w-5 shrink-0 rounded border-white/20 bg-transparent text-emerald-500 focus:ring-emerald-400 sm:h-4 sm:w-4"
                          />
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {error ? (
                  <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-white/[0.06] bg-[#0b1324]/95 px-5 py-4 backdrop-blur-sm sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full rounded-xl border border-white/[0.12] px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] sm:w-auto sm:py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-emerald-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60 sm:w-auto sm:py-2"
                >
                  {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', refEl }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: 'text' | 'date'; refEl?: RefObject<HTMLInputElement | null> }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>
      <input
        ref={refEl}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-[16px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-500/40 sm:py-2.5 sm:text-sm"
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="fp-native-select w-full cursor-pointer rounded-xl border border-white/[0.12] bg-[#121a2e] px-3 py-3 text-[16px] text-slate-200 outline-none focus:border-emerald-500/40 sm:py-2.5 sm:text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

