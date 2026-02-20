import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { stackServerApp } from '@/stack/server';
import { i18n, isSupportedLocale } from '@/i18n-config';
import { logInfo, logError } from '@/lib/logger';
import { generateUUID } from '@/lib/security/edge-crypto';
import { isStackAuthReady } from '@/lib/env';

function getLocale(request: NextRequest): string {
  // 1. 检查Cookie中的语言设置
  const cookieLang = request.cookies.get('lang')?.value;
  if (cookieLang && isSupportedLocale(cookieLang)) {
    return cookieLang;
  }

  // 2. 检查Accept-Language头
  const acceptLanguageHeader = request.headers.get('Accept-Language');
  if (acceptLanguageHeader) {
    // 解析Accept-Language头，获取首选语言
    const preferredLang = acceptLanguageHeader
      ?.split(',')[0]
      ?.split('-')[0]
      ?.toLowerCase() ?? '';
    
    if (preferredLang && isSupportedLocale(preferredLang)) {
      return preferredLang;
    }
  }

  // 3. 默认回退到英语
  return i18n.defaultLocale;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const reqId = generateUUID();

  const localeUploadsMatch = pathname.match(/^\/(en|zh)\/uploads\/(.+)/);
  if (localeUploadsMatch) {
    const targetPath = `/uploads/${localeUploadsMatch[2]}`;
    return NextResponse.rewrite(new URL(targetPath, request.url));
  }

  if (pathname.startsWith('/uploads/')) {
    return NextResponse.next();
  }

  // 检查路径是否已经包含locale
  const pathnameHasLocale = i18n.locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  // 如果路径不包含locale，进行重定向
  if (!pathnameHasLocale) {
    const locale = getLocale(request);
    const newUrl = new URL(`/${locale}${pathname}`, request.url);
    
    // 保持查询参数
    newUrl.search = request.nextUrl.search;
    
    return NextResponse.redirect(newUrl);
  }

  // 提取当前locale
  const currentLocale = pathname.split('/')[1];

  // 定义系统路径和公共资源（不需要认证）
  const isPublicAsset = pathname.startsWith('/_next/') || 
                       pathname.startsWith('/favicon.ico') ||
                       pathname.startsWith('/uploads/') ||
                       pathname.startsWith('/static/') ||
                       pathname.startsWith('/robots.txt') ||
                       pathname.startsWith('/sitemap.xml');
  
  // Stack Auth 处理页面（登录、注册等）
  const isStackAuthHandler = pathname.startsWith('/handler/');
  
  // 首页作为 landing page（唯一允许匿名访问的业务页面）
  const isLandingPage = pathname === `/${currentLocale}` || pathname === `/${currentLocale}/`;
  const isLocalAuthSignIn = pathname === `/${currentLocale}/auth/sign-in`;
  const isSharePage = pathname.startsWith(`/${currentLocale}/r/`);
  
  // 定义白名单：不需要认证的路径
  const isPublicPath =
    isPublicAsset ||
    isStackAuthHandler ||
    isLandingPage ||
    isLocalAuthSignIn ||
    isSharePage;

  // 默认保护模式：除了白名单，所有路径都需要认证
  const requiresAuth = !isPublicPath;

  if (requiresAuth) {
    // Fail-open when Stack Auth is not configured to avoid build-time errors
    if (!isStackAuthReady()) {
      return NextResponse.next();
    }
    try {
      // 使用Stack Auth验证用户
      const user = await stackServerApp.getUser();
      
      if (!user) {
        logInfo({
          reqId,
          route: pathname,
          userKey: 'anonymous',
          phase: 'auth_check',
          message: 'No authenticated user found'
        });

        // 检查是否为页面请求（非 API 路径）
        const isPageRequest = !pathname.startsWith('/api/');
        
        // 对于页面请求，重定向到当前 locale 的 Landing 页面
        if (isPageRequest) {
          const landingUrl = new URL(`/${currentLocale}`, request.url);
          landingUrl.searchParams.set('redirect', pathname);
          return NextResponse.redirect(landingUrl);
        }

        // 对于API请求，返回401错误
        return NextResponse.json(
          { error: 'unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
      }

      // 在请求头中添加用户信息，供API路由使用
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-key', user.id);
      requestHeaders.set('x-user-email', user.primaryEmail || '');
      requestHeaders.set('x-req-id', reqId);
      
      // 添加语言信息到请求头
      if (isSupportedLocale(currentLocale)) {
        requestHeaders.set('x-locale', currentLocale);
      }

      logInfo({
        reqId,
        route: pathname,
        userKey: user.id,
        phase: 'auth_success',
        message: 'Authentication successful'
      });

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (error) {
      logError({
        reqId,
        route: pathname,
        userKey: 'unknown',
        phase: 'auth_error',
        error: error instanceof Error ? error.message : 'Authentication failed'
      });

      // 检查是否为页面请求（非 API 路径）
      const isPageRequest = !pathname.startsWith('/api/');
      
      // 对于页面请求，重定向到错误页面
      if (isPageRequest) {
        const errorUrl = new URL('/handler/signin', request.url);
        errorUrl.searchParams.set('error', 'auth_failed');
        return NextResponse.redirect(errorUrl);
      }

      // 对于API请求，返回401错误
      return NextResponse.json(
        { error: 'auth_error', message: 'Authentication failed' },
        { status: 401 }
      );
    }
  }

  // 对于其他路径，添加语言信息到请求头
  const response = NextResponse.next();
  if (isSupportedLocale(currentLocale)) {
    response.headers.set('x-locale', currentLocale);
  }
  response.headers.set('x-req-id', reqId);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - handler (Stack Auth handler)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|handler|uploads).*)',
  ],
};
