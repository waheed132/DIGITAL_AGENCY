/** Readable title case for person names from messy signup data. */
export function formatPersonName(name: string): string {
  const t = name.trim().replace(/\s+/g, ' ')
  if (!t) return ''
  return t
    .split(' ')
    .map((word) => {
      if (/^[A-Z]{2,}$/.test(word)) return word
      const lower = word.toLowerCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  employee: 'Team member',
  client: 'Client',
}

export function formatRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? (role ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : '')
}

/** Single line for pickers: "Jane Doe · Team member" */
export function formatAssigneePickerLabel(name: string, role: string): string {
  const n = formatPersonName(name)
  const r = formatRoleLabel(role)
  return r ? `${n} · ${r}` : n
}

export function formatAssigneeInline(name: string | null | undefined): string {
  if (!name?.trim()) return 'Unassigned'
  return formatPersonName(name)
}
