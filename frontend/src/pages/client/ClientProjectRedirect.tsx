import { Navigate } from 'react-router-dom'
import { useClientPortal } from '../../context/ClientPortalContext'

export function ClientProjectRedirect() {
  const { dashboard, loading, error } = useClientPortal()

  if (loading && !error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Loading project…
      </div>
    )
  }

  const id = dashboard?.primary_project?.id
  if (id == null) {
    return <Navigate to="/client/dashboard" replace />
  }

  return <Navigate to={`/client/projects/${id}`} replace />
}
