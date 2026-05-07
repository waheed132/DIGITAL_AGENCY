import { Link } from 'react-router-dom'
import { ArrowLeft, Construction } from 'lucide-react'

type Props = {
  title: string
  description: string
}

export function AdminSectionPlaceholder({ title, description }: Props) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-8 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <Construction className="h-7 w-7 text-emerald-400/90" strokeWidth={1.5} />
        </div>
        <h2 className="mt-6 text-xl font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {description}
        </p>
        <Link
          to="/admin/dashboard"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
