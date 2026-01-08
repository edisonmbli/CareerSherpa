/**
 * Token Usage Extraction Helpers
 *
 * Robust extraction of inputTokens/outputTokens from heterogeneous
 * LLM provider responses (message metadata, model objects).
 */

/**
 * Extract token usage from an AI message response.
 * Handles multiple provider response formats.
 *
 * @param msg - The AI message object (AIMessage, BaseMessage, etc.)
 * @returns Object with inputTokens and outputTokens
 */
export function extractTokenUsageFromMessage(msg: any): {
    inputTokens: number
    outputTokens: number
} {
    const usage =
        msg?.response_metadata?.tokenUsage ||
        msg?.response_metadata?.token_usage ||
        msg?.additional_kwargs?.usage ||
        msg?.metadata?.usage

    const inputTokens =
        usage?.prompt_tokens ?? usage?.input_tokens ?? usage?.promptTokens ?? 0
    const outputTokens =
        usage?.completion_tokens ??
        usage?.output_tokens ??
        usage?.completionTokens ??
        0
    return {
        inputTokens: Number(inputTokens) || 0,
        outputTokens: Number(outputTokens) || 0,
    }
}

/**
 * Extract token usage from a model object (alternative extraction path).
 *
 * @param model - The model object with potential usage metadata
 * @returns Object with inputTokens and outputTokens
 */
export function extractTokenUsageFromModel(model: any): {
    inputTokens: number
    outputTokens: number
} {
    const usage =
        model?.lc_serializable?.tokenUsage ||
        model?.lc_serializable?.token_usage ||
        model?.tokenUsage
    const inputTokens =
        usage?.promptTokens ?? usage?.prompt_tokens ?? usage?.input_tokens ?? 0
    const outputTokens =
        usage?.completionTokens ??
        usage?.completion_tokens ??
        usage?.output_tokens ??
        0
    return {
        inputTokens: Number(inputTokens) || 0,
        outputTokens: Number(outputTokens) || 0,
    }
}
