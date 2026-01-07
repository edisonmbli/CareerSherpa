/**
 * Baidu OCR Service - High Precision Text Recognition
 * 
 * Uses Baidu Cloud OCR API for text extraction from images.
 * Token is cached in Redis with auto-refresh on expiry.
 */

import { getRedis } from '@/lib/redis/client'
import { logInfo, logError } from '@/lib/logger'
import { isProdRedisReady } from '@/lib/env'

// Baidu OCR API endpoints
const TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token'
const OCR_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic'

// Token cache configuration
const TOKEN_CACHE_KEY = 'baidu:ocr:access_token'
const TOKEN_REFRESH_BUFFER_SEC = 3600 // Refresh 1 hour before expiry

// In-memory fallback for local dev
let memoryToken: { token: string; expiresAt: number } | null = null

/**
 * Baidu OCR API response types
 */
interface BaiduOcrWord {
    words: string
}

interface BaiduOcrResponse {
    log_id?: number
    words_result_num?: number
    words_result?: BaiduOcrWord[]
    error_code?: number
    error_msg?: string
}

interface BaiduOcrResult {
    ok: boolean
    text?: string
    error?: string
    wordsCount?: number
}

/**
 * Get Baidu API credentials from environment
 */
function getCredentials(): { apiKey: string; secretKey: string } {
    const apiKey = process.env['BAIDU_API_KEY'] || ''
    const secretKey = process.env['BAIDU_SECRET_KEY'] || ''

    if (!apiKey || !secretKey) {
        throw new Error('BAIDU_API_KEY or BAIDU_SECRET_KEY not configured')
    }

    return { apiKey, secretKey }
}

/**
 * Fetch new access token from Baidu OAuth API
 */
async function fetchAccessToken(): Promise<{ token: string; expiresIn: number }> {
    const { apiKey, secretKey } = getCredentials()

    const url = `${TOKEN_URL}?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`

    const response = await fetch(url, { method: 'POST' })
    const data = await response.json()

    if (data.error) {
        throw new Error(`Baidu token error: ${data.error_description || data.error}`)
    }

    if (!data.access_token) {
        throw new Error('Baidu token response missing access_token')
    }

    return {
        token: data.access_token,
        expiresIn: data.expires_in || 2592000, // Default 30 days
    }
}

/**
 * Get access token with caching and auto-refresh
 * Uses Redis in production, memory fallback in development
 */
async function getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000)

    // Try Redis cache first (production)
    if (isProdRedisReady()) {
        try {
            const redis = getRedis()
            const cached = await redis.get(TOKEN_CACHE_KEY)

            if (cached && typeof cached === 'string') {
                const parsed = JSON.parse(cached)
                if (parsed.expiresAt > now + TOKEN_REFRESH_BUFFER_SEC) {
                    return parsed.token
                }
                // Token exists but will expire soon, refresh it
            }

            // Fetch new token
            const { token, expiresIn } = await fetchAccessToken()
            const expiresAt = now + expiresIn

            // Cache in Redis with TTL slightly less than expiry
            await redis.setex(
                TOKEN_CACHE_KEY,
                expiresIn - TOKEN_REFRESH_BUFFER_SEC,
                JSON.stringify({ token, expiresAt })
            )

            logInfo({
                reqId: 'baidu_ocr_token',
                route: 'baidu-ocr',
                userKey: 'system',
                message: 'Baidu OCR token refreshed',
                expiresIn,
            })

            return token
        } catch (error) {
            logError({
                reqId: 'baidu_ocr_token',
                route: 'baidu-ocr',
                userKey: 'system',
                error: String(error),
                phase: 'redis_cache',
            })
            // Fall through to memory fallback
        }
    }

    // Memory fallback for local development
    if (memoryToken && memoryToken.expiresAt > now + TOKEN_REFRESH_BUFFER_SEC) {
        return memoryToken.token
    }

    const { token, expiresIn } = await fetchAccessToken()
    memoryToken = { token, expiresAt: now + expiresIn }
    return token
}

/**
 * Extract text from image using Baidu OCR API
 * @param imageBase64 - Base64 encoded image (with or without data URL prefix)
 * @returns OCR result with extracted text
 */
export async function extractTextFromBaidu(imageBase64: string): Promise<BaiduOcrResult> {
    const startTime = Date.now()

    try {
        // Get access token (auto-refreshes if needed)
        const accessToken = await getAccessToken()

        // Strip data URL prefix if present
        const base64Content = imageBase64.includes(',')
            ? (imageBase64.split(',')[1] || '')
            : imageBase64

        // Prepare form data
        const params = new URLSearchParams()
        params.append('image', base64Content)
        // Optional: detect image orientation
        // params.append('detect_direction', 'true')

        // Call Baidu OCR API
        const ocrUrl = `${OCR_URL}?access_token=${accessToken}`
        const response = await fetch(ocrUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
            body: params,
        })

        const result: BaiduOcrResponse = await response.json()

        // Handle Baidu API errors
        if (result.error_code) {
            const errorMsg = `Baidu OCR error ${result.error_code}: ${result.error_msg}`
            logError({
                reqId: `baidu_ocr_${startTime}`,
                route: 'baidu-ocr',
                userKey: 'system',
                error: errorMsg,
                phase: 'ocr_call',
                durationMs: Date.now() - startTime,
            })

            return {
                ok: false,
                error: errorMsg,
            }
        }

        // Concatenate all recognized text lines
        const text = (result.words_result || [])
            .map((item) => item.words)
            .join('\n')

        logInfo({
            reqId: `baidu_ocr_${startTime}`,
            route: 'baidu-ocr',
            userKey: 'system',
            wordsCount: result.words_result_num || 0,
            textLength: text.length,
            durationMs: Date.now() - startTime,
        })

        return {
            ok: true,
            text,
            wordsCount: result.words_result_num || 0,
        }

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)

        logError({
            reqId: `baidu_ocr_${startTime}`,
            route: 'baidu-ocr',
            userKey: 'system',
            error: errorMsg,
            phase: 'ocr_exception',
            durationMs: Date.now() - startTime,
        })

        return {
            ok: false,
            error: errorMsg,
        }
    }
}

/**
 * Check if Baidu OCR is configured and ready to use
 */
export function isBaiduOcrReady(): boolean {
    return !!(process.env['BAIDU_API_KEY'] && process.env['BAIDU_SECRET_KEY'])
}
