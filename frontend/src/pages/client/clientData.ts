export type ClientDeliverable = {
  id: number
  title: string
  status: 'completed' | 'in_progress'
  dueLabel: string
  previewUrl?: string
  downloadUrl?: string
}

export type ClientAsset = {
  id: number
  name: string
  kind: 'logo' | 'pdf' | 'image' | 'video'
  url: string
}

export type ClientComment = {
  id: number
  author: 'client' | 'agency'
  message: string
  at: string
}

export type ClientInvoice = {
  id: number
  number: string
  amount: number
  status: 'paid' | 'pending'
  issuedAt: string
}

export type ClientNotification = {
  id: number
  title: string
  body: string
  kind: 'delivery' | 'invoice' | 'revision'
  at: string
  unread?: boolean
}

export type ClientProject = {
  id: number
  name: string
  serviceLabel: string
  status: 'on_track' | 'in_progress' | 'at_risk'
  totalItems: number
  completedItems: number
  nextDelivery: string
  deliverables: ClientDeliverable[]
  assets: ClientAsset[]
  comments: ClientComment[]
  invoices: ClientInvoice[]
}

export const clientProjects: ClientProject[] = [
  {
    id: 1,
    name: 'Hilal Baby Cycle Project',
    serviceLabel: 'Instagram Management',
    status: 'on_track',
    totalItems: 10,
    completedItems: 6,
    nextDelivery: 'Instagram Post #7 (Tomorrow)',
    deliverables: [
      { id: 1, title: 'Instagram Post #1', status: 'completed', dueLabel: 'Delivered', previewUrl: '#', downloadUrl: '#' },
      { id: 2, title: 'Instagram Post #2', status: 'completed', dueLabel: 'Delivered', previewUrl: '#', downloadUrl: '#' },
      { id: 3, title: 'Instagram Post #3', status: 'completed', dueLabel: 'Delivered', previewUrl: '#', downloadUrl: '#' },
      { id: 4, title: 'Instagram Post #4', status: 'completed', dueLabel: 'Delivered', previewUrl: '#', downloadUrl: '#' },
      { id: 5, title: 'Instagram Post #5', status: 'completed', dueLabel: 'Delivered', previewUrl: '#', downloadUrl: '#' },
      { id: 6, title: 'Instagram Post #6', status: 'completed', dueLabel: 'Delivered', previewUrl: '#', downloadUrl: '#' },
      { id: 7, title: 'Instagram Post #7', status: 'in_progress', dueLabel: 'Due tomorrow' },
      { id: 8, title: 'Instagram Post #8', status: 'in_progress', dueLabel: 'Queued' },
      { id: 9, title: 'Instagram Post #9', status: 'in_progress', dueLabel: 'Queued' },
      { id: 10, title: 'Instagram Post #10', status: 'in_progress', dueLabel: 'Queued' },
    ],
    assets: [
      { id: 1, name: 'Main Logo', kind: 'logo', url: '#' },
      { id: 2, name: 'Brand Guidelines.pdf', kind: 'pdf', url: '#' },
      { id: 3, name: 'Final Post Pack.zip', kind: 'image', url: '#' },
      { id: 4, name: 'Promo Reel v1.mp4', kind: 'video', url: '#' },
    ],
    comments: [
      { id: 1, author: 'client', message: 'Please change text color on Post #5.', at: 'Today, 11:20 AM' },
      { id: 2, author: 'agency', message: 'Updated and uploaded. Please check the latest version.', at: 'Today, 12:05 PM' },
    ],
    invoices: [
      { id: 1, number: '0008', amount: 1000, status: 'paid', issuedAt: 'Apr 21, 2026' },
      { id: 2, number: '0009', amount: 1000, status: 'pending', issuedAt: 'Apr 25, 2026' },
    ],
  },
]

export const clientNotifications: ClientNotification[] = [
  {
    id: 1,
    kind: 'delivery',
    title: 'New delivery uploaded',
    body: 'Instagram Post #6 is now available for review.',
    at: '2h ago',
    unread: true,
  },
  {
    id: 2,
    kind: 'invoice',
    title: 'Invoice generated',
    body: 'Invoice #0009 for PKR 1,000 has been generated.',
    at: 'Today',
    unread: true,
  },
  {
    id: 3,
    kind: 'revision',
    title: 'Revision completed',
    body: 'Your requested revision for Post #5 has been completed.',
    at: 'Yesterday',
  },
]
