
interface ErrorDicts {
    statusText?: {
        daily_limit?: string
        frequency_limit?: string
        [key: string]: any
    }
    notification?: {
        rateLimitedTitle?: string
        rateLimitedDesc?: string
        dailyLimitDesc?: string
        serverErrorTitle?: string
        serverErrorDesc?: string
        [key: string]: any
    }
}

/**
 * consistently maps error codes (e.g. from Server Actions) to localized UI titles and descriptions.
 */
export function getServiceErrorMessage(
    errorCode: string,
    dicts: ErrorDicts
): { title: string; description: string } {
    switch (errorCode) {
        case 'rate_limited':
            return {
                title: dicts.notification?.rateLimitedTitle || 'Request Rate Limited',
                description: dicts.notification?.rateLimitedDesc || 'System is busy.',
            }
        case 'daily_limit':
            return {
                // "Daily limit reached" is usually in statusText
                title: dicts.statusText?.daily_limit || 'Daily limit reached',
                description: dicts.notification?.dailyLimitDesc || '',
            }
        case 'frequency_limit':
            return {
                // "Too many requests! Take a short coffee break ☕️"
                title: dicts.statusText?.frequency_limit || 'Take a break ☕️',
                description: '', // The title is self-explanatory and "humanized"
            }
        default:
            return {
                title: dicts.notification?.serverErrorTitle || 'Service Unavailable',
                description:
                    errorCode && errorCode !== 'undefined'
                        ? errorCode
                        : dicts.notification?.serverErrorDesc || 'Unknown error',
            }
    }
}
