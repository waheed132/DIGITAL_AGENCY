import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Download, Layers, ListOrdered, Loader2, Mail, Pencil, Plus, Receipt, Trash2, X } from 'lucide-react'
import { ApiError, apiRequest, downloadProtectedFile, openProtectedFile } from '../../lib/api'

type ProjectOpt = {
  id: number
  name: string
  services_plan_locked?: boolean
  members?: Array<{ id: number; name: string; role?: string }>
}
type ServiceInvoiceRow = {
  id: number
  invoice_number: string | null
  status: string
  status_display: string
  amount: string
  currency: string
  has_pdf: boolean
  due_date?: string | null
}

type ServiceRow = {
  id: number
  project_id: number
  name: string
  planned_quantity: number
  unit_price: string
  period_label: string | null
  description: string | null
  status: string
  sort_order: number
  tasks_count: number
  tasks_done_count?: number
  deliverables_completed_count?: number
  workflow_tasks_count?: number
  workflow_tasks_done_count?: number
  tasks_unassigned_count?: number
  deliverables_count: number
  invoice?: ServiceInvoiceRow | null
  project?: { id: number; name: string; client: { id: number; name: string } | null } | null
}

type WorkflowBreakdownRow = {
  id: number
  workflow_step: number | null
  title: string
  status: string
  assignee?: { id: number; name: string } | null
}

type UnitBreakdownItem = {
  index: number
  total: number
  id: number
  title: string
  deliverable_status?: string
  deliverable_status_label?: string
  workflow?: WorkflowBreakdownRow[]
  status?: string
  assignee?: { id: number; name: string } | null
}
type UnitBreakdownResponse = {
  service_id: number
  service_name: string
  planned_quantity: number
  unit_price: string
  units: UnitBreakdownItem[]
}

type FormState = {
  project_id: string
  name: string
  planned_quantity: string
  unit_price: string
  period_label: string
  description: string
  status: string
}

const EMPTY: FormState = {
  project_id: '',
  name: '',
  planned_quantity: '0',
  unit_price: '0',
  period_label: '',
  description: '',
  status: 'active',
}

export function ServicesPage() {
  const [rows, setRows] = useState<ServiceRow[]>([])
  const [projects, setProjects] = useState<ProjectOpt[]>([])
  const [projectFilter, setProjectFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [breakdownFor, setBreakdownFor] = useState<number | null>(null)
  const [breakdown, setBreakdown] = useState<UnitBreakdownResponse | null>(null)
  const [breakdownLoading, setBreakdownLoading] = useState(false)
  const [taskAssignByService, setTaskAssignByService] = useState<Record<number, string>>({})
  const [assigningServiceId, setAssigningServiceId] = useState<number | null>(null)
  const [projectFullInvoice, setProjectFullInvoice] = useState<ServiceInvoiceRow | null>(null)
  const [invoiceBusyId, setInvoiceBusyId] = useState<number | null>(null)
  const [projectInvoiceBusy, setProjectInvoiceBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const projectId = projectFilter || ''
      const [p, svc, invStatus] = await Promise.all([
        apiRequest<ProjectOpt[]>('/api/admin/projects'),
        apiRequest<ServiceRow[]>(
          projectId ? `/api/admin/agency-services?project_id=${projectId}` : '/api/admin/agency-services',
        ),
        projectId
          ? apiRequest<{ project_invoice: ServiceInvoiceRow | null }>(
              `/api/admin/projects/${projectId}/invoice-status`,
            )
          : Promise.resolve({ project_invoice: null }),
      ])
      setProjects(p)
      setRows(svc)
      setProjectFullInvoice(invStatus.project_invoice)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load services')
      setRows([])
      setProjectFullInvoice(null)
    } finally {
      setLoading(false)
    }
  }, [projectFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (breakdownFor == null) {
      setBreakdown(null)
      return
    }
    setBreakdownLoading(true)
    void apiRequest<UnitBreakdownResponse>(`/api/admin/agency-services/${breakdownFor}/units`)
      .then((d) => setBreakdown(d))
      .catch(() => setBreakdown(null))
      .finally(() => setBreakdownLoading(false))
  }, [breakdownFor])

  const filteredProjects = useMemo(() => projects, [projects])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY)
    setModalOpen(true)
  }

  function openEdit(s: ServiceRow) {
    setEditingId(s.id)
    setForm({
      project_id: String(s.project_id),
      name: s.name,
      planned_quantity: String(s.planned_quantity ?? 0),
      unit_price: String(s.unit_price ?? '0'),
      period_label: s.period_label ?? '',
      description: s.description ?? '',
      status: s.status,
    })
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const body = {
        project_id: Number(form.project_id),
        name: form.name.trim(),
        planned_quantity: Math.max(0, Number(form.planned_quantity || 0)),
        unit_price: Math.max(0, Number(form.unit_price || 0)),
        period_label: form.period_label.trim() || null,
        description: form.description.trim() || null,
        status: form.status as 'active' | 'archived',
      }
      type SaveRes = { unit_sync?: { created: number; removed: number; assignees_filled?: number } }
      if (editingId) {
        const res = await apiRequest<SaveRes>(`/api/admin/agency-services/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
        const u = res.unit_sync
        if (u && (u.created > 0 || u.removed > 0 || (u.assignees_filled ?? 0) > 0)) {
          setMessage('Service updated successfully.')
        } else {
          setMessage('Service updated in proposal.')
        }
      } else {
        const res = await apiRequest<SaveRes>('/api/admin/agency-services', { method: 'POST', body: JSON.stringify(body) })
        const u = res.unit_sync
        if (u && u.created > 0) {
          setMessage('Service added successfully.')
        } else {
          setMessage('Service added to proposal. Set quantity above 0 to generate deliverables and workflow.')
        }
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function removeRow(s: ServiceRow) {
    if (!window.confirm(`Remove service “${s.name}”? Tasks stay linked to the project; service link on tasks will clear.`)) return
    setBusy(true)
    setMessage(null)
    try {
      await apiRequest(`/api/admin/agency-services/${s.id}`, { method: 'DELETE' })
      setMessage('Service removed from proposal.')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function runAutoAssignBackfill(s: ServiceRow) {
    setAssigningServiceId(s.id)
    setError(null)
    setMessage(null)
    try {
      const res = await apiRequest<{ ok: boolean; tasks_updated: number }>(
        `/api/admin/agency-services/${s.id}/backfill-assignees`,
        { method: 'POST', body: '{}' },
      )
      if (res.tasks_updated > 0) {
        setMessage('Assigned remaining items successfully.')
      } else {
        setMessage(
          'No changes: either all units are already assigned, or several people own different units — pick “Assign to teammate” manually.',
        )
      }
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not auto-assign')
    } finally {
      setAssigningServiceId(null)
    }
  }

  async function assignAllUnassignedTasks(s: ServiceRow) {
    const uid = Number(taskAssignByService[s.id] ?? 0)
    if (!uid) {
      setError('Select a team member to assign all open unit tasks to.')
      return
    }
    setAssigningServiceId(s.id)
    setError(null)
    setMessage(null)
    try {
      const res = await apiRequest<{ ok: boolean; assigned: number }>(
        `/api/admin/agency-services/${s.id}/assign-tasks`,
        { method: 'POST', body: JSON.stringify({ user_id: uid }) },
      )
      setMessage(
        res.assigned > 0
          ? `Assigned ${res.assigned} workflow task(s) for “${s.name}” — visible under “My tasks”.`
          : 'No unassigned workflow tasks to assign.',
      )
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not assign tasks')
    } finally {
      setAssigningServiceId(null)
    }
  }

  async function finalizeProposal() {
    if (!projectFilter) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await apiRequest<{ created_tasks: number; created_deliverables?: number }>(
        `/api/admin/projects/${projectFilter}/finalize-plan`,
        { method: 'POST', body: '{}' },
      )
      const d = res.created_deliverables ?? 0
      setMessage(`Proposal finalized. ${d} deliverable(s); ${res.created_tasks} workflow task(s).`)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not finalize proposal')
    } finally {
      setBusy(false)
    }
  }

  async function generateServiceInvoice(s: ServiceRow) {
    setInvoiceBusyId(s.id)
    setError(null)
    setMessage(null)
    try {
      await apiRequest<ServiceInvoiceRow>(`/api/admin/agency-services/${s.id}/invoices/generate`, {
        method: 'POST',
        body: '{}',
      })
      setMessage(`Invoice generated for “${s.name}”.`)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate invoice')
    } finally {
      setInvoiceBusyId(null)
    }
  }

  async function generateProjectFullInvoice() {
    if (!projectFilter) return
    setProjectInvoiceBusy(true)
    setError(null)
    setMessage(null)
    try {
      await apiRequest<ServiceInvoiceRow>(`/api/admin/projects/${projectFilter}/invoices/generate-full`, {
        method: 'POST',
        body: '{}',
      })
      setMessage('Full project invoice generated.')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate invoice')
    } finally {
      setProjectInvoiceBusy(false)
    }
  }

  async function downloadInvoicePdf(inv: ServiceInvoiceRow) {
    const name = `invoice-${inv.invoice_number ?? inv.id}.pdf`
    await downloadProtectedFile(`/api/admin/invoices/${inv.id}/pdf`, name)
  }

  function viewInvoicePdf(inv: ServiceInvoiceRow) {
    void openProtectedFile(`/api/admin/invoices/${inv.id}/pdf`)
  }

  async function sendInvoiceToClient(inv: ServiceInvoiceRow) {
    setInvoiceBusyId(inv.id)
    setError(null)
    setMessage(null)
    try {
      await apiRequest(`/api/admin/invoices/${inv.id}/send`, { method: 'POST', body: '{}' })
      setMessage('Invoice sent to client email.')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send invoice')
    } finally {
      setInvoiceBusyId(null)
    }
  }

  async function markInvoicePaid(inv: ServiceInvoiceRow) {
    setInvoiceBusyId(inv.id)
    setError(null)
    setMessage(null)
    try {
      await apiRequest(`/api/admin/invoices/${inv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'paid' }),
      })
      setMessage('Invoice marked as paid.')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update invoice')
    } finally {
      setInvoiceBusyId(null)
    }
  }

  const selectedProject = useMemo(
    () => projects.find((p) => String(p.id) === projectFilter) ?? null,
    [projects, projectFilter],
  )
  const projectMembers = selectedProject?.members ?? []
  const proposalLocked = Boolean((selectedProject as { services_plan_locked?: boolean } | null)?.services_plan_locked)
  const totalValue = useMemo(
    () => rows.reduce((acc, s) => acc + (Number(s.planned_quantity ?? 0) * Number(s.unit_price ?? 0)), 0),
    [rows],
  )
  const totalBilledEarned = useMemo(
    () =>
      rows.reduce((acc, s) => {
        const planned = Number(s.planned_quantity ?? 0)
        const unitPrice = Number(s.unit_price ?? 0)
        const completed = Math.min(planned, Number(s.tasks_done_count ?? 0))
        return acc + completed * unitPrice
      }, 0),
    [rows],
  )
  const totalRemaining = Math.max(0, totalValue - totalBilledEarned)
  const flowSteps = ['Proposal', 'Deliverables', 'Workflow', 'Billing', 'Invoice']
  const draftQuantity = Math.max(0, Number(form.planned_quantity || 0))
  const draftUnitPrice = Math.max(0, Number(form.unit_price || 0))
  const draftTotal = draftQuantity * draftUnitPrice

  function invoiceStatusBadgeClass(display: string): string {
    switch (display) {
      case 'paid':
        return 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/30'
      case 'sent':
        return 'bg-sky-500/20 text-sky-200 ring-sky-500/30'
      case 'overdue':
        return 'bg-red-500/20 text-red-200 ring-red-500/30'
      default:
        return 'bg-amber-500/20 text-amber-200 ring-amber-500/30'
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-5 ring-1 ring-white/[0.04]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-emerald-300/90">
              <Layers className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">Client Proposal</span>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Define what will be delivered, quantity, and pricing.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              {flowSteps.map((step, idx) => (
                <span
                  key={step}
                  className={`rounded-md px-2 py-1 ${idx === 0 ? 'bg-emerald-500/20 font-semibold text-emerald-200 ring-1 ring-emerald-400/30' : 'bg-white/[0.03] text-slate-500'}`}
                >
                  {step}
                  {idx < flowSteps.length - 1 ? <span className="ml-1.5 text-slate-600">→</span> : null}
                </span>
              ))}
            </div>
          </div>
          <div className="w-full rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 ring-1 ring-emerald-400/20 sm:w-[360px]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/90">Proposal & billing</p>
            <p className="mt-1 text-sm text-slate-300">
              Total: <span className="font-semibold text-white">PKR {totalValue.toLocaleString()}</span>
            </p>
            <p className="mt-0.5 text-sm text-slate-300">
              Billed (completed work): <span className="font-semibold text-emerald-200">PKR {totalBilledEarned.toLocaleString()}</span>
            </p>
            <p className="mt-0.5 text-sm text-slate-400">
              Remaining: <span className="font-medium text-slate-200">PKR {totalRemaining.toLocaleString()}</span>
            </p>
            <p className="mt-2 text-xs text-emerald-100/80">{rows.length} service line{rows.length === 1 ? '' : 's'}</p>
            {projectFilter && projectFullInvoice ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${invoiceStatusBadgeClass(projectFullInvoice.status_display)}`}
                >
                  Full invoice: {projectFullInvoice.status_display}
                </span>
                <span className="text-[11px] text-slate-500">{projectFullInvoice.invoice_number}</span>
              </div>
            ) : null}
            <div className="mt-3 flex flex-col gap-2">
              {projectFilter ? (
                <button
                  type="button"
                  disabled={projectInvoiceBusy || rows.length === 0}
                  onClick={() => void generateProjectFullInvoice()}
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/[0.1] disabled:opacity-50"
                >
                  {projectInvoiceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                  {projectFullInvoice ? 'Regenerate full invoice' : 'Generate full client invoice'}
                </button>
              ) : null}
              {projectFilter && projectFullInvoice ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => viewInvoicePdf(projectFullInvoice)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/[0.08] px-2 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-white/[0.12]"
                  >
                    View PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadInvoicePdf(projectFullInvoice)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/[0.08] px-2 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-white/[0.12]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendInvoiceToClient(projectFullInvoice)}
                    className="inline-flex flex-1 min-w-[8rem] items-center justify-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1.5 text-[11px] font-medium text-sky-200 ring-1 ring-sky-500/30 hover:bg-sky-500/30"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Send
                  </button>
                  {projectFullInvoice.status_display !== 'paid' ? (
                    <button
                      type="button"
                      onClick={() => void markInvoicePaid(projectFullInvoice)}
                      className="w-full rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20"
                    >
                      Mark paid
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              disabled={busy || !projectFilter || proposalLocked || rows.length === 0}
              onClick={() => void finalizeProposal()}
              className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-400 disabled:opacity-50"
            >
              {proposalLocked ? 'Proposal Finalized ✓' : 'Finalize Proposal'}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="text-xs text-slate-500">
            Filter by project
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="mt-1 block w-full min-w-[12rem] rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
            >
              <option value="">All projects</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={openCreate}
            disabled={proposalLocked}
            className="inline-flex items-center justify-center gap-2 self-end rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.08] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add Service
          </button>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p> : null}
      {message ? <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{message}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading services…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-12 text-center text-sm text-slate-500">
          No services yet. Create one to structure work between projects and tasks.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((s) => {
            const planned = Number(s.planned_quantity ?? 0)
            const unitPrice = Number(s.unit_price ?? 0)
            const completedUnits = Math.min(planned, Number(s.tasks_done_count ?? 0))
            const progress = planned > 0 ? Math.min(100, Math.round((completedUnits / planned) * 100)) : 0
            const plannedTotal = planned * unitPrice
            const earnedTotal = completedUnits * unitPrice
            const unassigned = Number(s.tasks_unassigned_count ?? 0)
            const remainingPkr = Math.max(0, plannedTotal - earnedTotal)
            const inv = s.invoice
            const showReadyToInvoice = planned > 0 && completedUnits >= planned && !inv
            return (
              <li
                key={s.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-[#0c1222]/70 p-5 ring-1 ring-white/[0.04] sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white">{s.name}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {planned} planned {unitPrice > 0 ? `• PKR ${unitPrice.toLocaleString()} / unit` : ''}
                  </p>
                  <div className="mt-3 max-w-sm">
                    <div className="h-2.5 min-w-0 overflow-hidden rounded-full bg-white/[0.08]">
                      <div className="h-full rounded-full bg-emerald-400/90" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-slate-200">
                      {completedUnits} / {planned} deliverables done
                    </p>
                  </div>
                  <div className="mt-2 space-y-0.5 text-sm">
                    <p>
                      <span className="text-emerald-200/90">Billed: </span>
                      <span className="font-semibold text-emerald-100">PKR {earnedTotal.toLocaleString()}</span>
                    </p>
                    <p className="text-slate-500">
                      <span className="text-slate-500">Remaining: </span>
                      <span className="font-medium text-slate-300">PKR {remainingPkr.toLocaleString()}</span>
                    </p>
                  </div>
                  {showReadyToInvoice ? (
                    <p className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-200">
                      Ready to invoice — all deliverables are completed.
                    </p>
                  ) : null}
                  {inv ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${invoiceStatusBadgeClass(inv.status_display)}`}
                      >
                        Invoice: {inv.status_display}
                      </span>
                      {inv.invoice_number ? <span className="text-[11px] text-slate-500">{inv.invoice_number}</span> : null}
                    </div>
                  ) : null}
                  {unassigned > 0 ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-amber-200">
                      <span>⚠ {unassigned} item{unassigned === 1 ? '' : 's'} not assigned</span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={assigningServiceId === s.id}
                          onClick={() => void runAutoAssignBackfill(s)}
                          className="rounded-md border border-amber-400/35 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
                        >
                          {assigningServiceId === s.id ? 'Assigning…' : 'Assign now'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="flex w-full min-w-0 flex-col gap-2 sm:max-w-xs sm:shrink-0 sm:items-end">
                  <p className="w-full text-[10px] font-semibold uppercase tracking-wide text-slate-500">Work</p>
                  {unassigned > 0 && projectFilter && projectMembers.length === 0 ? (
                    <p className="max-w-sm rounded-md border border-slate-700/60 bg-slate-900/30 px-2 py-1.5 text-[11px] text-slate-500">
                      Add people to this project in <span className="text-slate-300">Projects</span> so you can assign
                      unit tasks.
                    </p>
                  ) : null}
                  {unassigned > 0 && projectFilter && projectMembers.length > 0 ? (
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Assign team</p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                        <select
                          value={taskAssignByService[s.id] ?? ''}
                          onChange={(e) => setTaskAssignByService((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          className="w-full min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-[#0a1018] px-2 py-2 text-xs text-slate-200"
                        >
                          <option value="">Select team member…</option>
                          {projectMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={assigningServiceId === s.id || !taskAssignByService[s.id]}
                          onClick={() => void assignAllUnassignedTasks(s)}
                          className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                        >
                          {assigningServiceId === s.id ? 'Assigning…' : 'Assign all remaining items'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setBreakdownFor(s.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
                  >
                    <ListOrdered className="h-3.5 w-3.5" />
                    View breakdown
                  </button>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      disabled={proposalLocked}
                      onClick={() => openEdit(s)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.08]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy || proposalLocked}
                      onClick={() => void removeRow(s)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                  <div className="w-full border-t border-white/[0.08] pt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Billing</p>
                    <div className="mt-2 flex w-full flex-col gap-1.5">
                      {!inv ? (
                        <button
                          type="button"
                          disabled={invoiceBusyId === s.id}
                          onClick={() => void generateServiceInvoice(s)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50"
                        >
                          {invoiceBusyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                          Generate invoice
                        </button>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => viewInvoicePdf(inv)}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.05] px-2 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-white/[0.1]"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => void downloadInvoicePdf(inv)}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.05] px-2 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-white/[0.1]"
                            >
                              <Download className="h-3.5 w-3.5" />
                              PDF
                            </button>
                            <button
                              type="button"
                              disabled={invoiceBusyId === inv.id}
                              onClick={() => void sendInvoiceToClient(inv)}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-sky-500/15 px-2 py-1.5 text-[11px] font-medium text-sky-200 ring-1 ring-sky-500/30 hover:bg-sky-500/25 disabled:opacity-50"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Send
                            </button>
                            {inv.status_display !== 'paid' ? (
                              <button
                                type="button"
                                disabled={invoiceBusyId === inv.id}
                                onClick={() => void markInvoicePaid(inv)}
                                className="w-full rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                              >
                                Mark paid
                              </button>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            disabled={invoiceBusyId === s.id}
                            onClick={() => void generateServiceInvoice(s)}
                            className="w-full text-center text-[11px] text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline disabled:opacity-50"
                          >
                            Regenerate
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {breakdownFor != null ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="breakdown-title"
          onClick={() => setBreakdownFor(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0b1324] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
              <div className="min-w-0">
                <h3 id="breakdown-title" className="text-base font-semibold text-white">
                  Work breakdown
                </h3>
                {breakdown ? (
                  <p className="mt-0.5 truncate text-sm text-slate-400" title={breakdown.service_name}>
                    {breakdown.service_name} · {breakdown.planned_quantity} units
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setBreakdownFor(null)}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
              {breakdownLoading ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">Loading…</p>
              ) : !breakdown || breakdown.units.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">
                  No deliverables yet. Set quantity and save to create each output plus its workflow steps.
                </p>
              ) : (
                <ul className="space-y-3 px-2 py-1">
                  {breakdown.units.map((u) => {
                    const wf = u.workflow
                    if (wf && wf.length > 0) {
                      return (
                        <li key={u.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2">
                          <div className="flex items-start justify-between gap-2 text-sm">
                            <div className="min-w-0">
                              <span className="font-medium text-white">
                                #{u.index} — {u.title}
                              </span>
                              {u.deliverable_status_label ? (
                                <span className="ml-2 text-xs text-slate-400">({u.deliverable_status_label})</span>
                              ) : null}
                            </div>
                          </div>
                          <ul className="mt-2 space-y-1 border-t border-white/[0.05] pt-2">
                            {wf.map((w) => {
                              const done = w.status === 'done'
                              return (
                                <li
                                  key={w.id}
                                  className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs text-slate-300"
                                >
                                  <span className={done ? 'text-slate-500 line-through' : ''}>
                                    {w.workflow_step ?? '·'}. {w.title}
                                  </span>
                                  <span className="shrink-0 text-[10px] uppercase text-slate-500">{w.status}</span>
                                </li>
                              )
                            })}
                          </ul>
                        </li>
                      )
                    }
                    const done = u.status === 'done'
                    const pending = u.status === 'todo'
                    const icon = done ? '✓' : pending ? '○' : '◐'
                    return (
                      <li
                        key={u.id}
                        className="flex items-start justify-between gap-2 rounded-lg px-2 py-2.5 text-sm hover:bg-white/[0.04]"
                      >
                        <div className="min-w-0">
                          <span className="text-slate-500">{icon}</span>{' '}
                          <span className={done ? 'text-slate-300 line-through' : 'font-medium text-white'}>
                            #{u.index}
                          </span>
                          <span className="text-slate-500"> — {u.title}</span>
                          {u.assignee ? (
                            <p className="mt-0.5 text-xs text-slate-500">Assigned: {u.assignee.name}</p>
                          ) : null}
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            u.status === 'done'
                              ? 'bg-slate-600/50 text-slate-200'
                              : u.status === 'review'
                                ? 'bg-amber-500/20 text-amber-200'
                                : u.status === 'doing' || u.status === 'revision'
                                  ? 'bg-sky-500/15 text-sky-200'
                                  : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {u.status ?? ''}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0b1324] shadow-2xl">
            <form onSubmit={(e) => void handleSubmit(e)} className="max-h-[86vh] overflow-y-auto">
              <div className="p-5 sm:p-6">
                <h3 className="text-lg font-semibold tracking-tight text-white">
                  {editingId ? 'Edit service in proposal' : 'Add service to proposal'}
                </h3>
                <p className="mt-1.5 text-sm text-slate-500">Quickly set quantity, price, and project.</p>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="svc-title" className="block text-xs font-medium text-slate-300">
                        Service name <span className="text-rose-400/90">*</span>
                      </label>
                      <input
                        id="svc-title"
                        required
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Instagram Posts"
                        className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="svc-planned" className="block text-xs font-medium text-slate-300">
                          Quantity
                        </label>
                        <div className="mt-1 flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, planned_quantity: String(Math.max(0, Number(f.planned_quantity || 0) - 1)) }))}
                            className="px-3 py-2 text-slate-300 hover:text-white"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <input
                            id="svc-planned"
                            type="number"
                            min={0}
                            step={1}
                            value={form.planned_quantity}
                            onChange={(e) => setForm((f) => ({ ...f, planned_quantity: e.target.value }))}
                            className="w-full bg-transparent px-2 py-2 text-center text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, planned_quantity: String(Math.max(0, Number(f.planned_quantity || 0) + 1)) }))}
                            className="px-3 py-2 text-slate-300 hover:text-white"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="svc-price" className="block text-xs font-medium text-slate-300">
                          Price per item (PKR)
                        </label>
                        <input
                          id="svc-price"
                          type="number"
                          min={0}
                          step={0.01}
                          value={form.unit_price}
                          onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
                          className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="svc-project" className="block text-xs font-medium text-slate-300">
                        Assign to project <span className="text-rose-400/90">*</span>
                      </label>
                      <select
                        id="svc-project"
                        required
                        value={form.project_id}
                        onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                      >
                        <option value="">Select…</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <details className="group border-t border-white/[0.06] pt-3">
                      <summary className="cursor-pointer list-none text-xs font-medium text-slate-300">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-sm leading-none text-slate-500 group-open:hidden">+</span>
                          <span className="text-sm leading-none text-slate-500 hidden group-open:inline">−</span>
                          Optional settings
                        </span>
                      </summary>
                      <div className="mt-3 space-y-3">
                        <div>
                          <label htmlFor="svc-period" className="text-xs font-medium text-slate-300">
                            Deadline (optional)
                          </label>
                          <input
                            id="svc-period"
                            value={form.period_label}
                            onChange={(e) => setForm((f) => ({ ...f, period_label: e.target.value }))}
                            placeholder="e.g. 30 Apr 2026"
                            className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                          />
                        </div>
                        <div>
                          <label htmlFor="svc-notes" className="text-xs font-medium text-slate-300">
                            Notes for team
                          </label>
                          <textarea
                            id="svc-notes"
                            value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                            rows={2}
                            placeholder="Optional context"
                            className="mt-1 w-full resize-y rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-sm text-slate-400 placeholder:text-slate-700 focus:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-white/10"
                          />
                        </div>
                      </div>
                    </details>
                  </div>

                  <aside className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 lg:self-start">
                    <p className="text-xs text-slate-400">Total</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-200">PKR {draftTotal.toLocaleString()}</p>
                    <p className="mt-1 text-sm text-slate-300">{draftQuantity.toLocaleString()} items</p>
                    <div className="mt-3 border-t border-white/[0.08] pt-3 text-sm text-slate-400">
                      <p className="text-xs uppercase tracking-wide text-slate-500">You are creating</p>
                      <p className="mt-1 text-slate-100">
                        {draftQuantity.toLocaleString()} {form.name.trim() || 'Service Items'}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">Each item is one deliverable with a 5-step workflow.</p>
                    </div>
                  </aside>
                </div>
              </div>

              <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 border-t border-white/[0.06] bg-[#0b1324] px-5 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-white/[0.12] px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || proposalLocked}
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editingId ? 'Save service' : 'Add Service →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
