// 标准化 Pub/Sub 频道命名，确保跨模块一致

export function buildEventChannel(userId: string, serviceId: string, taskId: string) {
  return `cs:events:${userId}:${serviceId}:${taskId}`
}

export function buildControlChannel(userId: string, serviceId: string, taskId: string) {
  return `cs:control:${userId}:${serviceId}:${taskId}`
}

// Redis Streams 缓冲区键（用于 SSE 轮询桥接）
export function buildEventStreamKey(userId: string, serviceId: string, taskId: string) {
  return `${buildEventChannel(userId, serviceId, taskId)}:stream`
}