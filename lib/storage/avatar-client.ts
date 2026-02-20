export const AVATAR_STORAGE_KEY = 'user_avatar'

export function loadLocalAvatar() {
  if (typeof window === 'undefined') return null
  try {
    const cachedAvatar = localStorage.getItem(AVATAR_STORAGE_KEY)
    if (!cachedAvatar) return null
    if (!cachedAvatar.startsWith('data:image/')) return null
    return cachedAvatar
  } catch {
    return null
  }
}

export function saveLocalAvatar(base64: string) {
  if (typeof window === 'undefined') return false
  try {
    localStorage.setItem(AVATAR_STORAGE_KEY, base64)
    return true
  } catch {
    return false
  }
}
