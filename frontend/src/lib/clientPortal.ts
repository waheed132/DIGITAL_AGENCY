/** Types returned by GET /api/client/dashboard */
export type ClientDashboardPayload = {
  client: {
    id: number
    name: string
    company: string | null
  }
  primary_project: {
    id: number
    name: string
    service_label: string | null
  } | null
  stats: {
    completed_items: number
    total_items: number
    pending_items: number
    health: 'on_track' | 'at_risk'
  }
  billing: {
    total: number
    paid: number
    remaining: number
  }
  recent_deliveries: { title: string }[]
  next_delivery: string | null
}

export type ClientProjectSummaryPayload = {
  projects: {
    id: number
    name: string
    status: string
    service_label: string | null
  }[]
}

export type ClientProjectDetailPayload = {
  project: {
    id: number
    name: string
    description: string | null
    status: string
    service_label: string
    total_items: number
    completed_items: number
  }
  deliverables: {
    id: number
    title: string
    service_name?: string
    status_label: string
    is_complete: boolean
    due_label: string
    preview_url: string | null
    submission_notes: string | null
  }[]
  assets: { id: number; name: string; kind: string; url: string }[]
  invoices: {
    id: number
    number: string
    amount: number
    status: 'paid' | 'pending'
    issued_at: string
    has_pdf: boolean
    pdf_url: string
  }[]
  feedback: {
    id: number
    author: 'client' | 'agency'
    message: string
    at: string
  }[]
}

export type ClientNotificationsPayload = {
  notifications: {
    id: number
    title: string
    body: string
    kind: 'delivery' | 'invoice' | 'revision'
    at: string
    unread?: boolean
  }[]
}
