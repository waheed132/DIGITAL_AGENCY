import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTeamProfileAvatar } from '../lib/teamProfile'

function userInitials(name: string | null | undefined): string {
  const t = name?.trim()
  if (!t) return '?'
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0][0]
    const b = parts[parts.length - 1][0]
    if (a && b) return `${a}${b}`.toUpperCase()
  }
  const w = parts[0] ?? t
  if (w.length >= 2) return w.slice(0, 2).toUpperCase()
  return w.charAt(0).toUpperCase()
}

type SidebarUserCardProps = {
  onSignOut: () => void
}

/**
 * Account block at the bottom of admin/team sidebars — avatar, identity, sign out.
 */
export function SidebarUserCard({ onSignOut }: SidebarUserCardProps) {
  const { user } = useAuth()
  const avatar = useTeamProfileAvatar()
  const initials = userInitials(user?.name)

  return (
    <div className="border-t border-white/[0.06] px-3 pb-3 pt-2.5 max-lg:px-4 max-lg:pb-5 max-lg:pt-4">
      <div className="rounded-xl bg-[#121214] p-3 ring-1 ring-white/[0.07] max-lg:p-4">
        <div className="flex gap-3">
          <div className="relative shrink-0">
            <div
              className="pointer-events-none absolute -inset-1 rounded-full bg-emerald-400/[0.14] blur-[10px]"
              aria-hidden
            />
            <div
              className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-500/30 via-emerald-500/10 to-cyan-500/5 text-[11px] font-bold tabular-nums tracking-wide text-emerald-100 ring-1 ring-white/[0.12] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)]"
              aria-hidden
            >
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold leading-tight tracking-[-0.02em] text-white">
              {user?.name ?? 'Account'}
            </p>
            <p className="mt-1 truncate text-[11px] leading-snug text-slate-500/55">{user?.email ?? ''}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          className="mt-3 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-[10px] border border-white/[0.16] bg-[#161618] py-3 text-[12px] font-semibold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] transition duration-150 hover:border-white/[0.22] hover:bg-white/[0.07] hover:text-white hover:brightness-[1.04] active:scale-[0.97] active:brightness-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121214] lg:min-h-0 lg:py-2.5"
        >
          <LogOut className="h-3.5 w-3.5 opacity-90" strokeWidth={2} aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  )
}
