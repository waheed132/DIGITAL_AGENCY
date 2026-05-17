import { useRef, useState, type ReactNode, type RefObject } from 'react'
import { Plus, Trash2, Upload, FileText } from 'lucide-react'

const LOGO_ACCEPT = 'image/jpeg,image/png,image/webp'

export const softInputClass =
  'w-full rounded-lg bg-white/[0.04] px-3.5 py-3 text-sm text-slate-100 outline-none ring-1 ring-white/[0.06] placeholder:text-slate-600 focus:ring-emerald-500/25'

export const softTextareaClass =
  'w-full resize-y rounded-xl bg-white/[0.03] px-4 py-3.5 text-sm leading-relaxed text-slate-200 outline-none ring-1 ring-white/[0.05] placeholder:text-slate-600 focus:ring-emerald-500/20'

function brandColorLabel(index: number): string {
  if (index === 0) return 'Primary'
  if (index === 1) return 'Secondary'
  return `Accent ${index - 1}`
}

function normalizeHex(value: string): string | null {
  const t = value.trim()
  if (t === '') return null
  const normalized = t.startsWith('#') ? t : `#${t}`
  return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized : null
}

export function BrandColorsEditor({
  colors,
  onChange,
  maxColors,
  normalizeHexList,
}: {
  colors: string[]
  onChange: (next: string[]) => void
  maxColors: number
  normalizeHexList: (colors: string[]) => string[]
}) {
  function updateAt(index: number, value: string) {
    const next = [...colors]
    next[index] = value
    onChange(next)
  }

  function removeAt(index: number) {
    if (colors.length <= 1) return
    onChange(colors.filter((_, i) => i !== index))
  }

  function addColor() {
    if (colors.length >= maxColors) return
    onChange([...colors, ''])
  }

  const palette = normalizeHexList(colors)

  return (
    <section className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-white">Brand colors</h4>
      </div>

      {palette.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          {palette.map((hex, idx) => (
            <button
              key={`${hex}-${idx}`}
              type="button"
              title={hex}
              onClick={() => void navigator.clipboard.writeText(hex)}
              className="h-12 w-12 shrink-0 rounded-full ring-1 ring-white/10 transition hover:ring-emerald-500/30"
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        {colors.map((c, idx) => (
          <ColorRow
            key={idx}
            label={brandColorLabel(idx)}
            value={c}
            onChange={(v) => updateAt(idx, v)}
            onRemove={colors.length > 1 ? () => removeAt(idx) : undefined}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={colors.length >= maxColors}
        onClick={addColor}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
        Add color
      </button>
    </section>
  )
}

function ColorRow({
  label,
  value,
  onChange,
  onRemove,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onRemove?: () => void
}) {
  const hex = normalizeHex(value)
  const pickable = hex ?? '#000000'

  return (
    <div className="flex items-center gap-3">
      <label className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-white/[0.08]">
        <span
          className="absolute inset-0"
          style={{ backgroundColor: hex ?? 'transparent' }}
        />
        <input
          type="color"
          value={pickable}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          title={`Pick ${label.toLowerCase()}`}
        />
      </label>
      <div className="min-w-0 flex-1">
        <span className="mb-1 block text-xs text-slate-500">{label}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#059669"
          className={softInputClass}
        />
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300"
          aria-label={`Remove ${label}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}

export function ClientAssetsEditor({
  logoUrl,
  pdfName,
  hasSavedPdf,
  hasLogo,
  disabled,
  onLogoSelect,
  onLogoClear,
  onPdfSelect,
  onPdfClear,
  onLogoPreview,
  onPdfOpen,
}: {
  logoUrl: string | null
  pdfName: string | null
  hasSavedPdf: boolean
  hasLogo: boolean
  disabled: boolean
  onLogoSelect: (file: File) => void
  onLogoClear: () => void
  onPdfSelect: (file: File) => void
  onPdfClear: () => void
  onLogoPreview: () => void
  onPdfOpen: () => void
}) {
  const logoInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [logoDrag, setLogoDrag] = useState(false)

  function pickLogo(file: File | undefined) {
    if (!file || disabled) return
    if (!file.type.startsWith('image/')) return
    onLogoSelect(file)
  }

  function pickPdf(file: File | undefined) {
    if (!file || disabled) return
    if (file.type !== 'application/pdf') return
    onPdfSelect(file)
  }

  return (
    <section className="space-y-8">
      <div>
        <h4 className="text-sm font-medium text-white">Client assets</h4>
        <p className="mt-1 text-sm text-slate-500">Logo and brand guide for your team.</p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') logoInputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setLogoDrag(true)
        }}
        onDragLeave={() => setLogoDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setLogoDrag(false)
          pickLogo(e.dataTransfer.files?.[0])
        }}
        onClick={() => !disabled && logoInputRef.current?.click()}
        className={`flex min-h-[168px] cursor-pointer flex-col items-center justify-center rounded-2xl px-6 py-8 text-center transition ${
          logoDrag
            ? 'bg-emerald-500/[0.06] ring-1 ring-emerald-500/30'
            : 'bg-white/[0.02] ring-1 ring-white/[0.06] hover:bg-white/[0.035]'
        } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        <input
          ref={logoInputRef}
          type="file"
          accept={LOGO_ACCEPT}
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            pickLogo(e.target.files?.[0])
            e.currentTarget.value = ''
          }}
        />
        {hasLogo && logoUrl ? (
          <img
            src={logoUrl}
            alt="Client logo"
            className="max-h-24 max-w-[200px] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <Upload className="h-6 w-6 text-slate-500" />
            <p className="mt-3 text-sm text-slate-400">Drop logo here or click to upload</p>
            <p className="mt-1 text-xs text-slate-600">PNG, JPG, or WebP</p>
          </>
        )}
      </div>

      {hasLogo ? (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <button
            type="button"
            disabled={disabled}
            onClick={onLogoPreview}
            className="text-slate-400 transition hover:text-white"
          >
            Preview
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => logoInputRef.current?.click()}
            className="text-slate-400 transition hover:text-white"
          >
            Replace
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onLogoClear}
            className="text-slate-500 transition hover:text-red-400"
          >
            Remove
          </button>
        </p>
      ) : null}

      <div className="flex items-center gap-4 rounded-xl bg-white/[0.02] px-4 py-3.5 ring-1 ring-white/[0.05]">
        <FileText className="h-5 w-5 shrink-0 text-slate-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-300">{pdfName ?? 'Brand guide (PDF)'}</p>
          {!pdfName ? <p className="text-xs text-slate-600">Optional</p> : null}
        </div>
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            pickPdf(e.target.files?.[0])
            e.currentTarget.value = ''
          }}
        />
        <div className="flex shrink-0 items-center gap-3 text-sm">
          {pdfName ? (
            <>
              {hasSavedPdf ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onPdfOpen}
                  className="text-slate-400 transition hover:text-white"
                >
                  Open
                </button>
              ) : null}
              <button
                type="button"
                disabled={disabled}
                onClick={() => pdfInputRef.current?.click()}
                className="text-slate-400 transition hover:text-white"
              >
                Replace
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={onPdfClear}
                className="text-slate-500 transition hover:text-red-400"
              >
                Remove
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => pdfInputRef.current?.click()}
              className="font-medium text-emerald-400 transition hover:text-emerald-300"
            >
              Upload
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

export function KitField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  refEl,
  icon,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: 'text' | 'email' | 'url'
  required?: boolean
  refEl?: RefObject<HTMLInputElement | null>
  icon?: ReactNode
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-400">
        {label}
        {required ? <span className="text-slate-600"> · required</span> : null}
      </label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">{icon}</span>
        ) : null}
        <input
          ref={refEl}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`${softInputClass} ${icon ? 'pl-10' : ''}`}
        />
      </div>
    </div>
  )
}
