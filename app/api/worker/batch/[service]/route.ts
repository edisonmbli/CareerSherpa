import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { ENV } from '@/lib/env'
import { handleBatch } from '@/lib/worker/handlers'

const handler = verifySignatureAppRouter(
  async (
    req: Request,
    { params }: { params: Promise<{ service: string }> },
  ) => {
    const { service } = await params
    return handleBatch(req, { service })
  },
  {
    currentSigningKey: ENV.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: ENV.QSTASH_NEXT_SIGNING_KEY,
  },
)

export { handler as POST }
