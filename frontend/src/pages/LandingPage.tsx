import { Link } from 'react-router-dom'

const features = [
  {
    title: 'Client Work Kits',
    description:
      'Keep logos, colors, contacts, and files ready for every task.',
  },
  {
    title: 'Project & Service Planning',
    description:
      'Build monthly plans with posts, videos, animations, and billable units.',
  },
  {
    title: 'Team Task Workflow',
    description:
      'Assign work, track progress, review submissions, and request revisions.',
  },
  {
    title: 'Billing & Invoices',
    description: 'Generate professional invoices from completed work.',
  },
] as const

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-fp-surface text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(52,211,153,0.14),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(52,211,153,0.06),transparent)]"
        aria-hidden
      />

      <header className="relative border-b border-white/[0.06] bg-fp-surface/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-lg font-semibold tracking-tight text-white">
              FlowPilot
            </span>
            <span className="text-xs font-medium text-slate-500 sm:text-sm">
              Agency CRM
            </span>
          </div>
          <Link
            to="/login"
            className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-slate-950 shadow-md shadow-emerald-500/15 transition-colors hover:bg-emerald-400 sm:px-5 sm:py-2"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pt-16 lg:px-8 lg:pt-24">
        <section className="mx-auto max-w-3xl text-center lg:max-w-4xl">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.08] lg:text-6xl">
            Run your agency without chaos.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-slate-400 sm:text-lg">
            Manage clients, projects, team tasks, approvals, assets, and
            invoices from one clean workspace.
          </p>
          <div className="mt-10 flex flex-col items-stretch gap-4 sm:items-center">
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-8 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 sm:w-auto sm:min-w-[11rem]"
            >
              Sign in
            </Link>
            <p className="text-sm text-slate-500">
              Built for agencies, creators, and service teams.
            </p>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-5xl lg:mt-28">
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
            {features.map(({ title, description }) => (
              <li key={title}>
                <article className="flex h-full flex-col rounded-2xl bg-white/[0.03] p-6 shadow-sm shadow-black/20 ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.045] hover:ring-emerald-400/15">
                  <h2 className="text-base font-semibold tracking-tight text-white">
                    {title}
                  </h2>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">
                    {description}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
