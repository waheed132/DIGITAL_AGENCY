import { useEffect, useState } from 'react'

const TEAM_PROFILE_AVATAR_KEY = 'team.profile.avatar'
const TEAM_PROFILE_AVATAR_EVENT = 'team-profile-avatar-updated'

function readAvatar(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TEAM_PROFILE_AVATAR_KEY)
}

function emitAvatarChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(TEAM_PROFILE_AVATAR_EVENT))
}

export function setTeamProfileAvatar(dataUrl: string | null) {
  if (typeof window === 'undefined') return
  if (dataUrl) {
    window.localStorage.setItem(TEAM_PROFILE_AVATAR_KEY, dataUrl)
  } else {
    window.localStorage.removeItem(TEAM_PROFILE_AVATAR_KEY)
  }
  emitAvatarChanged()
}

export function useTeamProfileAvatar() {
  const [avatar, setAvatar] = useState<string | null>(() => readAvatar())

  useEffect(() => {
    function syncFromStorage() {
      setAvatar(readAvatar())
    }
    window.addEventListener('storage', syncFromStorage)
    window.addEventListener(TEAM_PROFILE_AVATAR_EVENT, syncFromStorage)
    return () => {
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener(TEAM_PROFILE_AVATAR_EVENT, syncFromStorage)
    }
  }, [])

  return avatar
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}
