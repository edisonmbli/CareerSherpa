'use client'

import * as Sentry from '@sentry/nextjs'
import { getWebSentryOptions } from '@/lib/sentry/config'

const options = getWebSentryOptions()

Sentry.init({
  ...options,
  sendDefaultPii: false,
})
