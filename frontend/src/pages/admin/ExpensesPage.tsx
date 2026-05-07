import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ChevronDown,
  ChevronUp,
  FileDown,
  Loader2,
  Plus,
  Receipt,
  Sparkles,
  Trash2,
  Wallet,
  Zap,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ApiError, apiRequest } from '../../lib/api'

export type ExpenseCategory = 'food' | 'bills' | 'transport' | 'office' | 'personal' | 'other'

type ExpenseRow = {
  id: number
  title: string
  amount: string
  expense_date: string
  category: ExpenseCategory
  assigned_to: string
  notes: string | null
}

type AssigneeMeta = { key: string; label: string }

type TeamBalanceRow = {
  assignee_key: string
  label: string
  advances_total: string
  spent_total: string
  remaining: string
}

type ExpensesPayload = {
  expenses: ExpenseRow[]
  summary: {
    today_total: string
    week_total: string
    month_total: string
  }
  team_balances: TeamBalanceRow[]
  meta: {
    assignees: AssigneeMeta[]
    viewer_assignee_key: string
  }
}

type ExportScope = 'month' | 'week' | 'all'

type TimeFilter = 'all' | 'today' | 'week' | 'month'
type OwnerFilter = 'all' | 'mine' | 'team'
type CategoryFilter = 'all' | ExpenseCategory

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  food: 'Food',
  bills: 'Bills',
  transport: 'Transport',
  office: 'Office',
  personal: 'Personal',
  other: 'Other',
}

const CATEGORY_TAG_CLASS: Record<ExpenseCategory, string> = {
  food: 'bg-amber-500/12 text-amber-100 ring-amber-500/25',
  bills: 'bg-sky-500/12 text-sky-100 ring-sky-500/25',
  transport: 'bg-violet-500/12 text-violet-100 ring-violet-500/25',
  office: 'bg-emerald-500/12 text-emerald-100 ring-emerald-500/25',
  personal: 'bg-fuchsia-500/12 text-fuchsia-100 ring-fuchsia-500/25',
  other: 'bg-slate-500/12 text-slate-200 ring-slate-500/20',
}

const CATEGORIES: ExpenseCategory[] = ['food', 'bills', 'transport', 'office', 'personal', 'other']

const EMPTY_FORM = {
  title: '',
  amount: '',
  expense_date: '',
  category: 'other' as ExpenseCategory,
  assigned_to: 'me',
  notes: '',
}

const FALLBACK_PAYLOAD: ExpensesPayload = {
  expenses: [],
  summary: { today_total: '0', week_total: '0', month_total: '0' },
  team_balances: [],
  meta: {
    assignees: [
      { key: 'me', label: 'Me' },
      { key: 'waheed', label: 'Waheed' },
      { key: 'ali', label: 'Ali' },
    ],
    viewer_assignee_key: 'me',
  },
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Monday-based week, aligned with Laravel Carbon::MONDAY */
function startOfWeekMonday(ref: Date): Date {
  const d = startOfDay(ref)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function endOfWeekMonday(ref: Date): Date {
  const s = startOfWeekMonday(ref)
  const e = new Date(s)
  e.setDate(e.getDate() + 6)
  return e
}

function isInCurrentWeek(iso: string): boolean {
  const d = startOfDay(parseLocalDate(iso))
  const now = new Date()
  const start = startOfWeekMonday(now)
  const end = endOfWeekMonday(now)
  return d >= start && d <= end
}

function formatPkr(amount: string): string {
  const n = Number(amount)
  if (Number.isNaN(n)) return amount
  return `PKR ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function formatExpenseDay(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function monthYearLabel(isoDate: string): string {
  const d = parseLocalDate(isoDate)
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

function suggestCategoryFromTitle(raw: string): ExpenseCategory | null {
  const t = raw.toLowerCase()
  if (/(tea|lunch|food|meal|biryani|coffee|snack|dinner|breakfast|burger|pizza|juice)/.test(t)) return 'food'
  if (/(fuel|petrol|gas|cng|diesel|uber|taxi|transport|rickshaw|cab|parking|toll)/.test(t)) return 'transport'
  if (/(electric|internet|bill|rent|wifi|utility|dsl|water|power|wasa)/.test(t)) return 'bills'
  if (/(desk|chair|printer|stationery|paper|ink|office)/.test(t)) return 'office'
  if (/(medic|doctor|personal|clothes)/.test(t)) return 'personal'
  return null
}

function sumRowAmounts(rows: ExpenseRow[]): string {
  const n = rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0)
  return n.toFixed(2)
}

function filterExpensesByExportScope(rows: ExpenseRow[], scope: ExportScope): ExpenseRow[] {
  if (scope === 'all') return rows
  const now = new Date()
  const y = now.getFullYear()
  const mo = now.getMonth() + 1
  if (scope === 'month') {
    return rows.filter((r) => {
      const [ry, rm] = r.expense_date.split('-').map(Number)
      return ry === y && rm === mo
    })
  }
  if (scope === 'week') {
    return rows.filter((r) => isInCurrentWeek(r.expense_date))
  }
  return rows
}

type Grouped = { key: string; label: string; order: number; items: ExpenseRow[] }

function buildGroups(rows: ExpenseRow[]): Grouped[] {
  const today = startOfDay(new Date())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const bucket = new Map<string, ExpenseRow[]>()
  const meta = new Map<string, { label: string; order: number }>()

  for (const row of rows) {
    const d = startOfDay(parseLocalDate(row.expense_date))
    let gkey: string
    if (isSameDay(d, today)) {
      gkey = '__today__'
      meta.set(gkey, { label: 'Today', order: 1_000_000 })
    } else if (isSameDay(d, yesterday)) {
      gkey = '__yesterday__'
      meta.set(gkey, { label: 'Yesterday', order: 999_000 })
    } else {
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      gkey = `m:${ym}`
      if (!meta.has(gkey)) {
        const order = d.getFullYear() * 100 + d.getMonth()
        meta.set(gkey, { label: monthYearLabel(row.expense_date), order })
      }
    }
    const list = bucket.get(gkey) ?? []
    list.push(row)
    bucket.set(gkey, list)
  }

  const out: Grouped[] = []
  for (const [key, items] of bucket) {
    const m = meta.get(key)
    if (!m) continue
    items.sort((a, b) => {
      const cmp = b.expense_date.localeCompare(a.expense_date)
      return cmp !== 0 ? cmp : b.id - a.id
    })
    out.push({ key, label: m.label, order: m.order, items })
  }
  out.sort((a, b) => b.order - a.order)
  return out
}

function openPrintReport(opts: {
  title: string
  subtitle: string
  summaryLines: { label: string; value: string }[]
  categoryRows: { name: string; total: string }[]
  expenses: ExpenseRow[]
  assigneeLabel: (k: string) => string
}): void {
  const { subtitle, summaryLines, categoryRows, expenses, assigneeLabel } = opts
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 42
  let y = 46

  const nowLabel = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  const reportMonth = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  // Header
  doc.setFillColor(17, 24, 39)
  doc.roundedRect(margin, y - 12, 24, 24, 5, 5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('FP', margin + 12, y + 3, { align: 'center' })

  doc.setTextColor(17, 24, 39)
  doc.setFontSize(13)
  doc.text('FlowPilot', margin + 32, y + 3)

  doc.setFontSize(24)
  doc.text('Expense Report', pageWidth - margin, y + 2, { align: 'right' })
  doc.setFontSize(12)
  doc.setTextColor(55, 65, 81)
  doc.text(reportMonth, pageWidth - margin, y + 19, { align: 'right' })
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text(`Generated on ${nowLabel}`, pageWidth - margin, y + 33, { align: 'right' })
  y += 48

  doc.setDrawColor(229, 231, 235)
  doc.line(margin, y, pageWidth - margin, y)
  y += 18

  // Summary cards
  const cardGap = 10
  const cardW = (pageWidth - margin * 2 - cardGap * 2) / 3
  const cardH = 62
  summaryLines.slice(0, 3).forEach((s, i) => {
    const x = margin + i * (cardW + cardGap)
    doc.setDrawColor(229, 231, 235)
    doc.setFillColor(250, 250, 250)
    doc.roundedRect(x, y, cardW, cardH, 8, 8, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(107, 114, 128)
    doc.text(s.label.toUpperCase(), x + 10, y + 16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(17, 24, 39)
    doc.text(s.value, x + 10, y + 42)
  })
  y += cardH + 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text(subtitle, margin, y)
  y += 18

  // Category breakdown
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(75, 85, 99)
  doc.setFontSize(10)
  doc.text('CATEGORY BREAKDOWN', margin, y)
  y += 10
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'plain',
    body: categoryRows.map((c) => [c.name, '------------------------', c.total]),
    styles: { fontSize: 10, textColor: [17, 24, 39], cellPadding: { top: 6, right: 0, bottom: 6, left: 0 } },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'center', textColor: [156, 163, 175] },
      2: { halign: 'right', fontStyle: 'bold' },
    },
  })

  y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y) + 16

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(75, 85, 99)
  doc.setFontSize(10)
  doc.text(`ALL EXPENSES (${expenses.length})`, margin, y)
  y += 8

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['DATE', 'EXPENSE', 'PERSON', 'CATEGORY', 'AMOUNT']],
    body: expenses.map((e) => [
      formatPrintDate(e.expense_date),
      e.title,
      assigneeLabel(e.assigned_to),
      CATEGORY_LABEL[e.category] ?? e.category,
      formatPkr(e.amount),
    ]),
    styles: { fontSize: 10, cellPadding: { top: 7, right: 8, bottom: 7, left: 8 }, textColor: [17, 24, 39] },
    headStyles: { fillColor: [238, 242, 247], textColor: [75, 85, 99], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
  })

  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y
  const footerY = Math.min(doc.internal.pageSize.getHeight() - 22, finalY + 24)
  doc.setDrawColor(229, 231, 235)
  doc.line(margin, footerY - 9, pageWidth - margin, footerY - 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(156, 163, 175)
  doc.text('Generated by FlowPilot', margin, footerY)
  doc.text('www.flowpilot.app', pageWidth - margin, footerY, { align: 'right' })

  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`flowpilot-expense-report-${stamp}.pdf`)
}

function formatPrintDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ExpensesPage() {
  const expenseInputRef = useRef<HTMLInputElement | null>(null)
  const [payload, setPayload] = useState<ExpensesPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  const [quickTitle, setQuickTitle] = useState('')
  const [quickAmount, setQuickAmount] = useState('')
  const [quickCategory, setQuickCategory] = useState<ExpenseCategory>('other')
  const [quickAssigned, setQuickAssigned] = useState('me')
  const [quickExpanded, setQuickExpanded] = useState(false)

  const [exportScope, setExportScope] = useState<ExportScope>('month')
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseRow | null>(null)
  const [teamBalancesOpen, setTeamBalancesOpen] = useState(false)
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false)

  const [advAssignee, setAdvAssignee] = useState('me')
  const [advAmount, setAdvAmount] = useState('')
  const [advDate, setAdvDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [advNote, setAdvNote] = useState('')

  const meta = payload?.meta ?? FALLBACK_PAYLOAD.meta
  const assignees = meta.assignees?.length ? meta.assignees : FALLBACK_PAYLOAD.meta.assignees
  const viewerKey = meta.viewer_assignee_key ?? 'me'

  const assigneeLabel = useCallback(
    (key: string) => assignees.find((a) => a.key === key)?.label ?? key,
    [assignees],
  )

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<ExpensesPayload>('/api/admin/office-expenses')
      const merged: ExpensesPayload = {
        ...FALLBACK_PAYLOAD,
        ...data,
        summary: {
          today_total: data.summary?.today_total ?? '0',
          week_total: data.summary?.week_total ?? '0',
          month_total: data.summary?.month_total ?? '0',
        },
        team_balances: Array.isArray(data.team_balances) ? data.team_balances : [],
        meta: {
          assignees: data.meta?.assignees?.length ? data.meta.assignees : FALLBACK_PAYLOAD.meta.assignees,
          viewer_assignee_key: data.meta?.viewer_assignee_key ?? 'me',
        },
      }
      merged.expenses = (data.expenses ?? []).map((e) => ({
        ...e,
        assigned_to: e.assigned_to ?? 'me',
        category: e.category ?? 'other',
      }))
      setPayload(merged)
      setError(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load expenses')
      setPayload(FALLBACK_PAYLOAD)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setQuickAssigned(viewerKey)
    setAdvAssignee(viewerKey)
  }, [viewerKey])

  useEffect(() => {
    if (!modalOpen) return
    const t = window.setTimeout(() => {
      expenseInputRef.current?.focus()
    }, 0)
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault()
        setModalOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [modalOpen])

  const filtered = useMemo(() => {
    const rows = payload?.expenses ?? []
    const todayIso = new Date().toISOString().slice(0, 10)
    const now = new Date()
    const y = now.getFullYear()
    const mo = now.getMonth() + 1

    return rows.filter((r) => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
      if (ownerFilter === 'mine' && r.assigned_to !== viewerKey) return false
      if (ownerFilter === 'team' && r.assigned_to === viewerKey) return false

      if (timeFilter === 'today') return r.expense_date === todayIso
      if (timeFilter === 'week') return isInCurrentWeek(r.expense_date)
      if (timeFilter === 'month') {
        const [ry, rm] = r.expense_date.split('-').map(Number)
        return ry === y && rm === mo
      }
      return true
    })
  }, [payload, timeFilter, ownerFilter, categoryFilter, viewerKey])

  const groups = useMemo(() => buildGroups(filtered), [filtered])

  const smartCategoryHint = useMemo(
    () => (quickTitle.trim() ? suggestCategoryFromTitle(quickTitle) : null),
    [quickTitle],
  )

  const teamBalancesDisplay = useMemo(() => {
    const rows = payload?.team_balances
    if (rows && rows.length > 0) return rows
    return assignees.map((a) => ({
      assignee_key: a.key,
      label: a.label,
      advances_total: '0.00',
      spent_total: '0.00',
      remaining: '0.00',
    }))
  }, [payload?.team_balances, assignees])

  function openCreate() {
    setEditingId(null)
    setForm({
      ...EMPTY_FORM,
      expense_date: new Date().toISOString().slice(0, 10),
      assigned_to: viewerKey,
    })
    setModalOpen(true)
  }

  function openEdit(e: ExpenseRow) {
    setEditingId(e.id)
    setForm({
      title: e.title,
      amount: e.amount,
      expense_date: e.expense_date,
      category: e.category,
      assigned_to: e.assigned_to ?? 'me',
      notes: e.notes ?? '',
    })
    setModalOpen(true)
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = {
        title: form.title.trim(),
        amount: Number(form.amount),
        expense_date: form.expense_date,
        category: form.category,
        assigned_to: form.assigned_to,
        notes: form.notes.trim() || null,
      }
      if (editingId) {
        await apiRequest(`/api/admin/office-expenses/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      } else {
        await apiRequest('/api/admin/office-expenses', { method: 'POST', body: JSON.stringify(body) })
      }
      setModalOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function quickAdd(ev: FormEvent) {
    ev.preventDefault()
    const title = quickTitle.trim()
    const amount = Number(quickAmount)
    if (!title || Number.isNaN(amount) || amount < 0) return
    setBusy(true)
    setError(null)
    try {
      let cat = quickCategory
      if (quickCategory === 'other') {
        const sug = suggestCategoryFromTitle(title)
        if (sug) cat = sug
      }
      await apiRequest('/api/admin/office-expenses', {
        method: 'POST',
        body: JSON.stringify({
          title,
          amount,
          expense_date: new Date().toISOString().slice(0, 10),
          category: cat,
          assigned_to: quickAssigned || viewerKey,
          notes: null,
        }),
      })
      setQuickTitle('')
      setQuickAmount('')
      setQuickCategory('other')
      setQuickAssigned(viewerKey)
      setQuickExpanded(false)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add expense')
    } finally {
      setBusy(false)
    }
  }

  function onQuickTitleChange(v: string) {
    setQuickTitle(v)
    if (quickCategory === 'other') {
      const sug = suggestCategoryFromTitle(v)
      if (sug) setQuickCategory(sug)
    }
  }

  async function confirmDeleteExpense() {
    const e = expenseToDelete
    if (!e) return
    setBusy(true)
    try {
      await apiRequest(`/api/admin/office-expenses/${e.id}`, { method: 'DELETE' })
      setExpenseToDelete(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function submitAdvance(ev: FormEvent) {
    ev.preventDefault()
    const amount = Number(advAmount)
    if (Number.isNaN(amount) || amount <= 0) return
    setBusy(true)
    setError(null)
    try {
      await apiRequest('/api/admin/office-expense-advances', {
        method: 'POST',
        body: JSON.stringify({
          assignee_key: advAssignee,
          amount,
          advance_date: advDate,
          notes: advNote.trim() || null,
        }),
      })
      setAdvAmount('')
      setAdvNote('')
      setAdvanceModalOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record advance')
    } finally {
      setBusy(false)
    }
  }

  function handleExportPdf() {
    const allRows = payload?.expenses ?? []
    const exportRows = filterExpensesByExportScope(allRows, exportScope).slice()
    exportRows.sort((a, b) => b.expense_date.localeCompare(a.expense_date) || b.id - a.id)

    const s = payload?.summary
    const periodLabel =
      exportScope === 'all' ? 'All time' : exportScope === 'week' ? 'This week (calendar)' : 'This month (calendar)'
    const periodTotal = formatPkr(sumRowAmounts(exportRows))

    let summaryLines: { label: string; value: string }[]
    if (exportScope === 'all') {
      summaryLines = [
        { label: 'Today', value: formatPkr(s?.today_total ?? '0') },
        { label: 'This week', value: formatPkr(s?.week_total ?? '0') },
        { label: 'This month', value: formatPkr(s?.month_total ?? '0') },
      ]
    } else {
      summaryLines = [
        { label: periodLabel, value: periodTotal },
        { label: 'Rows in export', value: String(exportRows.length) },
      ]
    }

    const subtitle = `Export: ${exportScope === 'all' ? 'All dates' : exportScope === 'week' ? 'Current week only' : 'Current month only'} · ${exportRows.length} expense(s)`

    const byCat = new Map<ExpenseCategory, number>()
    for (const r of exportRows) {
      byCat.set(r.category, (byCat.get(r.category) ?? 0) + (Number(r.amount) || 0))
    }
    const categoryRows = CATEGORIES.filter((c) => byCat.has(c)).map((c) => ({
      name: CATEGORY_LABEL[c],
      total: formatPkr(String(byCat.get(c) ?? 0)),
    }))

    openPrintReport({
      title: 'Office expenses',
      subtitle,
      summaryLines,
      categoryRows,
      expenses: exportRows,
      assigneeLabel,
    })
  }

  const summary = payload?.summary

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="mb-2 space-y-3 border-b border-white/[0.06] pb-4 pt-1 sm:mb-3 sm:space-y-4 sm:pb-5 sm:pt-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-cyan-300/85">
              <Receipt className="h-4.5 w-4.5" strokeWidth={1.75} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Expenses</span>
            </div>
            <h2 className="mt-1 text-[1.5rem] font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-[1.85rem]">
              Expenses
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">Track and manage expenses in PKR.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="export-scope" className="sr-only">
            Export range
          </label>
          <select
            id="export-scope"
            value={exportScope}
            onChange={(e) => setExportScope(e.target.value as ExportScope)}
            disabled={!payload || busy}
            className="min-h-[38px] rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-sm text-slate-300 disabled:opacity-50"
          >
            <option value="month">This month</option>
            <option value="week">This week</option>
            <option value="all">All time</option>
          </select>
          <button
            type="button"
            onClick={() => handleExportPdf()}
            disabled={!payload || busy}
            className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-transparent px-3.5 py-1.5 text-sm font-medium text-slate-300 hover:bg-white/[0.06] disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(16,185,129,0.22)] hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            Add expense
          </button>
        </div>
      </section>

      {summary ? (
        <div className="mb-4 sm:mb-5">
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
            <div className="min-w-[205px] snap-start rounded-2xl border border-white/[0.08] bg-[#0c1222]/70 p-3 ring-1 ring-white/[0.04] sm:min-w-0 sm:p-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Today</p>
              <p className="mt-1 text-[1.45rem] font-semibold tabular-nums text-slate-100 sm:text-[1.7rem]">{formatPkr(summary.today_total)}</p>
            </div>
            <div className="min-w-[205px] snap-start rounded-2xl border border-white/[0.08] bg-[#0c1222]/70 p-3 ring-1 ring-white/[0.04] sm:min-w-0 sm:p-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">This week</p>
              <p className="mt-1 text-[1.45rem] font-semibold tabular-nums text-slate-100 sm:text-[1.7rem]">{formatPkr(summary.week_total ?? '0')}</p>
            </div>
            <div className="min-w-[220px] snap-start rounded-2xl border border-cyan-500/25 bg-[#0c1222]/85 p-3.5 ring-1 ring-cyan-500/20 sm:min-w-0 sm:p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">This month</p>
              <p className="mt-1 text-[1.7rem] font-bold tabular-nums text-white sm:text-[2rem]">{formatPkr(summary.month_total)}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/[0.08] bg-[#0c1222]/55 p-3.5 ring-1 ring-white/[0.03] sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-emerald-300/90">
            <Zap className="h-4 w-4" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wide">Quick add</span>
          </div>
          <button
            type="button"
            onClick={() => setQuickExpanded((x) => !x)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200"
          >
            {quickExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {quickExpanded ? 'Hide' : 'Category & assign'}
          </button>
        </div>
        <form onSubmit={(e) => void quickAdd(e)} className="mt-2.5 grid grid-cols-[minmax(0,1fr)_94px_76px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_130px_94px] lg:max-w-4xl lg:grid-cols-[minmax(0,1fr)_160px_102px]">
          <div className="min-w-0 flex-1">
            <label htmlFor="qa-title" className="sr-only">
              Title
            </label>
            <input
              id="qa-title"
              value={quickTitle}
              onChange={(e) => onQuickTitleChange(e.target.value)}
              placeholder="e.g. Tea, fuel…"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
            />
          </div>
          <div>
            <label htmlFor="qa-amt" className="sr-only">
              Amount PKR
            </label>
            <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5">
              <span className="mr-2 text-[11px] font-semibold text-slate-500">PKR</span>
              <input
                id="qa-amt"
                type="number"
                min={0}
                step={1}
                value={quickAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                placeholder="200"
                className="w-full bg-transparent py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:h-10"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </button>
        </form>
        {smartCategoryHint &&
        (quickCategory === 'other' || quickCategory === smartCategoryHint) ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-500/15 bg-cyan-950/25 px-3 py-2 text-xs text-cyan-100/95">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-cyan-300/90" aria-hidden />
            <span>
              Smart: use <strong>{CATEGORY_LABEL[smartCategoryHint]}</strong> for “{quickTitle.trim()}” (on Save). Assign
              defaults to <strong>{assignees.find((a) => a.key === (quickAssigned || viewerKey))?.label ?? 'Me'}</strong>.
            </span>
          </div>
        ) : null}
        {quickExpanded ? (
          <div className="mt-3 grid gap-3 border-t border-white/[0.06] pt-3 sm:grid-cols-2">
            <div>
              <label htmlFor="qa-cat" className="mb-1 block text-[11px] font-medium text-slate-500">
                Category (suggested from keywords)
              </label>
              <select
                id="qa-cat"
                value={quickCategory}
                onChange={(e) => setQuickCategory(e.target.value as ExpenseCategory)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="qa-asg" className="mb-1 block text-[11px] font-medium text-slate-500">
                Assigned to
              </label>
              <select
                id="qa-asg"
                value={quickAssigned}
                onChange={(e) => setQuickAssigned(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
              >
                {assignees.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-slate-500">
          Defaults to today. Use &quot;Category & assign&quot; for advanced options.
        </p>
      </div>

      <div className="flex min-w-0 items-center gap-3 overflow-x-auto pb-1">
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">People</span>
          {(
            [
              ['all', 'All'],
              ['mine', 'My'],
              ['team', 'Team'],
            ] as const
          ).map(([k, lab]) => (
            <button
              key={k}
              type="button"
              onClick={() => setOwnerFilter(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                ownerFilter === k
                  ? 'bg-violet-500/20 text-violet-100 ring-violet-500/35'
                  : 'bg-white/[0.03] text-slate-400 ring-white/[0.08] hover:bg-white/[0.06]'
              }`}
            >
              {lab}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Time</span>
          {(
            [
              ['all', 'All'],
              ['today', 'Today'],
              ['week', 'This week'],
              ['month', 'This month'],
            ] as const
          ).map(([k, lab]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTimeFilter(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                timeFilter === k
                  ? 'bg-cyan-500/20 text-cyan-100 ring-cyan-500/35'
                  : 'bg-white/[0.03] text-slate-400 ring-white/[0.08] hover:bg-white/[0.06]'
              }`}
            >
              {lab}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Category</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            className="max-w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      ) : null}

      {!payload ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : payload.expenses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-6 py-14 text-center">
          <Receipt className="mx-auto h-10 w-10 text-slate-600" strokeWidth={1.5} />
          <p className="mt-4 text-sm font-medium text-slate-300">No expenses yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Start by adding your first expense—or use Quick add for tea, fuel, and small spends.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" />
            Add expense
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-400">
          Nothing matches these filters.
        </p>
      ) : (
        <div className="space-y-5 sm:space-y-8">
          {groups.map((g) => (
            <section key={g.key}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.label}</h3>
              <ul className="space-y-3">
                {g.items.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-2xl border border-white/[0.06] bg-[#0c1222]/80 p-4 ring-1 ring-white/[0.04] transition hover:border-cyan-500/25 hover:ring-cyan-500/15"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <button type="button" onClick={() => openEdit(e)} className="min-w-0 flex-1 text-left">
                        <p className="text-[15px] font-semibold text-white">{e.title}</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{formatPkr(e.amount)}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{formatExpenseDay(e.expense_date)}</span>
                          <span className="text-slate-600">·</span>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${CATEGORY_TAG_CLASS[e.category] ?? CATEGORY_TAG_CLASS.other}`}
                          >
                            {CATEGORY_LABEL[e.category] ?? e.category}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400">{assigneeLabel(e.assigned_to)}</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        title="Remove expense"
                        aria-label={`Remove ${e.title}`}
                        onClick={() => setExpenseToDelete(e)}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] text-slate-400 transition hover:border-rose-500/30 hover:bg-rose-500/12 hover:text-rose-200 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {payload ? (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-3 py-1.5 ring-1 ring-white/[0.02]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setTeamBalancesOpen((x) => !x)}
              className="inline-flex items-center gap-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500/90 hover:text-slate-300"
            >
              <Wallet className="h-3.5 w-3.5" strokeWidth={1.75} />
              Balances
              {teamBalancesOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setAdvanceModalOpen(true)}
              className="inline-flex min-h-[28px] items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:bg-white/[0.05]"
            >
              + Record advance
            </button>
          </div>
          {teamBalancesOpen ? (
            <ul className="mt-2 grid gap-2 sm:grid-cols-3">
              {teamBalancesDisplay.map((tb) => (
                <li key={tb.assignee_key} className="rounded-lg border border-white/[0.06] bg-[#0c1222]/50 px-3 py-2 text-xs">
                  <p className="font-medium text-slate-200">{tb.label}</p>
                  <p className={`mt-1 text-sm font-semibold tabular-nums ${Number(tb.remaining) < 0 ? 'text-rose-300' : 'text-emerald-200'}`}>
                    {formatPkr(tb.remaining)} remaining
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    In {formatPkr(tb.advances_total)} · Out {formatPkr(tb.spent_total)}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 py-6 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#0b1324] p-6 shadow-2xl sm:p-7">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20">
                <Receipt className="h-5 w-5 text-cyan-300/90" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{editingId ? 'Edit expense' : 'Add expense'}</h3>
                <p className="mt-1 text-xs text-slate-500">Amounts in PKR · pick the date that matches reality.</p>
              </div>
            </div>
            <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-5">
              <div>
                <label htmlFor="ex-title" className="text-xs font-medium text-slate-300">
                  Expense <span className="text-rose-400/90">*</span>
                </label>
                <input
                  id="ex-title"
                  ref={expenseInputRef}
                  required
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value
                    setForm((f) => {
                      const next: typeof f = { ...f, title }
                      const suggested = suggestCategoryFromTitle(title)
                      if (suggested && f.category === 'other') {
                        next.category = suggested
                      }
                      return next
                    })
                  }}
                  placeholder="e.g. Tea, electricity bill, petrol"
                  className="mt-0.5 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ex-amt" className="text-xs font-medium text-slate-300">
                    Amount (PKR) <span className="text-rose-400/90">*</span>
                  </label>
                  <div className="mt-0.5 flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-3">
                    <span className="mr-2 text-xs font-medium text-slate-500">PKR</span>
                    <input
                      id="ex-amt"
                      required
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full bg-transparent py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="ex-date" className="text-xs font-medium text-slate-300">
                      Date <span className="text-rose-400/90">*</span>
                    </label>
                    <span className="text-[10px] text-slate-500">Defaults to today</span>
                  </div>
                  <input
                    id="ex-date"
                    required
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                    className="mt-0.5 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ex-cat" className="text-[11px] font-medium text-slate-500">
                    Category <span className="text-slate-600">(optional)</span>
                  </label>
                  <select
                    id="ex-cat"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))}
                    className="mt-0.5 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ex-asg" className="text-[11px] font-medium text-slate-500">
                    Assigned to
                  </label>
                  <select
                    id="ex-asg"
                    value={form.assigned_to}
                    onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                    className="mt-0.5 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200"
                  >
                    {assignees.map((a) => (
                      <option key={a.key} value={a.key}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="ex-notes" className="text-[11px] font-normal text-slate-500">
                  Notes <span className="text-slate-600">(optional)</span>
                </label>
                <textarea
                  id="ex-notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600"
                  placeholder="Optional: receipt, vendor, reason"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] pt-5 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl px-2 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editingId ? 'Save changes' : 'Create expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {advanceModalOpen ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/70 px-4 py-6 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0b1324] p-6 shadow-2xl sm:p-7">
            <h3 className="text-lg font-semibold text-white">Record advance</h3>
            <p className="mt-1 text-xs text-slate-500">Track cash given to team before expenses.</p>
            <form onSubmit={(e) => void submitAdvance(e)} className="mt-5 space-y-4">
              <div>
                <label htmlFor="adv-p" className="mb-1 block text-xs font-medium text-slate-300">
                  Person
                </label>
                <select
                  id="adv-p"
                  value={advAssignee}
                  onChange={(e) => setAdvAssignee(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200"
                >
                  {assignees.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="adv-a" className="mb-1 block text-xs font-medium text-slate-300">
                    Amount (PKR)
                  </label>
                  <input
                    id="adv-a"
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={advAmount}
                    onChange={(e) => setAdvAmount(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200"
                    placeholder="0"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="adv-d" className="mb-1 block text-xs font-medium text-slate-300">
                    Date
                  </label>
                  <input
                    id="adv-d"
                    type="date"
                    value={advDate}
                    onChange={(e) => setAdvDate(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200"
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="adv-n" className="mb-1 block text-xs font-medium text-slate-300">
                  Note (optional)
                </label>
                <input
                  id="adv-n"
                  value={advNote}
                  onChange={(e) => setAdvNote(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200"
                  placeholder="e.g. Cash advance"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setAdvanceModalOpen(false)}
                  className="rounded-xl border border-white/[0.12] px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {expenseToDelete ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div
            className="max-w-md rounded-2xl border border-white/[0.12] bg-[#0f172a] p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h3 id="delete-title" className="text-lg font-semibold text-white">
              Remove this expense?
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Are you sure? This will delete &quot;{expenseToDelete.title}&quot; ({formatPkr(expenseToDelete.amount)}). You
              cannot undo this.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="rounded-xl border border-white/[0.12] px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmDeleteExpense()}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, remove'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
