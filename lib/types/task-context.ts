/**
 * Task Context Types
 *
 * Unified type system for task context across SSE events.
 * Supports Match, Customize, and Interview task types.
 */

export type TaskType = 'match' | 'customize' | 'interview'

/**
 * Task context containing all information needed to identify a task
 */
export interface TaskContext {
    taskType: TaskType
    serviceId: string
    sessionId: string
    taskId: string  // Built from above: `${taskType}_${serviceId}_${sessionId}`
}

/**
 * Build a taskId from its components
 *
 * @example
 * buildTaskId('customize', 'svc123', 'sess456')
 * // => 'customize_svc123_sess456'
 */
export function buildTaskId(
    type: TaskType,
    serviceId: string,
    sessionId: string
): string {
    return `${type}_${serviceId}_${sessionId}`
}

/**
 * Parse a taskId back into its components
 *
 * @returns TaskContext if valid, null if invalid format
 *
 * @example
 * parseTaskId('customize_svc123_sess456')
 * // => { taskType: 'customize', serviceId: 'svc123', sessionId: 'sess456', taskId: '...' }
 */
export function parseTaskId(taskId: string): TaskContext | null {
    if (!taskId) return null

    // Handle legacy format: match_serviceId_sessionId
    // New format: {taskType}_serviceId_sessionId
    const firstUnderscore = taskId.indexOf('_')
    if (firstUnderscore === -1) return null

    const prefix = taskId.substring(0, firstUnderscore)

    // Validate task type
    const validTypes: TaskType[] = ['match', 'customize', 'interview']
    // Also accept 'job' as legacy alias for 'match'
    const taskType: TaskType = prefix === 'job' ? 'match' : prefix as TaskType

    if (!validTypes.includes(taskType)) return null

    // Find second underscore to split serviceId and sessionId
    const rest = taskId.substring(firstUnderscore + 1)
    const secondUnderscore = rest.indexOf('_')

    if (secondUnderscore === -1) {
        // Legacy format without sessionId: match_serviceId
        return {
            taskType,
            serviceId: rest,
            sessionId: '',
            taskId,
        }
    }

    const serviceId = rest.substring(0, secondUnderscore)
    const sessionId = rest.substring(secondUnderscore + 1)

    return {
        taskType,
        serviceId,
        sessionId,
        taskId,
    }
}

/**
 * Check if a taskId matches a specific task type
 */
export function isTaskType(taskId: string, type: TaskType): boolean {
    const ctx = parseTaskId(taskId)
    return ctx?.taskType === type
}

/**
 * Get task type prefix from a taskId
 */
export function getTaskTypeFromId(taskId: string): TaskType | null {
    const ctx = parseTaskId(taskId)
    return ctx?.taskType ?? null
}
