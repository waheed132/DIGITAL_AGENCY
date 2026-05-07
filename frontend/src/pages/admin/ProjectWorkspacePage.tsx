import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { FileDown, FolderKanban, Layers, ListTodo, MessageSquareWarning, Receipt } from 'lucide-react'
import jsPDF from 'jspdf'
import { ApiError, apiRequest } from '../../lib/api'

type Project = {
  id: number
  name: string
  description: string | null
  status: string
  priority: string
  deadline: string | null
  services_plan_locked?: boolean
  client?: { id: number; name: string; company: string | null } | null
  members?: Array<{ id: number; name: string }>
}

type ServiceRow = {
  id: number
  name: string
  status: string
  planned_quantity: number
  unit_price: string
  period_label: string | null
  tasks_count: number
  tasks_done_count?: number
  deliverables_count: number
}

type TaskRow = {
  id: number
  service_id: number | null
  deliverable_id?: number | null
  workflow_step?: number | null
  title: string
  status: string
  priority: string
  deadline: string | null
  assignee?: { id: number; name: string } | null
}

type DeliverableRow = {
  id: number
  service_id: number
  title: string
  status: string
  status_label?: string
}

type TabId = 'overview' | 'services' | 'tasks' | 'approvals' | 'billing'

const TABS: Array<{ id: TabId; label: string; icon: typeof FolderKanban }> = [
  { id: 'overview', label: 'Overview', icon: FolderKanban },
  { id: 'services', label: 'Services', icon: Layers },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'approvals', label: 'Approvals', icon: MessageSquareWarning },
  { id: 'billing', label: 'Billing', icon: Receipt },
]

function dateLabel(iso: string | null | undefined): string {
  if (!iso) return 'No deadline'
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatPkr(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value
  return `PKR ${Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value}`
}

function statusClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'done' || s === 'approved' || s === 'active') return 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
  if (s === 'review' || s === 'submitted') return 'bg-amber-500/15 text-amber-200 ring-amber-500/30'
  if (s === 'revision' || s === 'pending') return 'bg-violet-500/15 text-violet-200 ring-violet-500/30'
  return 'bg-white/[0.05] text-slate-300 ring-white/[0.1]'
}

export function ProjectWorkspacePage() {
  const { id } = useParams()
  const projectId = Number(id)
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabId) || 'overview'

  const [project, setProject] = useState<Project | null>(null)
  const [services, setServices] = useState<ServiceRow[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(projectId) || projectId <= 0) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const [p, s, t, d] = await Promise.all([
        apiRequest<Project>(`/api/admin/projects/${projectId}`),
        apiRequest<ServiceRow[]>(`/api/admin/agency-services?project_id=${projectId}`),
        apiRequest<TaskRow[]>(`/api/admin/tasks?project_id=${projectId}`),
        apiRequest<DeliverableRow[]>(`/api/admin/deliverables?project_id=${projectId}`),
      ])
      setProject(p)
      setServices(s)
      setTasks(t)
      setDeliverables(d)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load project workflow')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const approvals = useMemo(() => tasks.filter((t) => t.status === 'review'), [tasks])

  const billingSummary = useMemo(() => {
    const approvedDeliverables = deliverables.filter((d) => d.status === 'approved').length
    const submittedDeliverables = deliverables.filter((d) => d.status === 'submitted').length
    const pendingDeliverables = deliverables.filter((d) => d.status === 'pending').length
    const completedTasks = tasks.filter((t) => t.status === 'done').length
    const reviewTasks = tasks.filter((t) => t.status === 'review').length
    return {
      approvedDeliverables,
      submittedDeliverables,
      pendingDeliverables,
      completedTasks,
      reviewTasks,
      billableUnits: approvedDeliverables,
    }
  }, [deliverables, tasks])

  const billingLines = useMemo(() => {
    return services.map((s) => {
      const plannedQty = Number(s.planned_quantity ?? 0)
      const completedQty = Math.min(plannedQty, Number(s.tasks_done_count ?? 0))
      const unitPrice = Number(s.unit_price ?? 0)
      const subtotal = completedQty * unitPrice
      return {
        id: s.id,
        name: s.name,
        period: s.period_label ?? '-',
        plannedQty,
        completedQty,
        unitPrice,
        subtotal,
      }
    })
  }, [services])

  const invoiceTotal = useMemo(() => billingLines.reduce((acc, l) => acc + l.subtotal, 0), [billingLines])

  const flowSteps = useMemo(() => {
    const serviceCount = services.length
    const memberCount = project?.members?.length ?? 0
    const totalTasks = tasks.length
    const workingTasks = tasks.filter((t) => ['doing', 'review', 'revision'].includes(t.status)).length
    const approvalCount = approvals.length
    const billableReady = invoiceTotal > 0

    const make = (
      id: TabId,
      label: string,
      description: string,
      status: 'todo' | 'in_progress' | 'done',
    ) => ({ id, label, description, status })

    return [
      make(
        'services',
        '1. Add Services',
        serviceCount > 0 ? `${serviceCount} service(s) configured` : 'Define service plan, quantity, and price',
        serviceCount > 0 ? 'done' : 'todo',
      ),
      make(
        'overview',
        '2. Assign Team',
        memberCount > 0 ? `${memberCount} member(s) assigned` : 'Assign project members',
        memberCount > 0 ? 'done' : serviceCount > 0 ? 'in_progress' : 'todo',
      ),
      make(
        'tasks',
        '3. Work In Progress',
        totalTasks > 0 ? `${workingTasks} active of ${totalTasks} task(s)` : 'Create/assign tasks for delivery',
        totalTasks > 0 ? (workingTasks > 0 ? 'in_progress' : 'done') : 'todo',
      ),
      make(
        'approvals',
        '4. Review & Approve',
        approvalCount > 0 ? `${approvalCount} task(s) waiting approval` : 'No approvals pending',
        approvalCount > 0 ? 'in_progress' : totalTasks > 0 ? 'done' : 'todo',
      ),
      make(
        'billing',
        '5. Generate Invoice',
        billableReady ? `Invoice ready · ${formatPkr(invoiceTotal)}` : 'Complete and approve billable work',
        billableReady ? 'done' : 'todo',
      ),
    ]
  }, [services.length, project?.members, tasks, approvals.length, invoiceTotal])

  function setTab(next: TabId) {
    const p = new URLSearchParams(params)
    p.set('tab', next)
    setParams(p, { replace: true })
  }

  async function finalizePlanAndGenerateTasks() {
    if (!project) return
    setActionBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await apiRequest<{ created_tasks: number; created_deliverables?: number; project?: Project }>(
        `/api/admin/projects/${project.id}/finalize-plan`,
        { method: 'POST', body: '{}' },
      )
      const d = res.created_deliverables ?? 0
      setMessage(`Plan finalized. ${d} deliverable(s); ${res.created_tasks} workflow task(s).`)
      await load()
      setTab('tasks')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not finalize plan')
    } finally {
      setActionBusy(false)
    }
  }

  function downloadBillingSummary() {
    if (!project) return
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const margin = 42
    const right = doc.internal.pageSize.getWidth() - margin
    let y = 52

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('V Agency Billing Summary', margin, y)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(project.name, margin, y + 20)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, right, y + 20, { align: 'right' })
    y += 44

    const rows: Array<[string, string]> = [
      ['Client', project.client?.name ?? 'No client'],
      ['Project status', project.status],
      ['Services', String(services.length)],
      ['Completed tasks', String(billingSummary.completedTasks)],
      ['Tasks in review', String(billingSummary.reviewTasks)],
      ['Approved deliverables', String(billingSummary.approvedDeliverables)],
      ['Submitted deliverables', String(billingSummary.submittedDeliverables)],
      ['Pending deliverables', String(billingSummary.pendingDeliverables)],
      ['Billable units (proxy)', String(billingSummary.billableUnits)],
      ['Total amount', formatPkr(invoiceTotal)],
    ]

    rows.forEach(([k, v]) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(k, margin, y)
      doc.setFont('helvetica', 'normal')
      doc.text(v, margin + 180, y)
      y += 18
    })

    y += 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Invoice lines', margin, y)
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    billingLines.forEach((l) => {
      const text = `${l.name}: ${l.completedQty} x ${formatPkr(l.unitPrice)} = ${formatPkr(l.subtotal)}`
      doc.text(text, margin, y)
      y += 14
    })

    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text('Note: Billing is project-scoped by design (no global billing module).', margin, y + 10)
    doc.save(`flowpilot-project-${project.id}-invoice-summary.pdf`)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-4 ring-1 ring-white/[0.04] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Project workflow</p>
            <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{project?.name ?? 'Project'}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {project?.client?.name ?? 'No client'} · Status {project?.status ?? '-'} · Deadline {dateLabel(project?.deadline)}
            </p>
          </div>
          <Link
            to="/admin/projects"
            className="rounded-xl border border-white/[0.12] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.06]"
          >
            Back to projects
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          {TABS.map(({ id: tid, label, icon: Icon }) => (
            <button
              key={tid}
              type="button"
              onClick={() => setTab(tid)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                tab === tid
                  ? 'bg-cyan-500/20 text-cyan-100 ring-cyan-500/35'
                  : 'bg-white/[0.03] text-slate-400 ring-white/[0.08] hover:bg-white/[0.06]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-cyan-500/15 bg-cyan-950/10 p-4 ring-1 ring-cyan-500/10 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-cyan-100">Guided project flow</h3>
          <p className="text-xs text-slate-400">Follow this order to keep delivery and billing accurate.</p>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {flowSteps.map((step) => (
            <li key={step.label} className="rounded-xl border border-white/[0.07] bg-[#0b1324]/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-white">{step.label}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                    step.status === 'done'
                      ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
                      : step.status === 'in_progress'
                        ? 'bg-amber-500/15 text-amber-200 ring-amber-500/30'
                        : 'bg-white/[0.04] text-slate-300 ring-white/[0.1]'
                  }`}
                >
                  {step.status === 'done' ? 'Done' : step.status === 'in_progress' ? 'In progress' : 'Todo'}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{step.description}</p>
              <button
                type="button"
                onClick={() => setTab(step.id)}
                className="mt-2 inline-flex rounded-lg border border-white/[0.12] px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/[0.05]"
              >
                Open
              </button>
            </li>
          ))}
        </ul>
      </section>

      {loading ? <p className="text-sm text-slate-500">Loading project workflow…</p> : null}
      {error ? <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p> : null}
      {message ? <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{message}</p> : null}

      {!loading && !error ? (
        <>
          {tab === 'overview' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Services" value={String(services.length)} />
              <MetricCard label="Tasks" value={String(tasks.length)} />
              <MetricCard label="Approvals waiting" value={String(approvals.length)} />
              <MetricCard label="Deliverables" value={String(deliverables.length)} />
            </div>
          ) : null}

          {tab === 'services' ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 ring-1 ring-white/[0.04]">
              <div className="border-b border-white/[0.06] px-4 py-3">
                <h3 className="text-sm font-semibold text-white">Services plan & progress</h3>
                <p className="mt-0.5 text-xs text-slate-500">Admin sets quantity/price once; system tracks approved completion automatically.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={actionBusy || services.length === 0}
                    onClick={() => void finalizePlanAndGenerateTasks()}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {project?.services_plan_locked ? 'Re-sync plan tasks' : 'Finalize plan'}
                  </button>
                  <p className="text-[11px] text-slate-500">
                    {project?.services_plan_locked
                      ? 'Plan already finalized. You can re-sync missing tasks safely.'
                      : 'Finalizing locks proposal intent and generates missing tasks from quantities.'}
                  </p>
                </div>
              </div>
              {billingLines.length === 0 ? (
                <p className="px-4 py-10 text-sm text-slate-500">No services yet.</p>
              ) : (
                <ul className="divide-y divide-white/[0.06]">
                  {billingLines.map((l) => {
                    const pct = l.plannedQty > 0 ? Math.min(100, Math.round((l.completedQty / l.plannedQty) * 100)) : 0
                    return (
                      <li key={l.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{l.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {l.period} · Price {formatPkr(l.unitPrice)} each
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${statusClass(l.completedQty > 0 ? 'active' : 'pending')}`}>
                            {l.completedQty}/{l.plannedQty}
                          </span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-emerald-400/85 transition-all"
                            style={{ width: `${pct}%` }}
                            aria-label={`${l.name} progress ${pct}%`}
                          />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>Completed {l.completedQty} / Planned {l.plannedQty}</span>
                          <span>{pct}%</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {tab === 'tasks' ? (
            <DataList
              title="Tasks"
              empty="No tasks yet."
              rows={tasks.map((t) => ({
                title: t.title,
                sub: `${t.assignee?.name ?? 'Unassigned'} · ${t.priority} · ${dateLabel(t.deadline)}`,
                badge: t.status,
              }))}
            />
          ) : null}

          {tab === 'approvals' ? (
            <DataList
              title="Approvals queue"
              empty="No tasks waiting for approval."
              rows={approvals.map((t) => ({
                title: t.title,
                sub: `${t.assignee?.name ?? 'Unassigned'} · ${t.priority} · ${dateLabel(t.deadline)}`,
                badge: t.status,
              }))}
            />
          ) : null}

          {tab === 'billing' ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard label="Billable units" value={String(billingSummary.billableUnits)} />
                <MetricCard label="Approved deliverables" value={String(billingSummary.approvedDeliverables)} />
                <MetricCard label="Total bill" value={formatPkr(invoiceTotal)} />
              </div>
              <DataList
                title="Billing lines"
                empty="No billable services yet."
                rows={billingLines.map((l) => ({
                  title: `${l.name} · ${formatPkr(l.subtotal)}`,
                  sub: `Completed ${l.completedQty}/${l.plannedQty} · ${formatPkr(l.unitPrice)} each · ${l.period}`,
                  badge: l.completedQty > 0 ? 'billable' : 'waiting',
                }))}
              />
              <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-4 ring-1 ring-white/[0.04]">
                <h3 className="text-sm font-semibold text-white">Project billing</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Billing is project-scoped. Amount is auto-calculated from each service: completed approved units × service unit price.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={downloadBillingSummary}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-slate-200 hover:bg-white/[0.06]"
                  >
                    <FileDown className="h-4 w-4" />
                    Download invoice summary
                  </button>
                  <p className="text-xs text-slate-500">Define price and planned quantity on Services to keep this invoice accurate.</p>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-4 ring-1 ring-white/[0.04]">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  )
}

function DataList({
  title,
  empty,
  rows,
}: {
  title: string
  empty: string
  rows: Array<{ title: string; sub: string; badge: string }>
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 ring-1 ring-white/[0.04]">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          {rows.map((r, idx) => (
            <li key={`${r.title}-${idx}`} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{r.title}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{r.sub}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${statusClass(r.badge)}`}>
                {r.badge}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
