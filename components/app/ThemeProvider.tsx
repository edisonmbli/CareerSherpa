'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

/**
 * @desc Wraps the app with next-themes ThemeProvider.
 *  - attribute="class" applies the theme as a class on <html> (e.g. 'dark')
 *  - defaultTheme="system" causes new users to inherit their OS preference
 *  - enableSystem enables the matchMedia('prefers-color-scheme') detection
 *  - disableTransitionOnChange prevents color flash during hydration
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            {children}
        </NextThemesProvider>
    )
}
