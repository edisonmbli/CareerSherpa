'use server'

/**
 * Job Image Upload Helper
 *
 * Handles the extraction, validation, and upload of base64-encoded job images.
 * Extracted from createServiceAction for reusability and clarity.
 */

import { uploadFile } from '@/lib/storage/upload'

export interface UploadJobImageResult {
    ok: true
    imageUrl: string
}

export interface UploadJobImageError {
    ok: false
    error: 'image_too_large' | 'image_upload_failed'
}

const MAX_IMAGE_BYTES = 3 * 1024 * 1024 // 3MB

/**
 * Uploads a base64-encoded job image to storage
 *
 * @param base64DataUrl - The base64 data URL (e.g., "data:image/png;base64,...")
 * @returns Upload result with imageUrl on success, or error object on failure
 */
export async function uploadJobImage(
    base64DataUrl: string
): Promise<UploadJobImageResult | UploadJobImageError> {
    try {
        const dataUrl = String(base64DataUrl)

        // Extract base64 data
        const comma = dataUrl.indexOf(',')
        const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
        const buffer = Buffer.from(base64, 'base64')
        const sizeBytes = buffer.length

        // Validate size
        if (sizeBytes > MAX_IMAGE_BYTES) {
            return { ok: false, error: 'image_too_large' }
        }

        // Detect MIME type from data URL header
        const mimeMatch = dataUrl.match(/^data:(image\/[a-z]+);base64,/)
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png'
        const ext = mimeType ? mimeType.split('/')[1] : 'png'

        // Generate unique filename
        const timestamp = Date.now()
        const random = Math.random().toString(36).slice(2)
        const finalFilename = `job_${timestamp}_${random}.${ext}`

        // Create File-like object for uploadFile
        const fileMock = {
            name: finalFilename,
            type: mimeType,
            size: sizeBytes,
            arrayBuffer: async () => new Uint8Array(buffer).buffer,
        } as unknown as File

        const imageUrl = await uploadFile(fileMock, finalFilename)

        return { ok: true, imageUrl }
    } catch {
        return { ok: false, error: 'image_upload_failed' }
    }
}
