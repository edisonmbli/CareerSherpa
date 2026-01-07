/**
 * Server-side image compression utility
 * 
 * Uses sharp for efficient image resizing and compression.
 * Required for Baidu OCR API which has a 4MB size limit.
 */

import sharp from 'sharp'
import { logInfo, logError } from '@/lib/logger'

interface CompressOptions {
    maxWidth?: number
    maxHeight?: number
    quality?: number
    format?: 'jpeg' | 'png' | 'webp'
}

interface CompressResult {
    ok: boolean
    base64?: string
    originalSize?: number
    compressedSize?: number
    error?: string
}

const DEFAULT_OPTIONS: CompressOptions = {
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 70,
    format: 'jpeg',
}

/**
 * Compress a base64 image for API submission
 * @param imageBase64 - Base64 encoded image (with or without data URL prefix)
 * @param options - Compression options
 * @returns Compressed image as base64 string (without data URL prefix)
 */
export async function compressImage(
    imageBase64: string,
    options: CompressOptions = {}
): Promise<CompressResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    try {
        // Strip data URL prefix if present
        const base64Content = imageBase64.includes(',')
            ? (imageBase64.split(',')[1] || '')
            : imageBase64

        // Convert base64 to buffer
        const inputBuffer = Buffer.from(base64Content, 'base64')
        const originalSize = inputBuffer.length

        // Get image metadata for smart resizing
        const metadata = await sharp(inputBuffer).metadata()
        const { width = 0, height = 0 } = metadata

        // Calculate resize dimensions maintaining aspect ratio
        let targetWidth = width
        let targetHeight = height

        if (opts.maxWidth && width > opts.maxWidth) {
            targetWidth = opts.maxWidth
            targetHeight = Math.round(height * (opts.maxWidth / width))
        }

        if (opts.maxHeight && targetHeight > opts.maxHeight) {
            targetHeight = opts.maxHeight
            targetWidth = Math.round(targetWidth * (opts.maxHeight / targetHeight))
        }

        // Build sharp pipeline
        let pipeline = sharp(inputBuffer)

        // Only resize if needed
        if (targetWidth !== width || targetHeight !== height) {
            pipeline = pipeline.resize(targetWidth, targetHeight, {
                fit: 'inside',
                withoutEnlargement: true,
            })
        }

        // Apply format-specific compression
        let outputBuffer: Buffer
        switch (opts.format) {
            case 'png':
                outputBuffer = await pipeline.png({ quality: opts.quality }).toBuffer()
                break
            case 'webp':
                outputBuffer = await pipeline.webp({ quality: opts.quality }).toBuffer()
                break
            case 'jpeg':
            default:
                outputBuffer = await pipeline.jpeg({ quality: opts.quality }).toBuffer()
                break
        }

        const compressedSize = outputBuffer.length
        const compressedBase64 = outputBuffer.toString('base64')

        logInfo({
            reqId: 'image_compress',
            route: 'image-compress',
            userKey: 'system',
            originalSize,
            compressedSize,
            ratio: (compressedSize / originalSize * 100).toFixed(1) + '%',
            dimensions: `${width}x${height} -> ${targetWidth}x${targetHeight}`,
        })

        return {
            ok: true,
            base64: compressedBase64,
            originalSize,
            compressedSize,
        }

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)

        logError({
            reqId: 'image_compress',
            route: 'image-compress',
            userKey: 'system',
            error: errorMsg,
            phase: 'compress',
        })

        return {
            ok: false,
            error: errorMsg,
        }
    }
}

/**
 * Check if image needs compression (exceeds size limit)
 * @param imageBase64 - Base64 encoded image
 * @param maxBytes - Maximum allowed size in bytes (default 4MB for Baidu)
 */
export function needsCompression(imageBase64: string, maxBytes: number = 4 * 1024 * 1024): boolean {
    const base64Content = imageBase64.includes(',')
        ? (imageBase64.split(',')[1] || '')
        : imageBase64

    // Base64 is ~33% larger than binary
    const estimatedBytes = (base64Content.length * 3) / 4
    return estimatedBytes > maxBytes
}

/**
 * Compress image only if it exceeds size limit
 */
export async function compressIfNeeded(
    imageBase64: string,
    maxBytes: number = 4 * 1024 * 1024,
    options: CompressOptions = {}
): Promise<string> {
    if (!needsCompression(imageBase64, maxBytes)) {
        // Return original (strip data URL prefix if present)
        return imageBase64.includes(',')
            ? (imageBase64.split(',')[1] || '')
            : imageBase64
    }

    const result = await compressImage(imageBase64, options)
    if (result.ok && result.base64) {
        return result.base64
    }

    // Fallback to original on compression failure
    return imageBase64.includes(',')
        ? (imageBase64.split(',')[1] || '')
        : imageBase64
}
