import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Plus,
  Search,
  Mail,
  Phone,
  X,
  Globe,
  MapPin,
} from 'lucide-react'
import { ApiError, apiRequest, downloadProtectedFile, openProtectedFile } from '../../lib/api'
import {
  BrandColorsEditor,
  ClientAssetsEditor,
  KitField,
  softTextareaClass,
} from '../../components/admin/ClientWorkKitEditors'

type Client = {
  id: number
  source_intake_id?: number | null
  name: string
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  brand_primary: string | null
  brand_secondary: string | null
  brand_colors?: string[] | null
  notes: string | null
  logo_url: string | null
  business_profile_url: string | null
  created_at: string
  updated_at: string
}

type ClientForm = {
  name: string
  company: string
  email: string
  phone: string
  website: string
  address: string
  brand_colors: string[]
  notes: string
}

const MAX_BRAND_COLORS = 20

const EMPTY_FORM: ClientForm = {
  name: '',
  company: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  brand_colors: ['', ''],
  notes: '',
}

function normalizeHexList(colors: string[]): string[] {
  const hex = (v: string) => {
    const t = v.trim()
    if (t === '') return null
    const normalized = t.startsWith('#') ? t : `#${t}`
    return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized : null
  }
  return colors.map(hex).filter((x): x is string => x !== null).slice(0, MAX_BRAND_COLORS)
}

function paletteFromClient(client: Client): string[] {
  const fromApi = client.brand_colors
  if (Array.isArray(fromApi) && fromApi.length > 0) {
    return fromApi.filter((c) => typeof c === 'string' && c.trim() !== '')
  }
  return [client.brand_primary, client.brand_secondary].filter(Boolean) as string[]
}

function clientColorsIntoForm(client: Client): string[] {
  const palette = paletteFromClient(client)
  return palette.length > 0 ? palette.slice(0, MAX_BRAND_COLORS) : ['']
}

function toPayload(form: ClientForm) {
  const n = (v: string) => (v.trim() === '' ? null : v.trim())
  return {
    name: form.name.trim(),
    company: n(form.company),
    email: n(form.email),
    phone: n(form.phone),
    website: n(form.website),
    address: n(form.address),
    brand_colors: normalizeHexList(form.brand_colors),
    notes: n(form.notes),
  }
}

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [initialForm, setInitialForm] = useState<ClientForm>(EMPTY_FORM)
  const [pendingLogo, setPendingLogo] = useState<File | null>(null)
  const [pendingPdf, setPendingPdf] = useState<File | null>(null)
  const [assetBusy, setAssetBusy] = useState(false)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const isEdit = selectedId !== null

  const liveClient = useMemo(
    () => (selectedId != null ? clients.find((c) => c.id === selectedId) ?? null : null),
    [clients, selectedId],
  )

  async function loadClients() {
    setLoading(true)
    setError(null)
    try {
      const rows = await apiRequest<Client[]>('/api/admin/clients')
      setClients(rows)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load clients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadClients()
  }, [])

  const pendingLogoUrl = useMemo(() => {
    if (!pendingLogo) return null
    return URL.createObjectURL(pendingLogo)
  }, [pendingLogo])

  useEffect(() => {
    return () => {
      if (pendingLogoUrl) URL.revokeObjectURL(pendingLogoUrl)
    }
  }, [pendingLogoUrl])

  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => nameInputRef.current?.focus(), 0)
    }
  }, [modalOpen])

  const isDirty = useMemo(
    () =>
      JSON.stringify(form) !== JSON.stringify(initialForm) ||
      pendingLogo !== null ||
      pendingPdf !== null,
    [form, initialForm, pendingLogo, pendingPdf],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) =>
      [c.name, c.company, c.email, c.phone, c.website, c.address]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [clients, search])

  const fullAssetsCount = useMemo(
    () =>
      clients.filter(
        (c) =>
          Boolean(c.logo_url) &&
          Boolean(c.business_profile_url) &&
          paletteFromClient(c).length > 0,
      ).length,
    [clients],
  )

  function openCreate() {
    setSelectedId(null)
    setForm(EMPTY_FORM)
    setInitialForm(EMPTY_FORM)
    setPendingLogo(null)
    setPendingPdf(null)
    setError(null)
    setMessage(null)
    setModalOpen(true)
  }

  function openEdit(client: Client) {
    setSelectedId(client.id)
    const next: ClientForm = {
      name: client.name ?? '',
      company: client.company ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      website: client.website ?? '',
      address: client.address ?? '',
      brand_colors: clientColorsIntoForm(client),
      notes: client.notes ?? '',
    }
    setForm(next)
    setInitialForm(next)
    setPendingLogo(null)
    setPendingPdf(null)
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

  async function uploadLogoAsset(clientId: number, file: File) {
    const body = new FormData()
    body.append('file', file)
    await apiRequest<{ logo_url: string }>(`/api/admin/clients/${clientId}/logo`, {
      method: 'POST',
      body,
    })
  }

  async function uploadBusinessProfileAsset(clientId: number, file: File) {
    const body = new FormData()
    body.append('file', file)
    await apiRequest<{ business_profile_url: string }>(
      `/api/admin/clients/${clientId}/business-profile`,
      { method: 'POST', body },
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (form.name.trim() === '') {
      setError('Client name is required.')
      return
    }
    if (!pendingLogo && !liveClient?.logo_url) {
      setError('Missing logo. Upload a logo before saving this client work kit.')
      return
    }
    const palette = normalizeHexList(form.brand_colors)
    if (palette.length < 1) {
      setError('Add at least one valid brand color (full hex, for example #059669).')
      return
    }

    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const payload = JSON.stringify(toPayload(form))
      let clientId = selectedId
      if (isEdit && selectedId) {
        await apiRequest<Client>(`/api/admin/clients/${selectedId}`, {
          method: 'PATCH',
          body: payload,
        })
        setMessage('✓ Client kit updated — ready for team use.')
      } else {
        const created = await apiRequest<Client>('/api/admin/clients', {
          method: 'POST',
          body: payload,
        })
        clientId = created.id
        setMessage('✓ Client kit created — ready for team use.')
      }

      if (clientId != null) {
        if (pendingLogo) {
          setAssetBusy(true)
          await uploadLogoAsset(clientId, pendingLogo)
          setPendingLogo(null)
          setAssetBusy(false)
        }
        if (pendingPdf) {
          setAssetBusy(true)
          await uploadBusinessProfileAsset(clientId, pendingPdf)
          setPendingPdf(null)
          setAssetBusy(false)
        }
      }

      await loadClients()
      setInitialForm(form)
      setModalOpen(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save client')
    } finally {
      setBusy(false)
      setAssetBusy(false)
    }
  }

  async function removeLogoAsset() {
    if (!selectedId) return
    setAssetBusy(true)
    setError(null)
    try {
      await apiRequest(`/api/admin/clients/${selectedId}/logo`, { method: 'DELETE' })
      await loadClients()
      setMessage('Logo removed.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not remove logo')
    } finally {
      setAssetBusy(false)
    }
  }

  async function removeBusinessProfileAsset() {
    if (!selectedId) return
    setAssetBusy(true)
    setError(null)
    try {
      await apiRequest(`/api/admin/clients/${selectedId}/business-profile`, { method: 'DELETE' })
      await loadClients()
      setMessage('Business profile PDF removed.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not remove PDF')
    } finally {
      setAssetBusy(false)
    }
  }

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

  async function remove(client: Client) {
    const confirmed = window.confirm(
      `Delete "${client.name}"?\n\nThis action cannot be undone.`,
    )
    if (!confirmed) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await apiRequest(`/api/admin/clients/${client.id}`, { method: 'DELETE' })
      setMessage('Client deleted.')
      await loadClients()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete client')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 ring-1 ring-white/[0.04] backdrop-blur">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Client Work Kit</h2>
            <p className="text-xs text-slate-500">Identity, brand kit, and ready-to-use assets</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs text-slate-400">
              {clients.length} total
            </span>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25"
            >
              <Plus className="h-4 w-4" />
              Add client
            </button>
          </div>
        </header>

        <div className="px-5 py-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients by name"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-500/40"
            />
          </label>
        </div>

        <div className="mx-5 mb-3 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3 text-xs text-slate-500">
          <span className="font-medium text-slate-300">{clients.length} Clients</span>
          <span className="mx-2 text-slate-700">•</span>
          <span className="font-medium text-slate-400">{fullAssetsCount} Complete</span>
          <span className="mx-2 text-slate-700">•</span>
          <span className="font-medium text-slate-400">{Math.max(0, clients.length - fullAssetsCount)} Missing Assets</span>
        </div>

        {message ? (
          <div className="mx-5 mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {message}
          </div>
        ) : null}
        {error && !modalOpen ? (
          <div className="mx-5 mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        ) : null}

        <div className="max-h-[68vh] overflow-auto border-t border-white/[0.06] p-4">
          {loading ? (
            <ul className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <li key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.05]" />
              ))}
            </ul>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-slate-300">No clients yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Click Add client to open a quick form.
              </p>
              <button
                type="button"
                onClick={openCreate}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/25 hover:bg-emerald-500/25"
              >
                <Plus className="h-4 w-4" />
                Add first client
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((client) => {
                const palette = paletteFromClient(client)
                const missingAssets = !client.logo_url || !client.business_profile_url || palette.length === 0
                return (
                <li
                  key={client.id}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <button type="button" onClick={() => openEdit(client)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-start gap-3">
                        <ClientIdentityAvatar
                          name={client.name}
                          logoUrl={client.logo_url}
                          brandHint={palette[0] ?? null}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{client.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{client.company ? `${client.company} client` : 'Social media client'}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                            {client.email ? (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="h-3.5 w-3.5 shrink-0" />
                                {client.email}
                              </span>
                            ) : null}
                            {client.phone ? (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                {client.phone}
                              </span>
                            ) : null}
                            {client.website ? (
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <Globe className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{client.website.replace(/^https?:\/\//, '')}</span>
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 flex items-center gap-1.5">
                            {palette.slice(0, 3).map((hex) => (
                              <span
                                key={`${client.id}-dot-${hex}`}
                                className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white/20"
                                style={{ backgroundColor: hex }}
                                title={hex}
                              />
                            ))}
                            {palette.length > 3 ? <span className="text-[10px] text-slate-600">+{palette.length - 3}</span> : null}
                            {missingAssets ? (
                              <span className="ml-2 text-[10px] text-amber-300/90">Missing assets</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 lg:shrink-0">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(client)}
                          className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25"
                        >
                          Open Kit
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(client)}
                          className="rounded-lg border border-white/[0.12] px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/[0.06]"
                        >
                          Edit
                        </button>
                        <details className="relative">
                          <summary className="list-none cursor-pointer rounded-lg border border-white/[0.12] px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/[0.06]">
                            ⋯
                          </summary>
                          <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-white/[0.1] bg-[#0f172b] p-1.5 shadow-xl">
                            {client.logo_url || client.business_profile_url ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (client.logo_url) {
                                    void downloadProtectedFile(client.logo_url, `${client.name}-logo`)
                                  }
                                  if (client.business_profile_url) {
                                    void downloadProtectedFile(client.business_profile_url, `${client.name}-brand-guide.pdf`)
                                  }
                                }}
                                className="w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] text-slate-200 hover:bg-white/[0.06]"
                              >
                                Download assets
                              </button>
                            ) : null}
                            {client.logo_url ? (
                              <button
                                type="button"
                                onClick={() => void openProtectedFile(client.logo_url!)}
                                className="w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] text-slate-200 hover:bg-white/[0.06]"
                              >
                                View logo
                              </button>
                            ) : null}
                            {client.business_profile_url ? (
                              <button
                                type="button"
                                onClick={() => void openProtectedFile(client.business_profile_url!)}
                                className="w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] text-slate-200 hover:bg-white/[0.06]"
                              >
                                Open PDF
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => void remove(client)}
                              className="w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] text-red-300 hover:bg-red-500/10"
                            >
                              Delete
                            </button>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
          onClick={closeModal}
        >
          <div
            className="flex max-h-[min(94vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-[#0a0f18] ring-1 ring-white/[0.06] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-white/[0.05] px-6 py-6 sm:px-8 sm:py-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-white">
                    {isEdit ? 'Edit Client Work Kit' : 'Create Client Work Kit'}
                  </h3>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
                    {isEdit
                      ? 'Identity, brand palette, and files your team uses in tasks.'
                      : 'Set up once — your team reuses this everywhere.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="-mr-1 rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300"
                  aria-label="Close form"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-8">
                <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-14">
                  <section className="space-y-6">
                    <KitField
                      refEl={nameInputRef}
                      label="Client name"
                      required
                      value={form.name}
                      onChange={(v) => setForm((s) => ({ ...s, name: v }))}
                      placeholder="Acme Corporation"
                    />
                    <KitField
                      label="Company"
                      value={form.company}
                      onChange={(v) => setForm((s) => ({ ...s, company: v }))}
                      placeholder="Acme Inc."
                    />
                    <KitField
                      label="Website"
                      type="url"
                      value={form.website}
                      onChange={(v) => setForm((s) => ({ ...s, website: v }))}
                      placeholder="https://example.com"
                    />
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <KitField
                        label="Email"
                        type="email"
                        value={form.email}
                        onChange={(v) => setForm((s) => ({ ...s, email: v }))}
                        placeholder="contact@acme.com"
                        icon={<Mail className="h-4 w-4 text-slate-500" />}
                      />
                      <KitField
                        label="Phone"
                        value={form.phone}
                        onChange={(v) => setForm((s) => ({ ...s, phone: v }))}
                        placeholder="+92 300 0000000"
                        icon={<Phone className="h-4 w-4 text-slate-500" />}
                      />
                    </div>
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-400">
                        <MapPin className="h-4 w-4 text-slate-500" />
                        Address
                      </label>
                      <textarea
                        rows={2}
                        value={form.address}
                        onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                        placeholder="Street, city, region"
                        className={softTextareaClass}
                      />
                    </div>
                  </section>

                  <section className="space-y-12">
                  <BrandColorsEditor
                    colors={form.brand_colors}
                    onChange={(brand_colors) => setForm((s) => ({ ...s, brand_colors }))}
                    maxColors={MAX_BRAND_COLORS}
                    normalizeHexList={normalizeHexList}
                  />

                  <ClientAssetsEditor
                    logoUrl={pendingLogoUrl ?? liveClient?.logo_url ?? null}
                    pdfName={
                      pendingPdf?.name ??
                      (liveClient?.business_profile_url ? 'Brand guide.pdf' : null)
                    }
                    hasSavedPdf={Boolean(liveClient?.business_profile_url)}
                    hasLogo={Boolean(pendingLogoUrl || liveClient?.logo_url)}
                    disabled={busy || assetBusy}
                    onLogoSelect={setPendingLogo}
                    onLogoClear={() => {
                      if (pendingLogo) setPendingLogo(null)
                      else void removeLogoAsset()
                    }}
                    onPdfSelect={setPendingPdf}
                    onPdfClear={() => {
                      if (pendingPdf) setPendingPdf(null)
                      else void removeBusinessProfileAsset()
                    }}
                    onLogoPreview={() =>
                      void openProtectedFile((pendingLogoUrl ?? liveClient?.logo_url)!)
                    }
                    onPdfOpen={() => void openProtectedFile(liveClient!.business_profile_url!)}
                  />
                </section>
                </div>

                <div className="mt-12">
                  <label className="mb-2 block text-sm font-medium text-slate-400">Notes</label>
                  <textarea
                    rows={4}
                    value={form.notes}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                    placeholder="Scope, communication style, key preferences…"
                    className={softTextareaClass}
                  />
                </div>

                {error ? (
                  <p className="mt-6 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-white/[0.05] px-6 py-5 sm:px-8">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-200 sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy || assetBusy}
                    className="w-full rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50 sm:w-auto"
                  >
                    {busy || assetBusy ? 'Saving…' : 'Save client kit'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'CL'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function ClientIdentityAvatar({
  name,
  logoUrl,
  brandHint,
}: {
  name: string
  logoUrl: string | null
  brandHint?: string | null
}) {
  const [logoFailed, setLogoFailed] = useState(false)
  const initials = initialsFromName(name)
  const showLogo = Boolean(logoUrl) && !logoFailed

  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.04] text-xs font-semibold text-slate-300"
      style={brandHint ? { boxShadow: `inset 0 0 0 1px ${brandHint}55` } : undefined}
      aria-label={`${name} avatar`}
    >
      {showLogo ? (
        <img
          src={logoUrl ?? ''}
          alt={`${name} logo`}
          className="h-full w-full object-cover"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}
