import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-tight text-white">
              FlowPilot
            </span>
            <span className="hidden text-sm text-slate-500 sm:inline">
              Agency CRM
            </span>
          </div>
          <Link
            to="/login"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wider text-emerald-400/90">
          Environment ready
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          React · Laravel · MySQL
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
          Stack is wired: Sanctum token auth, admin API routes, and team task
          endpoints. Use{' '}
          <Link to="/login" className="text-emerald-400 hover:underline">
            Sign in
          </Link>{' '}
          to open the admin console or employee workspace.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {[
            'Clients, projects, tasks, employees',
            'Admin console + team workspace',
            'Activity and performance tracking (next)',
          ].map((item) => (
            <li
              key={item}
              className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300"
            >
              {item}
            </li>
          ))}
        </ul>

        <p className="mt-10 text-sm text-slate-500">
          Run{' '}
          <code className="rounded bg-slate-900 px-1.5 py-0.5 text-slate-300">
            npm run dev
          </code>{' '}
          in <code className="text-slate-400">frontend/</code> and{' '}
          <code className="text-slate-400">php artisan serve</code> in{' '}
          <code className="text-slate-400">backend/</code>.
        </p>
      </main>
    </div>
  )
}
