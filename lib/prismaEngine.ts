/**
 * Ensure Prisma uses the binary engine to avoid TLS/SNI/IPv6 quirks.
 * This file must be imported BEFORE '@prisma/client'.
 */
if (!process.env['PRISMA_CLIENT_ENGINE_TYPE']) {
  process.env['PRISMA_CLIENT_ENGINE_TYPE'] = 'binary'
}