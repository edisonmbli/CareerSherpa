import { NextResponse } from 'next/server'
import { stackServerApp } from '@/stack/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const user = await stackServerApp.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')
  const taskType = searchParams.get('taskType')

  if (!taskId || !taskType) {
    return NextResponse.json(
      { error: 'Missing taskId or taskType' },
      { status: 400 }
    )
  }

  try {
    if (taskType === 'resume') {
      const rec = await prisma.resume.findFirst({
        where: { id: taskId, userId: user.id },
        select: { status: true, updatedAt: true },
      })
      if (!rec?.status) {
        return NextResponse.json(
          { error: 'Task not found or permission denied' },
          { status: 404 }
        )
      }
      const lastUpdatedAt = rec.updatedAt ? new Date(rec.updatedAt).toISOString() : undefined
      const etag = `${rec.status}|${lastUpdatedAt || ''}`
      const inm = request.headers.get('if-none-match')
      if (inm && inm === etag) {
        const res = new NextResponse(null, { status: 304 })
        res.headers.set('etag', etag)
        return res
      }
      return NextResponse.json({ status: rec.status, lastUpdatedAt }, { headers: { etag } })
    }

    if (taskType === 'detailed_resume') {
      const rec = await prisma.detailedResume.findFirst({
        where: { id: taskId, userId: user.id },
        select: { status: true, updatedAt: true },
      })
      if (!rec?.status) {
        return NextResponse.json(
          { error: 'Task not found or permission denied' },
          { status: 404 }
        )
      }
      const lastUpdatedAt = rec.updatedAt ? new Date(rec.updatedAt).toISOString() : undefined
      const etag = `${rec.status}|${lastUpdatedAt || ''}`
      const inm = request.headers.get('if-none-match')
      if (inm && inm === etag) {
        const res = new NextResponse(null, { status: 304 })
        res.headers.set('etag', etag)
        return res
      }
      return NextResponse.json({ status: rec.status, lastUpdatedAt }, { headers: { etag } })
    }

    if (taskType === 'service_match') {
      const service = await prisma.service.findFirst({
        where: { id: taskId, userId: user.id },
        select: {
          job: { select: { status: true } },
          match: { select: { status: true } },
          updatedAt: true,
        },
      })
      if (!service) {
        return NextResponse.json(
          { error: 'Task not found or permission denied' },
          { status: 404 }
        )
      }
      const status = service.job?.status === 'PENDING' ? 'PENDING' : service.match?.status || 'PENDING'
      const lastUpdatedAt = service.updatedAt ? new Date(service.updatedAt).toISOString() : undefined
      const etag = `${status}|${lastUpdatedAt || ''}`
      const inm = request.headers.get('if-none-match')
      if (inm && inm === etag) {
        const res = new NextResponse(null, { status: 304 })
        res.headers.set('etag', etag)
        return res
      }
      return NextResponse.json({ status, lastUpdatedAt }, { headers: { etag } })
    }

    if (taskType === 'customize') {
      const rec = await prisma.customizedResume.findFirst({
        where: { id: taskId, service: { userId: user.id } },
        select: { status: true, updatedAt: true },
      })
      if (!rec?.status) {
        return NextResponse.json(
          { error: 'Task not found or permission denied' },
          { status: 404 }
        )
      }
      const lastUpdatedAt = rec.updatedAt ? new Date(rec.updatedAt).toISOString() : undefined
      const etag = `${rec.status}|${lastUpdatedAt || ''}`
      const inm = request.headers.get('if-none-match')
      if (inm && inm === etag) {
        const res = new NextResponse(null, { status: 304 })
        res.headers.set('etag', etag)
        return res
      }
      return NextResponse.json({ status: rec.status, lastUpdatedAt }, { headers: { etag } })
    }

    if (taskType === 'interview') {
      const rec = await prisma.interview.findFirst({
        where: { id: taskId, service: { userId: user.id } },
        select: { status: true, updatedAt: true },
      })
      if (!rec?.status) {
        return NextResponse.json(
          { error: 'Task not found or permission denied' },
          { status: 404 }
        )
      }
      const lastUpdatedAt = rec.updatedAt ? new Date(rec.updatedAt).toISOString() : undefined
      const etag = `${rec.status}|${lastUpdatedAt || ''}`
      const inm = request.headers.get('if-none-match')
      if (inm && inm === etag) {
        const res = new NextResponse(null, { status: 304 })
        res.headers.set('etag', etag)
        return res
      }
      return NextResponse.json({ status: rec.status, lastUpdatedAt }, { headers: { etag } })
    }

    return NextResponse.json({ error: 'Invalid taskType' }, { status: 400 })
  } catch (error) {
    console.error('TaskStatusError:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}