import type { Metadata } from 'next'
import {
  Geist,
  Geist_Mono,
  Roboto,
  Noto_Serif,
  Noto_Sans_SC,
  Noto_Serif_SC,
  Lato,
  Open_Sans,
  Playfair_Display,
  JetBrains_Mono,
} from 'next/font/google'
import { StackProvider, StackTheme } from '@stackframe/stack'
import { stackServerApp } from '@/stack/server'
import { isStackAuthReady } from '@/lib/env'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Analytics } from '@vercel/analytics/react'
import SiteHeaderServer from '@/components/app/SiteHeaderServer'
import { ThemeProvider } from '@/components/app/ThemeProvider'
import { isSupportedLocale } from '@/i18n-config'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// Resume Fonts
const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-roboto',
})

const notoSerif = Noto_Serif({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-noto-serif',
})

const notoSansSc = Noto_Sans_SC({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-noto-sans-sc',
})

const notoSerifSc = Noto_Serif_SC({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-noto-serif-sc',
})

const lato = Lato({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-lato',
})

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
  title: 'AI CareerSherpa',
  description: 'Your AI-powered career coach for resume matching, customization, and interview prep.',
}

// 定义主题配置
const theme = {
  light: {
    background: '#f8fafc',
    foreground: '#0f172a',
    card: '#ffffff',
    cardForeground: '#0f172a',
    popover: '#ffffff',
    popoverForeground: '#0f172a',
    primary: '#0EA5E9',
    primaryForeground: '#f8fafc',
    secondary: '#f1f5f9',
    secondaryForeground: '#0f172a',
    muted: '#f8fafc',
    mutedForeground: '#64748b',
    accent: '#eef2ff',
    accentForeground: '#0f172a',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    border: '#94a3b8',
    input: '#e2e8f0',
    ring: '#38bdf8',
  },
  dark: {
    background: '#020617',
    foreground: '#e2e8f0',
    card: '#0f172a',
    cardForeground: '#f8fafc',
    popover: '#0f172a',
    popoverForeground: '#f8fafc',
    primary: '#22C55E',
    primaryForeground: '#052e16',
    secondary: '#111827',
    secondaryForeground: '#e2e8f0',
    muted: '#0f172a',
    mutedForeground: '#94a3b8',
    accent: '#0b1120',
    accentForeground: '#f8fafc',
    destructive: '#f87171',
    destructiveForeground: '#020617',
    border: '#475569',
    input: '#0f172a',
    ring: '#22c55e',
  },
  radius: '14px',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const h = await headers()
  const locale = h.get('x-locale')
  const resolvedLocale = isSupportedLocale(locale ?? undefined)
    ? (locale ?? 'en')
    : 'en'
  const stackLang = resolvedLocale === 'zh' ? 'zh-CN' : 'en-US'
  const translationOverrides =
    resolvedLocale === 'zh'
      ? {
          'Sign in to your account': '登录你的账户',
          'Create a new account': '创建新账户',
          'Sign in': '登录',
          'Sign up': '注册',
          "Don't have an account?": '还没有账号？',
          'Already have an account?': '已经有账号了？',
          'Or continue with': '或继续使用',
          'Email & Password': '邮箱和密码',
          Email: '邮箱',
          Password: '密码',
          'Forgot password?': '忘记密码？',
          'Sign in with {provider}': '使用 {provider} 登录',
          'Sign up with {provider}': '使用 {provider} 注册',
          'Enter email': '输入邮箱',
        }
      : undefined
  return (
    <html lang={resolvedLocale} suppressHydrationWarning>
      <body
        className={`
          ${geistSans.variable} 
          ${geistMono.variable} 
          ${roboto.variable}
          ${notoSerif.variable}
          ${notoSansSc.variable}
          ${notoSerifSc.variable}
          ${lato.variable}
          ${openSans.variable}
          ${playfair.variable}
          ${jetbrainsMono.variable}
          antialiased
        `}
      >
        <ThemeProvider>
          {isStackAuthReady() ? (
            <StackProvider
              app={stackServerApp}
              lang={stackLang}
              {...(translationOverrides
                ? { translationOverrides }
                : {})}
            >
              <StackTheme theme={theme}>
                <TooltipProvider>
                  <Suspense fallback={<div>Loading...</div>}>
                    <SiteHeaderServer />
                    {children}
                  </Suspense>
                  <Toaster />
                  <Analytics />
                </TooltipProvider>
              </StackTheme>
            </StackProvider>
          ) : (
            <TooltipProvider>
              <Suspense fallback={<div>Loading...</div>}>
                <SiteHeaderServer />
                {children}
              </Suspense>
              <Toaster />
              <Analytics />
            </TooltipProvider>
          )}
        </ThemeProvider>
      </body>
    </html>
  )
}
