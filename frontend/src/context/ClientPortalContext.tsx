import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiRequest } from '../lib/api'
import type { ClientDashboardPayload } from '../lib/clientPortal'

type ClientPortalState = {
  dashboard: ClientDashboardPayload | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const ClientPortalContext = createContext<ClientPortalState | null>(null)

export function ClientPortalProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<ClientDashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await apiRequest<ClientDashboardPayload>('/api/client/dashboard')
      setDashboard(d)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not load dashboard'
      setDashboard(null)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ dashboard, loading, error, refresh }),
    [dashboard, loading, error, refresh],
  )

  return <ClientPortalContext.Provider value={value}>{children}</ClientPortalContext.Provider>
}

export function useClientPortal(): ClientPortalState {
  const ctx = useContext(ClientPortalContext)
  if (!ctx) {
    throw new Error('useClientPortal must be used within ClientPortalProvider')
  }
  return ctx
}
