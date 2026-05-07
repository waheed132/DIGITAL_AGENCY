import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ClientPortalProvider } from './context/ClientPortalContext'
import { RouteFallback } from './components/RouteFallback'

const AdminLayout = lazy(() =>
  import('./layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })),
)
const TeamLayout = lazy(() =>
  import('./layouts/TeamLayout').then((m) => ({ default: m.TeamLayout })),
)
const ClientLayout = lazy(() =>
  import('./layouts/ClientLayout').then((m) => ({ default: m.ClientLayout })),
)

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })),
)
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const ClientIntakePage = lazy(() =>
  import('./pages/admin/ClientIntakePage').then((m) => ({ default: m.ClientIntakePage })),
)

const DashboardPage = lazy(() =>
  import('./pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const ClientsPage = lazy(() =>
  import('./pages/admin/ClientsPage').then((m) => ({ default: m.ClientsPage })),
)
const ClientIntakesQueuePage = lazy(() =>
  import('./pages/admin/ClientIntakesQueuePage').then((m) => ({ default: m.ClientIntakesQueuePage })),
)
const ProjectsPage = lazy(() =>
  import('./pages/admin/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
)
const ProjectWorkspacePage = lazy(() =>
  import('./pages/admin/ProjectWorkspacePage').then((m) => ({ default: m.ProjectWorkspacePage })),
)
const ServicesPage = lazy(() =>
  import('./pages/admin/ServicesPage').then((m) => ({ default: m.ServicesPage })),
)
const TasksPage = lazy(() => import('./pages/admin/TasksPage').then((m) => ({ default: m.TasksPage })))
const DeliverablesPage = lazy(() =>
  import('./pages/admin/DeliverablesPage').then((m) => ({ default: m.DeliverablesPage })),
)
const ApprovalsPage = lazy(() =>
  import('./pages/admin/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })),
)
const ActivityPage = lazy(() =>
  import('./pages/admin/ActivityPage').then((m) => ({ default: m.ActivityPage })),
)
const TeamPage = lazy(() => import('./pages/admin/TeamPage').then((m) => ({ default: m.TeamPage })))
const WorkloadPage = lazy(() =>
  import('./pages/admin/WorkloadPage').then((m) => ({ default: m.WorkloadPage })),
)
const CalendarPage = lazy(() =>
  import('./pages/admin/CalendarPage').then((m) => ({ default: m.CalendarPage })),
)
const AssetsPage = lazy(() => import('./pages/admin/AssetsPage').then((m) => ({ default: m.AssetsPage })))
const ExpensesPage = lazy(() =>
  import('./pages/admin/ExpensesPage').then((m) => ({ default: m.ExpensesPage })),
)

const TeamDashboardPage = lazy(() =>
  import('./pages/team/TeamDashboardPage').then((m) => ({ default: m.TeamDashboardPage })),
)
const TeamTasksPage = lazy(() =>
  import('./pages/team/TeamTasksPage').then((m) => ({ default: m.TeamTasksPage })),
)
const TeamProjectsPage = lazy(() =>
  import('./pages/team/TeamProjectsPage').then((m) => ({ default: m.TeamProjectsPage })),
)
const TeamAnalyticsPage = lazy(() =>
  import('./pages/team/TeamAnalyticsPage').then((m) => ({ default: m.TeamAnalyticsPage })),
)
const TeamSettingsPage = lazy(() =>
  import('./pages/team/TeamSettingsPage').then((m) => ({ default: m.TeamSettingsPage })),
)
const ClientDashboardPage = lazy(() =>
  import('./pages/client/ClientDashboardPage').then((m) => ({ default: m.ClientDashboardPage })),
)
const ClientProjectPage = lazy(() =>
  import('./pages/client/ClientProjectPage').then((m) => ({ default: m.ClientProjectPage })),
)
const ClientNotificationsPage = lazy(() =>
  import('./pages/client/ClientNotificationsPage').then((m) => ({ default: m.ClientNotificationsPage })),
)
const ClientProjectRedirect = lazy(() =>
  import('./pages/client/ClientProjectRedirect').then((m) => ({ default: m.ClientProjectRedirect })),
)

function ProtectedAdmin({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b14] font-sans text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
          <span className="text-sm">Loading workspace…</span>
        </div>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.role !== 'admin') {
    return <Navigate to="/team" replace />
  }
  return <>{children}</>
}

function ProtectedTeam({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b14] font-sans text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />
  }
  if (user.role === 'client') {
    return <Navigate to="/client/dashboard" replace />
  }
  return <>{children}</>
}

function ProtectedClient({ children }: { children?: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070708] font-sans text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />
  }
  if (user.role === 'employee') {
    return <Navigate to="/team/dashboard" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/intake/:token" element={<ClientIntakePage />} />
      <Route
        path="/admin"
        element={
          <ProtectedAdmin>
            <AdminLayout />
          </ProtectedAdmin>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="client-intake" element={<ClientIntakePage />} />
        <Route path="client-intakes" element={<ClientIntakesQueuePage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectWorkspacePage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="deliverables" element={<DeliverablesPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="workload" element={<WorkloadPage />} />
        <Route path="schedule" element={<CalendarPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="calendar" element={<Navigate to="/admin/schedule" replace />} />
        <Route path="assets" element={<AssetsPage />} />
      </Route>
      <Route
        path="/team"
        element={
          <ProtectedTeam>
            <TeamLayout />
          </ProtectedTeam>
        }
      >
        <Route index element={<Navigate to="/team/dashboard" replace />} />
        <Route path="dashboard" element={<TeamDashboardPage />} />
        <Route path="tasks" element={<TeamTasksPage />} />
        <Route path="projects" element={<TeamProjectsPage />} />
        <Route path="analytics" element={<TeamAnalyticsPage />} />
        <Route path="settings" element={<TeamSettingsPage />} />
      </Route>
      <Route
        path="/client"
        element={
          <ProtectedClient>
            <ClientPortalProvider>
              <ClientLayout />
            </ClientPortalProvider>
          </ProtectedClient>
        }
      >
        <Route index element={<Navigate to="/client/dashboard" replace />} />
        <Route path="dashboard" element={<ClientDashboardPage />} />
        <Route path="project" element={<ClientProjectRedirect />} />
        <Route path="projects/:id" element={<ClientProjectPage />} />
        <Route path="notifications" element={<ClientNotificationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<RouteFallback />}>
        <AppRoutes />
      </Suspense>
    </AuthProvider>
  )
}
