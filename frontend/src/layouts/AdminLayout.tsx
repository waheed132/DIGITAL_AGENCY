import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  ListTodo,
  UserCog,
  Menu,
  X,
  ClipboardList,
  Inbox,
  Layers,
  Package,
  MessageSquareWarning,
  Activity as ActivityIcon,
  CalendarDays,
  FolderOpen,
  Gauge,
  Receipt,
} from 'lucide-react'
import { SidebarBrandHeader, SidebarBrandInline } from '../components/SidebarBrandHeader'
import { SidebarUserCard } from '../components/SidebarUserCard'
import { useAuth } from '../context/AuthContext'

type Tone = 'sky' | 'violet' | 'amber' | 'emerald' | 'cyan'

/** Section label + tone for the left accent bar only */
const toneLabel: Record<Tone, string> = {
  sky: 'text-slate-500',
  violet: 'text-slate-500',
  amber: 'text-slate-500',
  emerald: 'text-slate-500',
  cyan: 'text-slate-500',
}

const toneBar: Record<Tone, string> = {
  sky: 'bg-sky-500/75',
  violet: 'bg-violet-500/80',
  amber: 'bg-amber-500/75',
  emerald: 'bg-emerald-500/75',
  cyan: 'bg-cyan-500/75',
}

type NavIcon = typeof LayoutDashboard

/** Inactive hierarchy: process = temporary flows; anchor = main CRM surface; core = primary work engine */
type NavItem = {
  to: string
  label: string
  icon: NavIcon
  end?: boolean
  /** Tasks — strongest guidance toward daily execution */
  emphasize?: boolean
  /** Intake / queue = lighter; Clients directory = anchor */
  visualWeight?: 'process' | 'anchor' | 'standard'
}

const dashboardItem: NavItem = {
  to: '/admin/dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
  end: true,
}

const navGroups: ReadonlyArray<{
  id: string
  label: string
  tone: Tone
  items: readonly NavItem[]
}> = [
  {
    id: 'clients',
    label: 'Clients',
    tone: 'sky',
    items: [
      { to: '/admin/client-intake', label: 'Intake', icon: ClipboardList, end: true, visualWeight: 'process' },
      { to: '/admin/client-intakes', label: 'Intake queue', icon: Inbox, end: true, visualWeight: 'process' },
      { to: '/admin/clients', label: 'Clients', icon: Users, visualWeight: 'anchor' },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    tone: 'violet',
    items: [
      { to: '/admin/projects', label: 'Projects', icon: FolderKanban },
      { to: '/admin/services', label: 'Services', icon: Layers },
      { to: '/admin/tasks', label: 'Tasks', icon: ListTodo, emphasize: true },
      { to: '/admin/deliverables', label: 'Deliverables', icon: Package },
      { to: '/admin/assets', label: 'Assets', icon: FolderOpen, end: true },
    ],
  },
  {
    id: 'approvals',
    label: 'Approvals',
    tone: 'amber',
    items: [
      { to: '/admin/approvals', label: 'Approvals', icon: MessageSquareWarning, end: true },
      { to: '/admin/activity', label: 'Activity', icon: ActivityIcon, end: true },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    tone: 'emerald',
    items: [
      { to: '/admin/team', label: 'Team', icon: UserCog, end: true },
      { to: '/admin/workload', label: 'Workload', icon: Gauge, end: true },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    tone: 'cyan',
    items: [
      { to: '/admin/schedule', label: 'Schedule', icon: CalendarDays, end: true },
      { to: '/admin/expenses', label: 'Expenses', icon: Receipt, end: true },
    ],
  },
]

/** Single stroke for every Lucide icon in chrome — premium consistency */
const ICON_STROKE = 1.75 as const

const activeNav =
  'bg-white/[0.04] font-medium text-white ring-1 ring-white/[0.055] shadow-none'

function titleFromPath(pathname: string): { title: string; hint: string } {
  const map: Array<{ prefix: string; title: string; hint: string }> = [
    { prefix: '/admin/client-intakes', title: 'Intake queue', hint: 'Review and approve new client intakes' },
    { prefix: '/admin/client-intake', title: 'Client intake', hint: 'Structured onboarding for new relationships' },
    { prefix: '/admin/clients', title: 'Clients', hint: 'Accounts, contacts, and history' },
    { prefix: '/admin/projects', title: 'Projects', hint: 'Engagements and timelines' },
    { prefix: '/admin/services', title: 'Services', hint: 'Workstreams inside each project—social, web, ads, etc.' },
    { prefix: '/admin/tasks', title: 'Tasks', hint: 'Execution work tied to projects and services' },
    { prefix: '/admin/deliverables', title: 'Deliverables', hint: 'What you ship to the client—outputs and links' },
    { prefix: '/admin/approvals', title: 'Approvals', hint: 'Team submissions waiting for your review' },
    { prefix: '/admin/activity', title: 'Activity', hint: 'Timeline of important changes' },
    { prefix: '/admin/team', title: 'Team', hint: 'People, roles, and access' },
    { prefix: '/admin/workload', title: 'Workload', hint: 'Open work and capacity by teammate' },
    { prefix: '/admin/expenses', title: 'Expenses', hint: 'Office bills, rent, and utilities in PKR' },
    { prefix: '/admin/schedule', title: 'Schedule', hint: 'Deadlines and time windows' },
    { prefix: '/admin/calendar', title: 'Schedule', hint: 'Deadlines and time windows' },
    { prefix: '/admin/assets', title: 'Assets', hint: 'Files uploaded across tasks' },
    { prefix: '/admin/dashboard', title: 'Dashboard', hint: 'Agency pulse at a glance' },
  ]
  for (const m of map) {
    if (pathname === m.prefix || pathname.startsWith(m.prefix + '/')) {
      return { title: m.title, hint: m.hint }
    }
  }
  return { title: 'Dashboard', hint: 'Agency pulse at a glance' }
}

function inactiveRowClasses(item: NavItem): string {
  const w = item.visualWeight ?? 'standard'
  if (item.emphasize) {
    return 'font-semibold text-slate-200/95 hover:bg-white/[0.05] hover:text-white'
  }
  if (w === 'process') {
    return 'font-normal text-slate-500/90 hover:bg-white/[0.025] hover:text-slate-400'
  }
  if (w === 'anchor') {
    return 'font-medium text-slate-300 hover:bg-white/[0.04] hover:text-slate-100'
  }
  return 'font-medium text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
}

function inactiveIconClasses(item: NavItem): string {
  const w = item.visualWeight ?? 'standard'
  if (item.emphasize) {
    return 'text-violet-200/95 group-hover:text-violet-100'
  }
  if (w === 'process') {
    return 'text-slate-600/85 opacity-[0.92] group-hover:text-slate-500'
  }
  if (w === 'anchor') {
    return 'text-sky-400/80 group-hover:text-sky-300/90'
  }
  return 'text-slate-500 group-hover:text-slate-400'
}

function NavRow({
  item,
  tone,
  onNavigate,
}: {
  item: NavItem
  tone: Tone
  onNavigate?: () => void
}) {
  const t = toneBar[tone]
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] transition-[color,background-color,box-shadow] duration-150',
          item.emphasize ? 'py-[0.65rem]' : '',
          isActive ? activeNav : inactiveRowClasses(item),
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`absolute left-0 top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-full transition-opacity ${
              isActive ? `${t} opacity-[0.85]` : 'opacity-0'
            }`}
            aria-hidden
          />
          <Icon
            className={`h-[18px] w-[18px] shrink-0 transition-colors ${
              isActive ? 'text-white/[0.92]' : inactiveIconClasses(item)
            }`}
            strokeWidth={ICON_STROKE}
          />
          <span className={item.emphasize ? 'leading-none tracking-tight' : 'leading-none'}>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

function DashboardRow({ onNavigate }: { onNavigate?: () => void }) {
  const Icon = dashboardItem.icon
  return (
    <NavLink
      to={dashboardItem.to}
      end={dashboardItem.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'group relative mb-0.5 flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] transition-[color,background-color,box-shadow] duration-150',
          isActive ? activeNav : 'font-medium text-slate-500 hover:bg-white/[0.03] hover:text-slate-300',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`absolute left-0 top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-full bg-slate-500/70 transition-opacity ${
              isActive ? 'opacity-[0.85]' : 'opacity-0'
            }`}
            aria-hidden
          />
          <Icon
            className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-white/[0.92]' : 'text-slate-500 group-hover:text-slate-400'}`}
            strokeWidth={ICON_STROKE}
          />
          <span className="leading-none">{dashboardItem.label}</span>
        </>
      )}
    </NavLink>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col px-3 pb-6" aria-label="Main">
      <DashboardRow onNavigate={onNavigate} />

      <div className="my-4 border-t border-white/[0.045] pt-1" role="separator" />

      {navGroups.map((group, idx) => {
        const labelClass = toneLabel[group.tone]
        return (
          <div key={group.id}>
            {idx > 0 ? (
              <div className="my-4 border-t border-white/[0.045] pt-1" role="separator" aria-hidden />
            ) : null}
            <p className={`mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] ${labelClass}`}>
              {group.label}
            </p>
            <div className="flex flex-col gap-px">
              {group.items.map((item) => (
                <NavRow key={item.to} item={item} tone={group.tone} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function SidebarScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(false)

  const updateFades = useCallback(() => {
    const el = ref.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const max = scrollHeight - clientHeight
    setShowTopFade(scrollTop > 6)
    setShowBottomFade(max > 8 && scrollTop < max - 6)
  }, [])

  useEffect(() => {
    const el = ref.current
    updateFades()
    const ro = new ResizeObserver(() => updateFades())
    if (el) ro.observe(el)
    window.addEventListener('resize', updateFades)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateFades)
    }
  }, [updateFades])

  return (
    <div className="relative min-h-0 flex-1">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-9 bg-gradient-to-b from-[#0c0c0e] via-[#0c0c0e]/80 to-transparent transition-opacity duration-200 ${
          showTopFade ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden
      />
      <div
        ref={ref}
        onScroll={updateFades}
        className="h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pt-3"
      >
        {children}
      </div>
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-11 bg-gradient-to-t from-[#0c0c0e] via-[#0c0c0e]/85 to-transparent transition-opacity duration-200 ${
          showBottomFade ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden
      />
    </div>
  )
}

const sidebarShell =
  'admin-sidebar flex h-full flex-col bg-[#0c0c0e] text-slate-200 antialiased'

export function AdminLayout({ children }: { children?: ReactNode }) {
  const { logout } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { title, hint } = titleFromPath(location.pathname)

  const closeMobile = () => setMobileOpen(false)
  const handleSignOut = () => void logout()

  return (
    <div className="min-h-screen bg-[#070708] text-slate-200">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.35]"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 0% 0%, rgba(52, 211, 153, 0.06), transparent 55%)',
        }}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col border-r border-white/[0.05] shadow-[4px_0_24px_rgba(0,0,0,0.35)] lg:flex ${sidebarShell}`}
      >
        <SidebarBrandHeader roleLabel="Admin" />
        <div className="border-t border-white/[0.06]" />
        <SidebarScroll>
          <SidebarNav />
        </SidebarScroll>
        <SidebarUserCard onSignOut={handleSignOut} />
      </aside>

      <div
        className={`fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeMobile}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(288px,88vw)] flex-col border-r border-white/[0.05] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden ${sidebarShell} ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] py-3.5 pl-6 pr-3">
          <SidebarBrandInline roleLabel="Admin" />
          <button
            type="button"
            onClick={closeMobile}
            className="rounded-[10px] p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" strokeWidth={ICON_STROKE} />
          </button>
        </div>
        <SidebarScroll>
          <SidebarNav onNavigate={closeMobile} />
        </SidebarScroll>
        <SidebarUserCard onSignOut={() => { handleSignOut(); closeMobile() }} />
      </aside>

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#070708]/85 backdrop-blur-xl backdrop-saturate-150">
          <div className="flex h-14 items-center gap-3 px-4 sm:h-[3.75rem] sm:px-6 lg:px-5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-[10px] p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" strokeWidth={ICON_STROKE} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold tracking-[-0.03em] text-white sm:text-[1.35rem]">{title}</h1>
              <p className="hidden text-[13px] text-slate-500 sm:block">{hint}</p>
            </div>
          </div>
        </header>

        <main className="relative px-4 py-6 sm:px-6 lg:px-5 lg:py-8">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}
