import { NextResponse } from 'next/server'
import { stackServerApp } from '@/stack/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  // 认证
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
    let status: string | undefined

    switch (taskType) {
      case 'resume': {
        const rec = await prisma.resume.findFirst({
          where: { id: taskId, userId: user.id },
          select: { status: true },
        })
        status = rec?.status
        break
      }
      case 'detailed_resume': {
        const rec = await prisma.detailedResume.findFirst({
          where: { id: taskId, userId: user.id },
          select: { status: true },
        })
        status = rec?.status
        break
      }
      case 'service_match': {
        const service = await prisma.service.findFirst({
          where: { id: taskId, userId: user.id },
          select: {
            job: { select: { status: true } },
            match: { select: { status: true } },
          },
        })
        if (!service) {
          return NextResponse.json(
            { error: 'Task not found or permission denied' },
            { status: 404 }
          )
        }
        // 业务规则：Job 仍在 OCR，则整体为 PENDING；否则采用 Match 的状态
        status = service.job?.status === 'PENDING'
          ? 'PENDING'
          : service.match?.status || 'PENDING'
        break
      }
      case 'customize': {
        const rec = await prisma.customizedResume.findFirst({
          where: { id: taskId, service: { userId: user.id } },
          select: { status: true },
        })
        status = rec?.status
        break
      }
      case 'interview': {
        const rec = await prisma.interview.findFirst({
          where: { id: taskId, service: { userId: user.id } },
          select: { status: true },
        })
        status = rec?.status
        break
      }
      default:
        return NextResponse.json({ error: 'Invalid taskType' }, { status: 400 })
    }

    if (!status) {
      return NextResponse.json(
        { error: 'Task not found or permission denied' },
        { status: 404 }
      )
    }
    return NextResponse.json({ status })
  } catch (error) {
    console.error('TaskStatusError:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}