/**
 * Unit Tests for uploadJobImage helper
 *
 * Tests the image validation and upload logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the upload module
vi.mock('@/lib/storage/upload', () => ({
    uploadFile: vi.fn(),
}))

describe('uploadJobImage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('validation', () => {
        it('should reject images over 3MB', async () => {
            // Create a base64 string that represents > 3MB
            // 3MB = 3 * 1024 * 1024 bytes = 3,145,728 bytes
            // Base64 encoding increases size by ~33%, so we need ~4.2MB of base64
            const largeBase64 = 'A'.repeat(4_200_000)
            const dataUrl = `data:image/png;base64,${largeBase64}`

            const { uploadJobImage } = await import('@/lib/actions/helpers/uploadJobImage')
            const result = await uploadJobImage(dataUrl)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toBe('image_too_large')
            }
        })

        it('should extract MIME type from data URL', async () => {
            const { uploadFile } = await import('@/lib/storage/upload')
            const mockUpload = vi.mocked(uploadFile)
            mockUpload.mockResolvedValue('https://example.com/image.jpg')

            // Small valid base64 image
            const smallBase64 = Buffer.from('test').toString('base64')
            const dataUrl = `data:image/jpeg;base64,${smallBase64}`

            const { uploadJobImage } = await import('@/lib/actions/helpers/uploadJobImage')
            const result = await uploadJobImage(dataUrl)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.imageUrl).toBe('https://example.com/image.jpg')
            }

            // Check that uploadFile was called with a file mock
            expect(mockUpload).toHaveBeenCalledTimes(1)
            const [fileMock] = mockUpload.mock.calls[0]
            expect((fileMock as any).type).toBe('image/jpeg')
        })

        it('should default to PNG when no MIME type in data URL', async () => {
            const { uploadFile } = await import('@/lib/storage/upload')
            const mockUpload = vi.mocked(uploadFile)
            mockUpload.mockResolvedValue('https://example.com/image.png')

            // Base64 without data URL prefix
            const smallBase64 = Buffer.from('test').toString('base64')

            const { uploadJobImage } = await import('@/lib/actions/helpers/uploadJobImage')
            const result = await uploadJobImage(smallBase64)

            expect(result.ok).toBe(true)
            const [fileMock] = mockUpload.mock.calls[0]
            expect((fileMock as any).type).toBe('image/png')
        })
    })

    describe('error handling', () => {
        it('should return error when upload fails', async () => {
            const { uploadFile } = await import('@/lib/storage/upload')
            const mockUpload = vi.mocked(uploadFile)
            mockUpload.mockRejectedValue(new Error('Network error'))

            const smallBase64 = Buffer.from('test').toString('base64')
            const dataUrl = `data:image/png;base64,${smallBase64}`

            const { uploadJobImage } = await import('@/lib/actions/helpers/uploadJobImage')
            const result = await uploadJobImage(dataUrl)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toBe('image_upload_failed')
            }
        })
    })
})
