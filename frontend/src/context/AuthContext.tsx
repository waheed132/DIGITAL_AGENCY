import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  apiRequest,
  getStoredToken,
  getStoredUserSnapshot,
  setStoredToken,
  setStoredUserSnapshot,
  type ApiUser,
} from '../lib/api'

type AuthState = {
  user: ApiUser | null
  token: string | null
  ready: boolean
  login: (login: string, password: string) => Promise<ApiUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const t = getStoredToken()
    if (!t) {
      setReady(true)
      return
    }
    const snap = getStoredUserSnapshot()
    if (snap) {
      setUser(snap)
      setToken(t)
      setReady(true)
    }
    void (async () => {
      try {
        const u = await apiRequest<ApiUser>('/api/auth/user')
        if (!cancelled) {
          setUser(u)
          setStoredUserSnapshot(u)
          setToken(t)
        }
      } catch {
        if (!cancelled) {
          setStoredToken(null)
          setUser(null)
          setToken(null)
        }
      } finally {
        if (!cancelled && !snap) {
          setReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (loginField: string, password: string) => {
    const res = await apiRequest<{ token: string; user: ApiUser }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ login: loginField, password }),
      },
    )
    setStoredToken(res.token)
    setStoredUserSnapshot(res.user)
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
    } catch {
      // still clear local session
    }
    setStoredToken(null)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, token, ready, login, logout }),
    [user, token, ready, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
