import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type DragEvent,
  type ChangeEvent,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronLeft, ImagePlus, ClipboardList, Copy, RotateCcw, X } from 'lucide-react'
import { ApiError, apiRequest, buildApiUrl } from '../../lib/api'
import { FlowPilotMark } from '../../components/SidebarBrandHeader'

/** Multi-step intake — draft saved locally (drops oversized logo if quota exceeded). */
const STORAGE_KEY = 'flowpilot_client_intake_draft_v2'

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Payload stays backward-compatible with approve pipeline & mapper `buildNotes`. */
export type IntakeData = {
  brandName: string
  contactEmail: string
  businessDescription: string
  industry: string
  websiteOrSocial: string
  problemYouSolve: string
  uniqueValue: string
  mission: string
  vision: string
  idealCustomer: string
  ageGroups: string[]
  audienceMainProblem: string
  audienceMainDesire: string
  brandPersonality: string[]
  personalityDescription: string
  preferredColors: string
  visualStyle: string
  referenceBrands: string
  serviceLogo: boolean
  serviceSocial: boolean
  serviceWebsite: boolean
  serviceAds: boolean
  serviceContent: boolean
  serviceQuantity: string
  mainGoal: string
  budgetRange: string
  timeline: string
  logoDataUrl: string | null
  logoFileName: string | null
}

const INITIAL: IntakeData = {
  brandName: '',
  contactEmail: '',
  businessDescription: '',
  industry: '',
  websiteOrSocial: '',
  problemYouSolve: '',
  uniqueValue: '',
  mission: '',
  vision: '',
  idealCustomer: '',
  ageGroups: [],
  audienceMainProblem: '',
  audienceMainDesire: '',
  brandPersonality: [],
  personalityDescription: '',
  preferredColors: '',
  visualStyle: '',
  referenceBrands: '',
  serviceLogo: false,
  serviceSocial: false,
  serviceWebsite: false,
  serviceAds: false,
  serviceContent: false,
  serviceQuantity: '',
  mainGoal: '',
  budgetRange: '',
  timeline: '',
  logoDataUrl: null,
  logoFileName: null,
}

const MAIN_GOALS = ['Sales', 'Leads', 'Awareness'] as const

const BUDGET_RANGES = [
  { value: '', label: 'Choose a range' },
  { value: 'under_2k', label: 'Under $2,000' },
  { value: '2k_5k', label: '$2,000 – $5,000' },
  { value: '5k_15k', label: '$5,000 – $15,000' },
  { value: '15k_50k', label: '$15,000 – $50,000' },
  { value: '50k_plus', label: '$50,000+' },
  { value: 'discuss', label: 'Prefer to discuss' },
] as const

const STEPS = [
  { key: 'basic', title: 'Basic info', hint: 'Just the essentials — takes under a minute.' },
  { key: 'brand_kit', title: 'Brand kit', hint: 'Logo and colours help our team move faster.' },
  { key: 'services', title: 'What you need', hint: 'Pick what we should scope first.' },
  { key: 'goals', title: 'Goals & budget', hint: 'Align on outcomes and investment.' },
] as const

const COLOR_SWATCHES = [
  '#0F172A',
  '#10B981',
  '#14B8A6',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#EAB308',
  '#FFFFFF',
  '#000000',
] as const

function loadDraft(storageKey: string): IntakeData | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<IntakeData>
    return {
      ...INITIAL,
      ...parsed,
      ageGroups: Array.isArray(parsed.ageGroups) ? parsed.ageGroups : [],
      brandPersonality: Array.isArray(parsed.brandPersonality) ? parsed.brandPersonality : [],
      logoDataUrl: typeof parsed.logoDataUrl === 'string' ? parsed.logoDataUrl : null,
      logoFileName: typeof parsed.logoFileName === 'string' ? parsed.logoFileName : null,
      serviceQuantity: typeof parsed.serviceQuantity === 'string' ? parsed.serviceQuantity : '',
    }
  } catch {
    return null
  }
}

function persistDraft(storageKey: string, data: IntakeData): void {
  try {
    const stripped =
      JSON.stringify(data).length > 800_000 ? ({ ...data, logoDataUrl: null } satisfies IntakeData) : data
    localStorage.setItem(storageKey, JSON.stringify(stripped))
  } catch {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...data, logoDataUrl: null }))
    } catch {
      /* ignore */
    }
  }
}

function isValidEmail(value: string): boolean {
  const t = value.trim()
  if (!t) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

/** Parsed hex tokens already chosen / typed */
function parsePreferredHexes(s: string): string[] {
  const m = s.match(/#[0-9A-Fa-f]{6}/g)
  return m ?? []
}

function togglePreferredHex(current: string, hex: string): string {
  const hexNorm = hex.startsWith('#') ? hex : `#${hex}`
  const list = parsePreferredHexes(current)
  const i = list.findIndex((x) => x.toUpperCase() === hexNorm.toUpperCase())
  if (i >= 0) {
    const next = [...list]
    next.splice(i, 1)
    return next.join(' ')
  }
  const next = [...list, hexNorm]
  if (next.length > 4) next.shift()
  return next.join(' ')
}

function validateStep(step: number, d: IntakeData): string | null {
  switch (step) {
    case 0:
      if (!d.brandName.trim()) return 'Please enter your brand name.'
      if (!d.contactEmail.trim()) return 'Please enter your email address.'
      if (!isValidEmail(d.contactEmail)) return 'Please enter a valid email address.'
      if (!d.businessDescription.trim()) return 'Add a short description (1–2 sentences).'
      return null
    case 1:
      return null
    case 2:
      if (!d.serviceLogo && !d.serviceSocial && !d.serviceWebsite && !d.serviceAds && !d.serviceContent) {
        return 'Pick at least one service.'
      }
      return null
    case 3:
      if (!d.mainGoal) return 'Choose your main goal.'
      if (!d.budgetRange) return 'Select a budget range.'
      return null
    default:
      return null
  }
}

function inputClass() {
  return [
    'w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 text-[16px] text-slate-200 md:text-[15px] md:py-3.5',
    'placeholder:text-slate-600',
    'focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
    'hover:border-white/[0.12]',
  ].join(' ')
}

function selectClass() {
  return [
    inputClass(),
    'cursor-pointer appearance-none bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-11',
    "[background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")]",
    '[&>option]:bg-[#0b1324] [&>option]:text-slate-200',
  ].join(' ')
}

function labelClass() {
  return 'mb-2 block text-sm font-medium text-slate-300'
}

function helperClass() {
  return 'mt-2 text-xs leading-relaxed text-slate-500'
}

type LogoDropProps = {
  formId: string
  logoDataUrl: string | null
  fileName: string | null
  onPick: (dataUrl: string | null, name: string | null) => void
  error: string | null
  setError: (msg: string | null) => void
}

function LogoDropZone({ formId, logoDataUrl, fileName, onPick, error, setError }: LogoDropProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const ingestFile = useCallback(
    (file: File) => {
      setError(null)
      if (!ACCEPT_TYPES.includes(file.type as (typeof ACCEPT_TYPES)[number])) {
        setError('Use JPG, PNG, or WebP.')
        return
      }
      if (file.size > MAX_LOGO_BYTES) {
        setError(`Logo must be under ${MAX_LOGO_BYTES / (1024 * 1024)} MB.`)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        if (typeof result === 'string') {
          onPick(result, file.name)
        }
      }
      reader.onerror = () => setError('Could not read that file.')
      reader.readAsDataURL(file)
    },
    [onPick, setError],
  )

  const onChangeInput = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) ingestFile(f)
    e.target.value = ''
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) ingestFile(f)
  }

  return (
    <div>
      <label className={labelClass()} htmlFor={`${formId}-logo-file`}>
        Logo <span className="font-normal text-slate-500">(optional, recommended)</span>
      </label>
      <input
        ref={inputRef}
        id={`${formId}-logo-file`}
        type="file"
        accept={ACCEPT_TYPES.join(',')}
        className="sr-only"
        aria-describedby={`${formId}-logo-hint`}
        onChange={onChangeInput}
      />
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          'relative cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 md:py-7',
          dragOver ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/[0.14] bg-white/[0.02] hover:border-white/[0.2]',
          logoDataUrl ? 'border-solid border-emerald-500/30 bg-emerald-500/[0.06]' : '',
        ].join(' ')}
      >
        {logoDataUrl ? (
          <div className="flex flex-col items-center gap-3">
            <div className="relative mx-auto max-h-36 max-w-[220px] overflow-hidden rounded-lg bg-black/30 ring-1 ring-white/[0.1]">
              <img src={logoDataUrl} alt="" className="mx-auto max-h-36 w-auto object-contain p-2" />
            </div>
            <p className="text-xs text-slate-400">{fileName ?? 'Uploaded logo'}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation()
                  inputRef.current?.click()
                }}
                className="rounded-lg bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/[0.12] hover:bg-white/[0.12]"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation()
                  onPick(null, null)
                  setError(null)
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.14] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.06]"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25">
              <ImagePlus className="h-6 w-6" aria-hidden />
            </span>
            <p className="text-sm font-medium text-white">Drag & drop or tap to upload</p>
            <p id={`${formId}-logo-hint`} className="text-xs text-slate-500">
              JPG, PNG, or WebP · max {MAX_LOGO_BYTES / (1024 * 1024)} MB
            </p>
          </div>
        )}
      </div>
      {error ? (
        <p className="mt-2 text-xs font-medium text-amber-200/95" role="alert">
          {error}
        </p>
      ) : (
        <p className={helperClass()}>We’ll attach this to your intake so creative can start without chasing assets.</p>
      )}
    </div>
  )
}

export function ClientIntakePage() {
  const { token: inviteToken } = useParams<{ token?: string }>()
  const isPublicInvite = Boolean(inviteToken && inviteToken.length > 0)
  const storageKey = useMemo(
    () => (isPublicInvite && inviteToken ? `flowpilot_public_intake_${inviteToken}` : STORAGE_KEY),
    [isPublicInvite, inviteToken],
  )

  const formId = useId()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<IntakeData>(INITIAL)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoErr, setLogoErr] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'err'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [inviteGate, setInviteGate] = useState<'loading' | 'ok' | 'bad'>(() => (isPublicInvite ? 'loading' : 'ok'))
  const [inviteBadMessage, setInviteBadMessage] = useState<string | null>(null)
  const [publicLabel, setPublicLabel] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isPublicInvite || !inviteToken) {
      setInviteGate('ok')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(buildApiUrl(`/api/public/client-intake/${inviteToken}`), {
          headers: { Accept: 'application/json' },
        })
        const body = (await res.json().catch(() => ({}))) as { message?: string; label?: string | null }
        if (cancelled) return
        if (!res.ok) {
          setInviteGate('bad')
          setInviteBadMessage(body.message ?? 'This link is not available.')
          return
        }
        setPublicLabel(typeof body.label === 'string' ? body.label : null)
        setInviteGate('ok')
      } catch {
        if (!cancelled) {
          setInviteGate('bad')
          setInviteBadMessage('Could not verify this link. Check your connection and try again.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isPublicInvite, inviteToken])

  useEffect(() => {
    if (isPublicInvite && inviteGate !== 'ok') return
    const draft = loadDraft(storageKey)
    if (draft) setData(draft)
    setHydrated(true)
  }, [storageKey, isPublicInvite, inviteGate])

  useEffect(() => {
    if (!hydrated || submitted) return
    if (isPublicInvite && inviteGate !== 'ok') return
    persistDraft(storageKey, data)
  }, [data, hydrated, submitted, storageKey, isPublicInvite, inviteGate])

  const progressFrac = useMemo(() => (step + 1) / STEPS.length, [step])

  const update = useCallback(<K extends keyof IntakeData>(key: K, value: IntakeData[K]) => {
    setData((s) => ({ ...s, [key]: value }))
    setError(null)
  }, [])

  const goNext = () => {
    const err = validateStep(step, data)
    if (err) {
      setError(err)
      queueMicrotask(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
      return
    }
    setError(null)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const goBack = () => {
    setError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const err = validateStep(step, data)
    if (err) {
      setError(err)
      queueMicrotask(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      if (isPublicInvite && inviteToken) {
        await apiRequest<{ id: number }>(`/api/public/client-intake/${inviteToken}`, {
          method: 'POST',
          body: JSON.stringify({ payload: data }),
        })
      } else {
        await apiRequest<{ id: number }>('/api/admin/client-intakes', {
          method: 'POST',
          body: JSON.stringify({ payload: data }),
        })
      }
      setSubmitted(true)
      setCopyState('idle')
      localStorage.removeItem(storageKey)
    } catch (ex) {
      setSubmitError(ex instanceof ApiError ? ex.message : 'Could not submit intake')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setData(INITIAL)
    setStep(0)
    setSubmitted(false)
    setError(null)
    setLogoErr(null)
    setSubmitError(null)
    setCopyState('idle')
    localStorage.removeItem(storageKey)
  }

  async function copyJsonAnswers() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2500)
    } catch {
      setCopyState('err')
      window.setTimeout(() => setCopyState('idle'), 3000)
    }
  }

  const stepValid = validateStep(step, data) === null
  const publicReady = isPublicInvite && inviteGate === 'ok'

  const toggleSwatch = (hex: string) => {
    const next = togglePreferredHex(data.preferredColors, hex)
    update('preferredColors', next)
  }

  if (isPublicInvite && inviteGate === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#070708] px-4 font-sans text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
        <p className="mt-4 text-sm">Opening your secure form…</p>
      </div>
    )
  }

  if (isPublicInvite && inviteGate === 'bad') {
    return (
      <div className="min-h-screen bg-[#070708] px-4 py-16 font-sans">
        <div className="mx-auto max-w-md rounded-2xl border border-white/[0.08] bg-[#0c1222]/90 p-8 text-center ring-1 ring-white/[0.04]">
          <p className="text-lg font-semibold text-white">Link unavailable</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">{inviteBadMessage}</p>
          <p className="mt-6 text-xs text-slate-500">
            If you were sent this link by your agency, ask them for a new invite.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={
        publicReady
          ? 'min-h-screen bg-[#070708] font-sans antialiased'
          : 'min-h-[calc(100vh-5rem)] scroll-mt-4 w-full font-sans antialiased'
      }
    >
      {publicReady ? (
        <header className="border-b border-white/[0.06] bg-[#070708]/95 px-4 py-4 sm:px-8">
          <div className="mx-auto flex max-w-6xl items-center gap-4">
            <FlowPilotMark />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-[1.15] tracking-[-0.045em] text-white">FlowPilot</p>
              <p className="mt-1 truncate text-[12px] leading-snug text-slate-500">
                Secure client intake
                {publicLabel ? <span className="text-slate-400"> · {publicLabel}</span> : null}
              </p>
            </div>
          </div>
        </header>
      ) : null}

      <div ref={topRef} className={publicReady ? 'mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8' : undefined}>
        <div className="w-full">
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 ring-1 ring-white/[0.04] backdrop-blur">
            <div className="border-b border-white/[0.06] px-5 py-6 sm:px-8 sm:py-8">
              <div className="flex flex-col gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
                    <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                    Client intake
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">
                    {publicReady ? 'Share your project details' : 'Tell us about your project'}
                  </h2>
                  <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-400">
                    {publicReady
                      ? 'Four quick steps — only what we need to move fast. Your progress saves on this device.'
                      : 'Four guided steps. We ask less so you finish faster — upload your logo early so the team can execute.'}
                  </p>
                  {publicReady ? (
                    <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-100/90">
                      Tip: short answers are fine. Uploading a logo now saves a round-trip later.
                    </div>
                  ) : null}
                </div>
              </div>

              {!submitted ? (
                <div className="mt-8">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-slate-300">
                      Step {step + 1} of {STEPS.length}
                    </span>
                  </div>
                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progressFrac * 100)}
                    aria-label="Form progress"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-300 ease-out"
                      style={{ width: `${progressFrac * 100}%` }}
                    />
                  </div>

                  <div className="mt-4 -mx-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
                    <ol className="flex min-w-max gap-2 px-1" aria-label="Steps">
                      {STEPS.map((s, i) => (
                        <li key={s.key}>
                          <button
                            type="button"
                            onClick={() => {
                              if (i <= step) {
                                setStep(i)
                                setError(null)
                              }
                            }}
                            disabled={i > step}
                            className={[
                              'whitespace-nowrap rounded-full px-3 py-2 text-left text-[11px] font-semibold transition-colors sm:py-1.5 sm:text-xs',
                              i === step
                                ? 'bg-white/[0.12] text-white ring-1 ring-white/[0.14]'
                                : i < step
                                  ? 'cursor-pointer bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25 hover:bg-emerald-500/25'
                                  : 'cursor-not-allowed bg-white/[0.03] text-slate-600',
                            ].join(' ')}
                          >
                            <span className="mr-1 tabular-nums text-slate-500">{i + 1}.</span>
                            {s.title}
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="mt-5 min-h-[2.75rem]">
                    <p className="text-base font-semibold text-white">{STEPS[step].title}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{STEPS[step].hint}</p>
                  </div>
                </div>
              ) : null}
            </div>

            {!submitted ? (
              <form id={formId} onSubmit={handleSubmit} className="flex flex-col px-5 py-6 sm:px-8 sm:py-8" noValidate>
                {error ? (
                  <div
                    ref={errorRef}
                    role="alert"
                    className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                  >
                    {error}
                  </div>
                ) : null}

                <div className="h-[min(32rem,calc(100vh-19rem))] min-h-[22rem] overflow-y-auto overscroll-contain sm:h-[min(34rem,calc(100vh-17rem))] sm:min-h-[26rem]">
                  <div className="space-y-6 pb-2">
                    {step === 0 && (
                      <section aria-labelledby={`${formId}-s0`} className="space-y-6">
                        <h3 id={`${formId}-s0`} className="sr-only">
                          Basic information
                        </h3>
                        <div>
                          <label htmlFor={`${formId}-brandName`} className={labelClass()}>
                            Brand name <span className="text-red-400">*</span>
                          </label>
                          <input
                            id={`${formId}-brandName`}
                            className={inputClass()}
                            value={data.brandName}
                            onChange={(e) => update('brandName', e.target.value)}
                            placeholder="e.g. Northwind Coffee"
                            autoComplete="organization"
                          />
                          <p className={helperClass()}>Legal or trading name — what should appear on deliverables?</p>
                        </div>

                        <LogoDropZone
                          formId={formId}
                          logoDataUrl={data.logoDataUrl}
                          fileName={data.logoFileName}
                          error={logoErr}
                          setError={setLogoErr}
                          onPick={(url, name) => {
                            update('logoDataUrl', url)
                            update('logoFileName', name)
                          }}
                        />

                        <div>
                          <label htmlFor={`${formId}-contactEmail`} className={labelClass()}>
                            Your email <span className="text-red-400">*</span>
                          </label>
                          <input
                            id={`${formId}-contactEmail`}
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            className={inputClass()}
                            value={data.contactEmail}
                            onChange={(e) => update('contactEmail', e.target.value)}
                            placeholder="you@company.com"
                          />
                          <p className={helperClass()}>For updates and to confirm we received this intake.</p>
                        </div>

                        <div>
                          <label htmlFor={`${formId}-biz`} className={labelClass()}>
                            Business description <span className="text-red-400">*</span>
                          </label>
                          <textarea
                            id={`${formId}-biz`}
                            rows={5}
                            className={`${inputClass()} min-h-[130px] resize-y`}
                            value={data.businessDescription}
                            onChange={(e) => update('businessDescription', e.target.value)}
                            placeholder="What do you offer, and to whom — in one or two sentences?"
                          />
                        </div>
                      </section>
                    )}

                    {step === 1 && (
                      <section aria-labelledby={`${formId}-s1`} className="space-y-6">
                        <h3 id={`${formId}-s1`} className="sr-only">
                          Brand kit
                        </h3>
                        <fieldset>
                          <legend className={labelClass()}>Brand colours — quick pick</legend>
                          <p className="-mt-1 mb-3 text-xs text-slate-500">Tap up to four. Optional — add custom hex below.</p>
                          <div className="flex flex-wrap gap-2">
                            {COLOR_SWATCHES.map((hex) => {
                              const active = parsePreferredHexes(data.preferredColors).some(
                                (h) => h.toUpperCase() === hex.toUpperCase(),
                              )
                              return (
                                <button
                                  key={hex}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => toggleSwatch(hex)}
                                  title={hex}
                                  className={[
                                    'relative h-11 w-11 rounded-xl border-2 transition ring-offset-2 ring-offset-[#0c1222]',
                                    active ? 'border-emerald-400 ring-2 ring-emerald-500/50' : 'border-white/[0.12] hover:border-white/[0.22]',
                                    hex === '#FFFFFF' ? 'shadow-inner shadow-black/40' : '',
                                  ].join(' ')}
                                  style={{ backgroundColor: hex }}
                                >
                                  <span className="sr-only">{hex}</span>
                                </button>
                              )
                            })}
                          </div>
                        </fieldset>

                        <div>
                          <label htmlFor={`${formId}-colors`} className={labelClass()}>
                            Custom colours <span className="font-normal text-slate-500">(optional)</span>
                          </label>
                          <input
                            id={`${formId}-colors`}
                            className={inputClass()}
                            value={data.preferredColors}
                            onChange={(e) => update('preferredColors', e.target.value)}
                            placeholder="e.g. #0F172A #10B981 or colour names"
                          />
                          <p className={helperClass()}>We’ll pull hex codes for your client record when you approve the intake.</p>
                        </div>

                        <div>
                          <label htmlFor={`${formId}-web`} className={labelClass()}>
                            Website or social <span className="font-normal text-slate-500">(optional)</span>
                          </label>
                          <input
                            id={`${formId}-web`}
                            type="url"
                            inputMode="url"
                            className={inputClass()}
                            value={data.websiteOrSocial}
                            onChange={(e) => update('websiteOrSocial', e.target.value)}
                            placeholder="https://… or Instagram / LinkedIn URL"
                          />
                        </div>
                      </section>
                    )}

                    {step === 2 && (
                      <section aria-labelledby={`${formId}-s2`} className="space-y-5">
                        <h3 id={`${formId}-s2`} className="sr-only">
                          Services
                        </h3>
                        <p className="text-sm text-slate-400">What should we scope first? Pick everything that applies.</p>
                        {[
                          { key: 'serviceLogo' as const, label: 'Logo & identity', hint: 'Marks, guidelines, refresh' },
                          {
                            key: 'serviceSocial' as const,
                            label: 'Social / Instagram',
                            hint: 'Content, calendars, growth',
                          },
                          { key: 'serviceWebsite' as const, label: 'Website', hint: 'Design, build, or landing pages' },
                          { key: 'serviceAds' as const, label: 'Paid ads', hint: 'Meta, Google, etc.' },
                          { key: 'serviceContent' as const, label: 'Content', hint: 'Copy, video, SEO support' },
                        ].map((row) => (
                          <label
                            key={row.key}
                            className="flex min-h-[52px] cursor-pointer items-start gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 hover:border-white/[0.12] md:min-h-0"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/20 bg-white/[0.05] text-emerald-500 focus:ring-emerald-500/40 md:h-4 md:w-4"
                              checked={data[row.key]}
                              onChange={(e) => update(row.key, e.target.checked)}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-white">{row.label}</span>
                              <span className="mt-0.5 block text-xs text-slate-500">{row.hint}</span>
                            </span>
                          </label>
                        ))}

                        <div>
                          <label htmlFor={`${formId}-qty`} className={labelClass()}>
                            Quantity / scope notes <span className="font-normal text-slate-500">(optional)</span>
                          </label>
                          <textarea
                            id={`${formId}-qty`}
                            rows={3}
                            className={`${inputClass()} resize-y`}
                            value={data.serviceQuantity}
                            onChange={(e) => update('serviceQuantity', e.target.value)}
                            placeholder="e.g. 12 posts/month, one landing page, ad spend managed…"
                          />
                        </div>
                      </section>
                    )}

                    {step === 3 && (
                      <section aria-labelledby={`${formId}-s3`} className="space-y-6">
                        <h3 id={`${formId}-s3`} className="sr-only">
                          Goals and budget
                        </h3>
                        <fieldset>
                          <legend className={labelClass()}>
                            Main goal <span className="text-red-400">*</span>
                          </legend>
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            {MAIN_GOALS.map((g) => (
                              <label
                                key={g}
                                className={[
                                  'flex min-h-[52px] cursor-pointer items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-semibold md:min-h-0',
                                  data.mainGoal === g
                                    ? 'border-emerald-500/60 bg-emerald-500/90 text-white shadow-md shadow-emerald-500/20'
                                    : 'border-white/[0.1] bg-white/[0.03] text-slate-300 hover:border-white/[0.14]',
                                ].join(' ')}
                              >
                                <input
                                  type="radio"
                                  name={`${formId}-goal`}
                                  className="sr-only"
                                  checked={data.mainGoal === g}
                                  onChange={() => update('mainGoal', g)}
                                />
                                {g}
                              </label>
                            ))}
                          </div>
                        </fieldset>

                        <div>
                          <label htmlFor={`${formId}-budget`} className={labelClass()}>
                            Budget range <span className="text-red-400">*</span>
                          </label>
                          <select
                            id={`${formId}-budget`}
                            className={selectClass()}
                            value={data.budgetRange}
                            onChange={(e) => update('budgetRange', e.target.value)}
                          >
                            {BUDGET_RANGES.map((o) => (
                              <option key={o.value || 'empty'} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <p className={helperClass()}>Indicative only — final scope depends on deliverables.</p>
                        </div>
                      </section>
                    )}
                  </div>
                </div>

                <div className="mt-8 flex flex-col-reverse gap-3 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={step === 0}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40 md:min-h-0 md:py-2.5"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    Back
                  </button>
                  <div className="flex flex-1 justify-end gap-2 sm:flex-none">
                    {step < STEPS.length - 1 ? (
                      <button
                        type="button"
                        onClick={goNext}
                        className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-500/90 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-500/15 hover:bg-emerald-500 sm:w-auto md:min-h-0 md:py-2.5"
                      >
                        Next →
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-60 sm:w-auto md:min-h-0 md:py-2.5"
                      >
                        <Check className="h-4 w-4" aria-hidden />
                        {submitting ? 'Submitting…' : 'Submit project →'}
                      </button>
                    )}
                  </div>
                </div>

                {submitError ? (
                  <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
                    {submitError}
                  </p>
                ) : null}

                <p className="mt-6 text-center text-xs text-slate-500">
                  {publicReady ? 'Progress saves automatically on this device. ' : 'Draft saves automatically on this device. '}
                  Large logos may not persist after refresh — final submit always includes them.
                  <button
                    type="button"
                    className="ml-1 font-semibold text-emerald-400 underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-300"
                    onClick={resetForm}
                  >
                    Clear form
                  </button>
                </p>
              </form>
            ) : (
              <div className="px-5 py-10 text-center sm:px-8 sm:py-12">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
                  <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-white">
                  {publicReady ? 'Thank you — we received your answers' : 'Submitted for review'}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-slate-400">
                  {publicReady
                    ? 'Our team will review what you shared and follow up if we need anything else.'
                    : 'Your intake is in the queue. Approve it when ready to create the client record.'}
                </p>
                {!publicReady ? (
                  <p className="mt-4">
                    <Link
                      to="/admin/client-intakes"
                      className="text-sm font-semibold text-emerald-400 underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-300"
                    >
                      Open intake queue
                    </Link>
                  </p>
                ) : null}
                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => void copyJsonAnswers()}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/[0.08] px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/[0.12] hover:bg-white/[0.12]"
                  >
                    <Copy className="h-4 w-4" aria-hidden />
                    {copyState === 'copied' ? 'Copied' : copyState === 'err' ? 'Copy blocked' : 'Copy answers (JSON)'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-5 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/25"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Start another intake
                  </button>
                </div>
              </div>
            )}
          </div>

          {!submitted ? (
            <p className="mt-4 text-center text-[11px] text-slate-500">
              {stepValid ? 'Looks good — continue when ready.' : 'Complete required fields to continue.'}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
