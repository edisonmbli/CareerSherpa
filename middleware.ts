import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { i18n, isSupportedLocale } from './i18n-config'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  const hasLocale = i18n.locales.some((l) => pathname.startsWith(`/${l}`))
  if (!hasLocale) {
    const url = req.nextUrl.clone()
    url.pathname = `/${i18n.defaultLocale}${pathname}`
    return NextResponse.rewrite(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}