import { z } from 'zod'
import { i18n, type Locale } from '@/i18n-config'

export const workerBodySchema = z.object({
  taskId: z.string().min(1),
  userId: z.string().min(1),
  serviceId: z.string().min(1),
  locale: z.enum(i18n.locales as readonly [Locale, ...Locale[]]),
  templateId: z.string().min(1),
  variables: z.record(z.any()).default({}),
  enqueuedAt: z.number().optional(),
  retryCount: z.number().optional(),
})

export type WorkerBody = z.infer<typeof workerBodySchema>

