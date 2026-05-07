import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react'
import { ApiError, apiRequest } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { formatPersonName, formatRoleLabel } from '../../lib/displayNames'

type TeamMember = {
  id: number
  name: string
  username: string
  email: string
  role: 'admin' | 'employee'
  is_active: boolean
  created_at: string
}

type TeamForm = {
  name: string
  username: string
  email: string
  password: string
  role: 'admin' | 'employee'
  is_active: boolean
}

const EMPTY_FORM: TeamForm = {
  name: '',
  username: '',
  email: '',
  password: '',
  role: 'employee',
  is_active: true,
}

export function TeamPage() {
  const { user: currentUser } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<TeamForm>(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState<TeamForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const nameRef = useRef<HTMLInputElement | null>(null)

  const isEdit = selectedId !== null
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form, initialForm])

  async function loadMembers() {
    setLoading(true)
    setError(null)
    try {
      const rows = await apiRequest<TeamMember[]>('/api/admin/users')
      setMembers(rows)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load team')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadMembers() }, [])
  useEffect(() => { if (modalOpen) setTimeout(() => nameRef.current?.focus(), 0) }, [modalOpen])
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
    return members.filter((m) => {
      if (statusFilter === 'active' && !m.is_active) return false
      if (statusFilter === 'inactive' && m.is_active) return false
      if (!q) return true
      return [m.name, m.username, m.email, m.role]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    })
  }, [members, search, statusFilter])

  function openCreate() {
    setSelectedId(null)
    setForm(EMPTY_FORM)
    setInitialForm(EMPTY_FORM)
    setError(null)
    setMessage(null)
    setModalOpen(true)
  }

  function openEdit(m: TeamMember) {
    const editForm: TeamForm = {
      name: m.name,
      username: m.username,
      email: m.email,
      password: '',
      role: m.role,
      is_active: m.is_active,
    }
    setSelectedId(m.id)
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
    if (!form.name.trim() || !form.username.trim() || !form.email.trim()) {
      setError('Name, username, and email are required.')
      return
    }
    if (!isEdit && form.password.length < 8) {
      setError('Password must be at least 8 characters for new users.')
      return
    }

    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const basePayload = {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        role: form.role,
        is_active: form.is_active,
      }

      if (isEdit && selectedId) {
        const payload = { ...basePayload, ...(form.password.trim() ? { password: form.password } : {}) }
        await apiRequest(`/api/admin/users/${selectedId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        await apiRequest('/api/admin/users', { method: 'POST', body: JSON.stringify({ ...basePayload, password: form.password }) })
      }

      setMessage(isEdit ? 'Team member updated successfully.' : 'Team member created successfully.')
      setInitialForm(form)
      await loadMembers()
      setModalOpen(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save team member')
    } finally {
      setBusy(false)
    }
  }

  async function remove(member: TeamMember) {
    const confirmed = window.confirm(`Delete user "${member.name}"?\n\nThis action cannot be undone.`)
    if (!confirmed) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await apiRequest(`/api/admin/users/${member.id}`, { method: 'DELETE' })
      setMessage('Team member deleted.')
      await loadMembers()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete user')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 ring-1 ring-white/[0.04] backdrop-blur">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Team directory</h2>
            <p className="text-xs text-slate-500">Users, roles, and account status</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs text-slate-400">{members.length} total</span>
            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25"><Plus className="h-4 w-4" />Add member</button>
          </div>
        </header>

        <div className="grid gap-3 border-b border-white/[0.06] px-5 py-4 sm:grid-cols-[1fr_160px]">
          <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, username, email" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-500/40" /></label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="fp-native-select cursor-pointer rounded-xl border border-white/[0.12] bg-[#121a2e] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500/40"
          >
            <option value="all">Everyone</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>

        {message ? <div className="mx-5 my-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{message}</div> : null}
        {error && !modalOpen ? <div className="mx-5 my-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div> : null}

        <div className="max-h-[68vh] overflow-auto">
          {loading ? <ul className="space-y-3 p-5">{[1,2,3,4].map((i)=><li key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.05]" />)}</ul> : filtered.length===0 ? (
            <div className="px-5 py-16 text-center text-sm text-slate-500">No team members found.</div>
          ) : (
            <ul className="divide-y divide-white/[0.05]">{filtered.map((m)=>(
              <li key={m.id} className="px-5 py-4 transition hover:bg-white/[0.02]"><div className="flex items-start justify-between gap-3"><button type="button" onClick={() => openEdit(m)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-semibold text-white">{formatPersonName(m.name)}</p><p className="mt-0.5 truncate text-xs text-slate-500">@{m.username} · {m.email}</p><p className="mt-0.5 truncate text-[11px] text-slate-600">{formatRoleLabel(m.role)} · {m.is_active ? 'Active' : 'Inactive'}{currentUser?.id === m.id ? ' · you' : ''}</p></button><div className="flex items-center gap-1.5"><button type="button" onClick={() => openEdit(m)} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => void remove(m)} disabled={currentUser?.id === m.id} className="rounded-lg p-2 text-slate-400 hover:bg-red-500/15 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></div></div></li>
            ))}</ul>
          )}
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={closeModal}>
          <div className="w-full max-w-xl rounded-2xl border border-white/[0.12] bg-[#0b1324] p-6 shadow-2xl ring-1 ring-white/[0.06]" onClick={(e)=>e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold text-white">{isEdit ? 'Edit member' : 'Add member'}</h3><p className="text-xs text-slate-500">Role and account management</p></div><button type="button" onClick={closeModal} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"><X className="h-4 w-4" /></button></div>
            <form onSubmit={submit} className="space-y-3.5">
              <Field refEl={nameRef} label="Full name *" value={form.name} onChange={(v)=>setForm((s)=>({...s,name:v}))} placeholder="Ayesha Khan" />
              <Field label="Username *" value={form.username} onChange={(v)=>setForm((s)=>({...s,username:v}))} placeholder="ayesha" />
              <Field label="Email *" type="email" value={form.email} onChange={(v)=>setForm((s)=>({...s,email:v}))} placeholder="ayesha@agency.com" />
              <Field label={isEdit ? 'New password (optional)' : 'Password *'} type="password" value={form.password} onChange={(v)=>setForm((s)=>({...s,password:v}))} placeholder={isEdit ? 'Leave blank to keep current' : 'At least 8 characters'} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectField label="Role" value={form.role} onChange={(v)=>setForm((s)=>({...s,role:v as 'admin' | 'employee'}))} options={[{value:'employee',label:'Team member'},{value:'admin',label:'Administrator'}]} />
                <SelectField label="Account status" value={form.is_active ? 'active' : 'inactive'} onChange={(v)=>setForm((s)=>({...s,is_active:v==='active'}))} options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}]} />
              </div>
              {error ? <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p> : null}
              <div className="flex items-center justify-end gap-2 pt-2"><button type="button" onClick={closeModal} className="rounded-xl border border-white/[0.12] px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05]">Cancel</button><button type="submit" disabled={busy} className="rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60">{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create member'}</button></div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', refEl }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: 'text' | 'email' | 'password'; refEl?: RefObject<HTMLInputElement | null> }) {
  return <div><label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label><input ref={refEl} type={type} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-500/40" /></div>
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="fp-native-select w-full cursor-pointer rounded-xl border border-white/[0.12] bg-[#121a2e] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

