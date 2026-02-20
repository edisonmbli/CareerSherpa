import { del } from '@vercel/blob'
import path from 'path'
import fs from 'fs/promises'
import { ENV } from '@/lib/env'
import { uploadFile } from '@/lib/storage/upload'
import { AVATAR_MAX_BYTES } from '@/lib/constants'

const isProductionEnv = () =>
  process.env.NODE_ENV === 'production' || !!process.env['VERCEL_ENV']

export async function uploadAvatarForShare(
  base64DataUrl: string,
  serviceId: string,
): Promise<{ ok: true; avatarUrl: string } | { ok: false; error: string }> {
  try {
    const dataUrl = String(base64DataUrl)
    const comma = dataUrl.indexOf(',')
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
    const buffer = Buffer.from(base64, 'base64')
    const sizeBytes = buffer.length
    if (sizeBytes > AVATAR_MAX_BYTES) {
      return { ok: false, error: 'avatar_too_large' }
    }
    const mimeMatch = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,/i)
    const mimeType = mimeMatch?.[1] ?? 'image/png'
    const ext = mimeType.split('/')[1] || 'png'
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2)
    const finalFilename = `avatar_${serviceId}_${timestamp}_${random}.${ext}`
    const fileMock = {
      name: finalFilename,
      type: mimeType,
      size: sizeBytes,
      arrayBuffer: async () => new Uint8Array(buffer).buffer,
    } as unknown as File
    const avatarUrl = await uploadFile(fileMock, finalFilename)
    return { ok: true, avatarUrl }
  } catch {
    return { ok: false, error: 'avatar_upload_failed' }
  }
}

export async function resolveAvatarForShare(
  avatarBase64: string | null | undefined,
  serviceId: string,
): Promise<{ ok: true; avatarUrl?: string } | { ok: false; error: string }> {
  if (!avatarBase64) return { ok: true }
  return uploadAvatarForShare(avatarBase64, serviceId)
}

export async function deleteShareAvatar(url: string) {
  if (!url) return
  if (isProductionEnv()) {
    if (!url.startsWith('http')) return
    await del(url)
    return
  }
  const baseUrl = ENV.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000'
  const normalizedBase = baseUrl.replace(/\/$/, '')
  const normalizedUrl = url.startsWith('http')
    ? url
    : `${normalizedBase}${url.startsWith('/') ? '' : '/'}${url}`
  const relative = normalizedUrl.startsWith(normalizedBase)
    ? normalizedUrl.slice(normalizedBase.length)
    : normalizedUrl
  if (!relative.startsWith('/uploads/')) return
  const relativePath = relative.replace(/^\/+/, '')
  const filePath = path.join(process.cwd(), relativePath)
  await fs.unlink(filePath).catch(() => {})
}
