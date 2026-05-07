import { useMemo, useState, type DragEvent } from 'react'
import { Camera, Upload, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { fileToDataUrl, setTeamProfileAvatar, useTeamProfileAvatar } from '../../lib/teamProfile'

function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function TeamSettingsPage() {
  const { user } = useAuth()
  const avatar = useTeamProfileAvatar()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fullName, setFullName] = useState(user?.name ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [taskAssigned, setTaskAssigned] = useState(true)
  const [taskApproved, setTaskApproved] = useState(true)
  const [taskOverdue, setTaskOverdue] = useState(true)
  const [defaultView, setDefaultView] = useState<'priority' | 'tasks'>('priority')
  const [autoOpenTasks, setAutoOpenTasks] = useState(true)

  const avatarInitials = useMemo(() => initials(fullName || user?.name), [fullName, user?.name])

  async function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const dataUrl = await fileToDataUrl(file)
    setTeamProfileAvatar(dataUrl)
    setUploadOpen(false)
    setDragOver(false)
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) void handleImageFile(file)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-[#0c1222]/76 p-5 ring-1 ring-white/[0.04] sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Profile</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-[112px_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="relative h-24 w-24 overflow-hidden rounded-full bg-slate-900 ring-1 ring-white/[0.08]"
            >
              {avatar ? (
                <img src={avatar} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-slate-200">
                  {avatarInitials}
                </span>
              )}
              <span className="absolute bottom-1 right-1 rounded-full bg-emerald-500 p-1 text-white">
                <Camera className="h-3 w-3" />
              </span>
            </button>
            <button type="button" onClick={() => setTeamProfileAvatar(null)} className="text-xs text-slate-500 hover:text-slate-300">
              Remove image
            </button>
          </div>

          <div className="space-y-3">
            <label className="block text-xs text-slate-400">
              Name
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
              />
            </label>
            <label className="block text-xs text-slate-400">
              Email
              <input
                value={user?.email ?? ''}
                readOnly
                className="mt-1 w-full rounded-xl border border-white/[0.06] bg-slate-900/70 px-3 py-2 text-sm text-slate-400"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-slate-400">
                New password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
                />
              </label>
              <label className="block text-xs text-slate-400">
                Confirm password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-[#0c1222]/74 p-5 ring-1 ring-white/[0.04] sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Notifications</h2>
        <div className="mt-4 space-y-2">
          <ToggleRow label="Task assigned" checked={taskAssigned} onChange={setTaskAssigned} />
          <ToggleRow label="Task approved" checked={taskApproved} onChange={setTaskApproved} />
          <ToggleRow label="Task overdue" checked={taskOverdue} onChange={setTaskOverdue} />
        </div>
      </section>

      <section className="rounded-2xl bg-[#0c1222]/74 p-5 ring-1 ring-white/[0.04] sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Preferences</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-slate-400">
            Default dashboard view
            <select
              value={defaultView}
              onChange={(e) => setDefaultView(e.target.value as 'priority' | 'tasks')}
              className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
            >
              <option value="priority">Priority view</option>
              <option value="tasks">Tasks board view</option>
            </select>
          </label>
          <ToggleRow label="Auto-open tasks toggle" checked={autoOpenTasks} onChange={setAutoOpenTasks} />
        </div>
      </section>

      {uploadOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
          <button type="button" onClick={() => setUploadOpen(false)} className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" />
          <div className="relative z-[111] w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0b1220] p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Upload profile image</h3>
              <button type="button" onClick={() => setUploadOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`mt-4 flex min-h-[160px] cursor-pointer items-center justify-center rounded-2xl border border-dashed px-4 text-center ${
                dragOver ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200' : 'border-slate-600 bg-slate-900/70 text-slate-400'
              }`}
            >
              <div>
                <Upload className="mx-auto h-5 w-5 text-emerald-300" />
                <p className="mt-2 text-sm font-medium">Drag & drop image</p>
                <p className="mt-1 text-xs">or click to browse</p>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleImageFile(file)
                  e.currentTarget.value = ''
                }}
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-900/45 px-3 py-2.5">
      <span className="text-sm text-slate-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`inline-flex h-6 w-11 items-center rounded-full p-1 transition ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`}
      >
        <span className={`h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}
