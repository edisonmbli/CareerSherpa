/**
 * Edge Runtime Compatible Crypto Utilities
 * Uses Web Crypto API instead of Node.js crypto module
 */

/**
 * Get crypto object with fallback
 */
function getCrypto(): Crypto {
  if (typeof crypto !== 'undefined') {
    return crypto
  }
  throw new Error('Web Crypto API is not available in this environment')
}

/**
 * Generate secure hash for text using Web Crypto API
 */
export async function generateTextHash(text: string): Promise<string> {
  const cryptoObj = getCrypto()
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate secure hash for buffer using Web Crypto API
 */
export async function generateBufferHash(buffer: Uint8Array): Promise<string> {
  const cryptoObj = getCrypto()
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', buffer as BufferSource)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate random bytes using Web Crypto API
 */
export function generateRandomBytes(length: number): Uint8Array {
  const cryptoObj = getCrypto()
  return cryptoObj.getRandomValues(new Uint8Array(length))
}

/**
 * Generate UUID using Web Crypto API
 */
export function generateUUID(): string {
  const cryptoObj = getCrypto()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const randomArray = cryptoObj.getRandomValues(new Uint8Array(1))
    const r = (randomArray[0] ?? 0) % 16
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}