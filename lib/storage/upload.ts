import { put } from '@vercel/blob'
import path from 'path'
import fs from 'fs/promises'
import { ENV } from '@/lib/env'

export async function uploadFile(file: File, filename: string): Promise<string> {
  // Determine environment
  // VERCEL_ENV is set by Vercel platform (production, preview, development)
  // NODE_ENV is standard
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env['VERCEL_ENV']

  if (isProduction) {
    // === Production: Upload to Vercel Blob ===
    // 'public' access means the file can be accessed publicly
    // Note: BLOB_READ_WRITE_TOKEN env var must be set
    const blob = await put(filename, file, {
      access: 'public',
    })

    // Return Vercel Blob URL
    return blob.url
  } else {
    // === Local Development: Save to local disk ===

    // 1. Determine save path (e.g., public/uploads)
    // Ensure public/uploads exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')

    // Ensure directory exists
    try {
      await fs.access(uploadDir)
    } catch {
      await fs.mkdir(uploadDir, { recursive: true })
    }

    const filePath = path.join(uploadDir, filename)

    // 2. Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // 3. Write file
    await fs.writeFile(filePath, buffer)

    // 4. Return local URL
    // Assuming local server runs on localhost, relative path works for <img> tags
    // But for Worker to access it (if worker is also local), it needs absolute URL or path?
    // Worker usually runs in the same Next.js instance in dev mode.
    // If worker needs to fetch() it, it needs full URL.
    // If worker reads file directly, it needs path.
    // However, standardized interface returns URL.
    // Local URL: /uploads/filename
    const baseUrl = ENV.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000'
    const normalizedBase = baseUrl.replace(/\/$/, '')
    return `${normalizedBase}/uploads/${filename}`
  }
}
