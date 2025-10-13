import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth, ApiUser, ApiContext } from '@/lib/api/auth-wrapper'
import {
  createServiceWithOrchestration,
  ServiceCreationRequest,
} from '@/lib/services/service-orchestrator'

export const runtime = 'nodejs'

/**
 * 错误类型到状态码的映射
 */
const ERROR_STATUS_MAP: Record<string, number> = {
  missing_fields: 400,
  invalid_resume_or_job: 422,
  language_inconsistent: 422,
  too_many_pending_services: 429,
  internal_error: 500,
}

/**
 * 获取错误状态码
 */
function getErrorStatusCode(errorMessage: string): number {
  return ERROR_STATUS_MAP[errorMessage] || 500
}

/**
 * 处理服务创建请求
 */
async function handleServiceCreation(
  user: ApiUser,
  req: NextRequest,
  context: ApiContext
): Promise<NextResponse> {
  // 解析请求体
  const requestBody: ServiceCreationRequest = await req.json()
  
  // 验证必需字段
  if (!requestBody.resume_id || !requestBody.job_id) {
    throw new Error('missing_fields')
  }

  // 调用服务编排器
  const result = await createServiceWithOrchestration(
    requestBody,
    user.id,
    context.route
  )

  return NextResponse.json(
    { service_id: result.service_id },
    { status: 200 }
  )
}

export const POST = withApiAuth('/api/service/create', handleServiceCreation)
