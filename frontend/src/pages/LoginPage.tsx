import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { login, user, ready } = useAuth()
  const navigate = useNavigate()
  const [loginField, setLoginField] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (ready && user) {
      navigate(
        user.role === 'admin' ? '/admin/dashboard' : user.role === 'client' ? '/client/dashboard' : '/team',
        {
        replace: true,
        },
      )
    }
  }, [ready, user, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const u = await login(loginField, password)
      navigate(
        u.role === 'admin' ? '/admin/dashboard' : u.role === 'client' ? '/client/dashboard' : '/team',
        {
        replace: true,
        },
      )
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error && err.message.trim()
            ? err.message
            : null
      setError(msg ?? 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060b18] px-4 py-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{ background: 'radial-gradient(ellipse 75% 65% at 50% 0%, rgba(16,185,129,0.10), transparent 65%)' }}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.10] bg-[#0b1324]/90 p-6 shadow-[0_24px_90px_rgba(2,8,20,0.72)] backdrop-blur-xl sm:p-8">
        <h1 className="text-center text-3xl font-semibold tracking-[-0.03em] text-white">
          FlowPilot
        </h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          Sign in to continue
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="login"
              className="block text-xs font-medium text-slate-400"
            >
              Username or email
            </label>
            <input
              id="login"
              name="login"
              autoComplete="username"
              placeholder="Enter username or email"
              className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-950/75 px-3.5 py-2.5 text-sm text-white outline-none ring-emerald-500/40 transition placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-2"
              value={loginField}
              onChange={(e) => setLoginField(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-slate-400"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter password"
              className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-950/75 px-3.5 py-2.5 text-sm text-white outline-none ring-emerald-500/40 transition placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/35 transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-600">
          <Link to="/" className="text-slate-500 hover:text-slate-400">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
