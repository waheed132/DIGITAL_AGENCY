export type ApiUser = {
  id: number
  name: string
  email: string
  username: string
  role: 'admin' | 'employee' | 'client'
  is_active: boolean
}

const TOKEN_KEY = 'flowpilot_token'
const USER_SNAPSHOT_KEY = 'flowpilot_user_snapshot'

/** Backend origin only — no trailing slash, no `/api` suffix (paths already include `/api/...`). */
function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (trimmed.endsWith('/api')) {
    return trimmed.slice(0, -4).replace(/\/+$/, '')
  }
  return trimmed
}

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
)

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  const normalizedBase = API_BASE_URL
  const trimmedPath = path.trim()
  let normalizedPath: string

  if (trimmedPath.startsWith('/api')) {
    normalizedPath = trimmedPath
  } else if (trimmedPath.startsWith('api/')) {
    normalizedPath = `/${trimmedPath}`
  } else if (trimmedPath.startsWith('/')) {
    normalizedPath = `/api${trimmedPath}`
  } else {
    normalizedPath = `/api/${trimmedPath}`
  }

  // Guard against accidental double-prefixing like /api/api/auth/login
  normalizedPath = normalizedPath.replace(/^\/api\/api\//, '/api/')

  const finalUrl = `${normalizedBase}${normalizedPath}`
  if (import.meta.env.DEV) {
    console.log('API REQUEST:', finalUrl)
  }
  return finalUrl
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
    setStoredUserSnapshot(null)
  }
}

/**
 * Last known user (sessionStorage). Used to paint the shell immediately after refresh;
 * /api/auth/user still runs right after to revalidate.
 */
export function getStoredUserSnapshot(): ApiUser | null {
  try {
    const raw = sessionStorage.getItem(USER_SNAPSHOT_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as ApiUser
    if (typeof u?.id !== 'number' || typeof u?.role !== 'string') return null
    return u
  } catch {
    return null
  }
}

export function setStoredUserSnapshot(user: ApiUser | null): void {
  if (!user) {
    sessionStorage.removeItem(USER_SNAPSHOT_KEY)
    return
  }
  try {
    sessionStorage.setItem(USER_SNAPSHOT_KEY, JSON.stringify(user))
  } catch {
    // ignore quota / private mode
  }
}

type ApiErrorBody = {
  message?: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  status: number
  body: ApiErrorBody | null

  constructor(message: string, status: number, body: ApiErrorBody | null) {
    super(message)
    this.status = status
    this.body = body
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (
    options.body !== undefined &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getStoredToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(buildApiUrl(path), { ...options, headers })
  const data = (await res.json().catch(() => null)) as T | ApiErrorBody | null

  if (res.status === 401) {
    setStoredToken(null)
  }

  if (!res.ok) {
    const errBody = data as ApiErrorBody | null
    let msg =
      errBody?.message ||
      `Request failed (${res.status})`
    if (errBody?.errors) {
      const first = Object.values(errBody.errors)[0]?.[0]
      if (first) {
        msg = first
      }
    }
    throw new ApiError(msg, res.status, errBody)
  }

  return data as T
}

export async function fetchProtectedBlob(path: string): Promise<Blob> {
  const headers = new Headers()
  headers.set('Accept', '*/*')
  const token = getStoredToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const res = await fetch(buildApiUrl(path), { headers })
  if (!res.ok) {
    throw new ApiError(`Could not load file (${res.status})`, res.status, null)
  }
  return res.blob()
}

export async function openProtectedFile(path: string): Promise<void> {
  const blob = await fetchProtectedBlob(path)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export async function downloadProtectedFile(path: string, filename: string): Promise<void> {
  const blob = await fetchProtectedBlob(path)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'attachment'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}
