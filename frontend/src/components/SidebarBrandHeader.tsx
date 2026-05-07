import { BrandLogo } from './BrandLogo'

const roleSubtitleClass =
  'text-[9px] font-normal uppercase leading-none tracking-[0.28em] text-slate-500/55'

type SidebarBrandHeaderProps = {
  /** Shown under “FlowPilot” — e.g. Admin, Team */
  roleLabel: string
  /** Drawer / compact top bar: slightly tighter vertical padding */
  density?: 'default' | 'compact'
  className?: string
}

/**
 * Premium sidebar brand row: confident mark, clear title / role hierarchy.
 * Left inset matches nav icons (nav px-3 + row px-3 = pl-6).
 */
export function SidebarBrandHeader({ roleLabel, density = 'default', className = '' }: SidebarBrandHeaderProps) {
  const pad = density === 'compact' ? 'pb-4 pt-5' : 'pb-5 pt-7'

  return (
    <div className={`pl-6 pr-3 ${pad} ${className}`.trim()}>
      <div className="flex items-center gap-5">
        <FlowPilotMark />
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <p className="text-[15px] font-semibold leading-[1.15] tracking-[-0.045em] text-white">FlowPilot</p>
          <p className={roleSubtitleClass}>{roleLabel}</p>
        </div>
      </div>
    </div>
  )
}

/** Icon-only mark — soft badge surface, no glow (clarity on dark UI). */
export function FlowPilotMark({ className = '' }: { className?: string }) {
  return (
    <div className={`shrink-0 ${className}`.trim()}>
      <div
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#111826]"
      >
        <BrandLogo className="h-[26px] w-[26px] object-contain object-center" />
      </div>
    </div>
  )
}

/** Mark + titles — mobile drawer (parent should use same horizontal inset as desktop). */
export function SidebarBrandInline({ roleLabel }: { roleLabel: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-5">
      <FlowPilotMark />
      <div className="flex min-w-0 flex-col justify-center gap-2">
        <p className="truncate text-[15px] font-semibold leading-[1.15] tracking-[-0.045em] text-white">FlowPilot</p>
        <p className={`truncate ${roleSubtitleClass}`}>{roleLabel}</p>
      </div>
    </div>
  )
}
