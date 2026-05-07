import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, ListTodo, FolderKanban, BarChart3, Settings, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { SidebarBrandHeader, SidebarBrandInline } from '../components/SidebarBrandHeader'
import { SidebarUserCard } from '../components/SidebarUserCard'

const nav: ReadonlyArray<{ to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }> = [
  { to: '/team/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/team/tasks', label: 'My Tasks', icon: ListTodo },
  { to: '/team/projects', label: 'My Projects', icon: FolderKanban },
  { to: '/team/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/team/settings', label: 'Settings', icon: Settings, end: true },
]

function titleFromPath(pathname: string): { title: string; hint: string } {
  if (pathname.startsWith('/team/tasks')) return { title: 'My Tasks', hint: 'Your active tasks' }
  if (pathname.startsWith('/team/projects')) {
    return { title: 'My Projects', hint: 'Progress, next task, and quick actions for each assignment.' }
  }
  if (pathname.startsWith('/team/analytics')) {
    return { title: 'My Analytics', hint: 'Performance, weekly rhythm, and focus — not just counts.' }
  }
  if (pathname.startsWith('/team/settings')) return { title: 'Settings', hint: 'Profile, notifications, and preferences' }
  return { title: 'Dashboard', hint: 'Your execution control center' }
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav
      className="flex flex-col gap-1 px-3 max-lg:gap-2.5 max-lg:px-4"
      aria-label="Main"
    >
      {nav.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              'flex items-center gap-3 rounded-[10px] px-3 text-[13px] transition-colors duration-150 max-lg:min-h-[52px] max-lg:px-3.5 max-lg:py-3.5 lg:min-h-0 lg:py-2.5',
              isActive
                ? 'bg-[#1e1e22] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-white/[0.05]'
                : 'font-medium text-slate-500 hover:bg-white/[0.03] hover:text-slate-300',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? 'text-[#34d399]' : 'text-slate-500'}`} strokeWidth={isActive ? 2 : 1.65} />
              <span className="leading-none">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

const sidebarShell = 'admin-sidebar flex h-full flex-col bg-[#0c0c0e] text-slate-200 antialiased'

export function TeamLayout({ children }: { children?: ReactNode }) {
  const { logout } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { title, hint } = titleFromPath(location.pathname)

  const closeMobile = () => setMobileOpen(false)
  const handleSignOut = () => void logout()

  return (
    <div className="min-h-screen bg-[#070708] text-slate-200">
      <div className="pointer-events-none fixed inset-0 opacity-[0.35]" style={{ background: 'radial-gradient(ellipse 90% 60% at 0% 0%, rgba(52, 211, 153, 0.06), transparent 55%)' }} />

      <aside className={`fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-white/[0.05] shadow-[4px_0_24px_rgba(0,0,0,0.35)] lg:flex ${sidebarShell}`}>
        <SidebarBrandHeader roleLabel="Team" />
        <div className="border-t border-white/[0.06]" />
        <div className="flex flex-1 flex-col pt-4"><SidebarNav /></div>
        <SidebarUserCard onSignOut={handleSignOut} />
      </aside>

      <div className={`fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={closeMobile} aria-hidden="true" />
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[min(300px,90vw)] flex-col border-r border-white/[0.05] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden ${sidebarShell} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex min-h-[3.75rem] items-center justify-between gap-2 border-b border-white/[0.06] py-4 pl-6 pr-3">
          <SidebarBrandInline roleLabel="Team" />
          <button
            type="button"
            onClick={closeMobile}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[10px] p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-white active:scale-[0.98]"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto pt-4 pb-1">
          <SidebarNav onNavigate={closeMobile} />
        </div>
        <SidebarUserCard onSignOut={() => { handleSignOut(); closeMobile() }} />
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#070708]/85 shadow-[0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl backdrop-saturate-150">
          <div className="flex min-h-[4.5rem] items-center gap-4 px-5 py-4 max-lg:min-h-[4.75rem] sm:min-h-[4.25rem] sm:gap-5 sm:px-6 sm:py-3.5 lg:min-h-[4rem] lg:px-5 lg:py-3.5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] text-slate-500 transition hover:bg-white/[0.06] hover:text-white active:scale-[0.98] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-[23px] w-[23px]" strokeWidth={1.75} />
            </button>
            <div className="min-w-0 flex-1 py-0.5">
              <h1 className="truncate text-xl font-bold tracking-[-0.03em] text-white sm:text-[1.45rem] sm:leading-tight">{title}</h1>
              <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-slate-500 sm:mt-1 sm:text-[13px] lg:mt-0.5">{hint}</p>
            </div>
          </div>
        </header>

        <main className="relative w-full min-w-0 px-4 py-8 sm:px-6 sm:py-9 lg:px-6 lg:py-9 xl:px-8">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}
