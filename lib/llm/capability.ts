/**
 * LLM Model Capability and Schema Compatibility Checks
 *
 * Decoupled logic for determining if a model/schema combination
 * supports structured output via tool calling.
 */

import type { ZodTypeAny } from 'zod'

/**
 * Check if the given model supports `withStructuredOutput`.
 * @param modelId - The model identifier (e.g., 'gemini-3-flash-preview', 'deepseek-chat')
 * @returns true if the model is verified to support structured output
 */
export function isModelCapable(modelId: string): boolean {
    // DeepSeek Reasoner (R1) does NOT support tool_choice / structured output
    // Error: "400 deepseek-reasoner does not support this tool_choice"
    if (modelId === 'deepseek-reasoner') {
        return false
    }
    // Gemini and DeepSeek Chat are verified to work with withStructuredOutput
    return modelId.startsWith('gemini') || modelId.startsWith('deepseek')
}

/**
 * Check if the given Zod schema is compatible with tool calling.
 * Tool calling APIs require a root-level object schema (`type: "object"`).
 * ZodUnion produces `type: null` which is incompatible.
 *
 * @param schema - The Zod schema to check
 * @returns true if the schema can be used with tool calling
 */
export function isSchemaToolCallable(schema: ZodTypeAny): boolean {
    // Access Zod's internal definition to detect union types
    const typeName = (schema as any)?._def?.typeName
    // ZodUnion and ZodDiscriminatedUnion are not compatible with tool calling
    return typeName !== 'ZodUnion' && typeName !== 'ZodDiscriminatedUnion'
}

/**
 * Determine if structured output should be used for this model + schema combination.
 * @param modelId - The model identifier
 * @param schema - The Zod schema for the task
 * @returns true if structured output should be used
 */
export function shouldUseStructuredOutput(
    modelId: string,
    schema: ZodTypeAny
): boolean {
    return isModelCapable(modelId) && isSchemaToolCallable(schema)
}
