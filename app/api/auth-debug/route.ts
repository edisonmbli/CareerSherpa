import { NextResponse } from 'next/server'
import { stackServerApp } from '@/stack/server'
import { isStackAuthReady } from '@/lib/env'
import { cookies, headers } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const hdrs = await headers()
  const ck = cookieStore.getAll().map((c) => ({ name: c.name }))
  const user = await stackServerApp.getUser()
  const xKey = hdrs.get('x-user-key') || null
  const xEmail = hdrs.get('x-user-email') || null
  return NextResponse.json({ ready: isStackAuthReady(), user, cookies: ck, xKey, xEmail })
}