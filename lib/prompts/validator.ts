import { TemplateId, getTemplate } from './templates'

export interface ValidationResult {
  valid: boolean
  data?: unknown
  errors: string[]
  warnings: string[]
}

export interface ValidationOptions {
  strict?: boolean // Strict mode fails on warnings
  allowExtraFields?: boolean // Allow fields not in schema
  coerceTypes?: boolean // Try to convert types
}

/**
 * JSON Schema Validator for LLM Outputs
 */
export class OutputValidator {
  /**
   * Validate LLM output against template schema
   */
  validateOutput(
    templateId: TemplateId,
    output: string,
    options: ValidationOptions = {}
  ): ValidationResult {
    const template = getTemplate(templateId)
    const { strict = false, allowExtraFields = true, coerceTypes = true } = options

    const result: ValidationResult = {
      valid: false,
      errors: [],
      warnings: []
    }

    try {
      // Step 1: Parse JSON
      const parsed = this.parseJSON(output)
      if (!parsed.success) {
        result.errors.push(`JSON parsing failed: ${parsed.error}`)
        return result
      }

      let data = parsed.data

      // Step 2: Validate against schema
      if (template.outputSchema) {
        const schemaValidation = this.validateSchema(
          data,
          template.outputSchema,
          { allowExtraFields, coerceTypes }
        )
        
        result.errors.push(...schemaValidation.errors)
        result.warnings.push(...schemaValidation.warnings)
        
        if (schemaValidation.coercedData) {
          data = schemaValidation.coercedData
        }
      }

      // Step 3: Template-specific validation
      const templateValidation = this.validateTemplateSpecific(templateId, data)
      result.errors.push(...templateValidation.errors)
      result.warnings.push(...templateValidation.warnings)

      // Step 4: Determine validity
      result.valid = result.errors.length === 0 && (!strict || result.warnings.length === 0)
      if (result.valid) {
        result.data = data
      }

      return result
    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`)
      return result
    }
  }

  /**
   * Parse JSON with error handling
   */
  private parseJSON(output: string): { success: boolean; data?: unknown; error?: string } {
    try {
      // Try to extract JSON from response (handle cases where LLM adds extra text)
      const jsonMatch = output.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return { success: false, error: 'No JSON object found in output' }
      }

      const data = JSON.parse(jsonMatch[0])
      return { success: true, data }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown parsing error' 
      }
    }
  }

  /**
   * Validate data against JSON schema
   */
  private validateSchema(
    data: unknown,
    schema: Record<string, unknown>,
    options: { allowExtraFields: boolean; coerceTypes: boolean }
  ): { errors: string[]; warnings: string[]; coercedData?: Record<string, unknown> } {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Type guard to ensure data is an object
    if (typeof data !== 'object' || data === null) {
      errors.push('Data must be an object')
      return { errors, warnings }
    }
    
    const dataObj = data as Record<string, unknown>
    const coercedData = { ...dataObj }

    if (schema['type'] === 'object') {
      // Check required fields
      if (Array.isArray(schema['required'])) {
        for (const field of schema['required']) {
          if (typeof field === 'string' && !(field in dataObj)) {
            errors.push(`Missing required field: ${field}`)
          }
        }
      }

      // Check field types and values
      if (schema['properties'] && typeof schema['properties'] === 'object') {
        for (const [field, fieldSchema] of Object.entries(schema['properties'])) {
          if (field in dataObj) {
            const fieldValidation = this.validateField(dataObj[field], fieldSchema, field, options)
            errors.push(...fieldValidation.errors)
            warnings.push(...fieldValidation.warnings)
            
            if (fieldValidation.coercedValue !== undefined) {
              coercedData[field] = fieldValidation.coercedValue
            }
          }
        }
      }

      // Check for extra fields
      if (!options.allowExtraFields) {
        const allowedFields = schema['properties'] && typeof schema['properties'] === 'object' 
          ? Object.keys(schema['properties']) 
          : []
        const extraFields = Object.keys(dataObj).filter(field => !allowedFields.includes(field))
        if (extraFields.length > 0) {
          warnings.push(`Extra fields found: ${extraFields.join(', ')}`)
        }
      }
    }

    const result: { errors: string[]; warnings: string[]; coercedData?: Record<string, unknown> } = { errors, warnings }
    
    if (JSON.stringify(coercedData) !== JSON.stringify(dataObj)) {
      result.coercedData = coercedData
    }
    
    return result
  }

  /**
   * Validate individual field
   */
  private validateField(
    value: unknown,
    schema: unknown,
    fieldName: string,
    options: { coerceTypes: boolean }
  ): { errors: string[]; warnings: string[]; coercedValue?: unknown } {
    const errors: string[] = []
    const warnings: string[] = []
    let coercedValue: unknown

    // Type guard for schema
    if (typeof schema !== 'object' || schema === null) {
      return { errors, warnings, coercedValue: value }
    }

    const schemaObj = schema as Record<string, unknown>

    // Type validation
    if (schemaObj['type']) {
      const actualType = Array.isArray(value) ? 'array' : typeof value
      const expectedType = schemaObj['type'] as string
      
      if (actualType !== expectedType) {
        if (options.coerceTypes) {
          const coerced = this.coerceType(value, expectedType)
          if (coerced.success) {
            coercedValue = coerced.value
            warnings.push(`Type coerced for ${fieldName}: ${actualType} -> ${expectedType}`)
          } else {
            errors.push(`Invalid type for ${fieldName}: expected ${expectedType}, got ${actualType}`)
          }
        } else {
          errors.push(`Invalid type for ${fieldName}: expected ${expectedType}, got ${actualType}`)
        }
      }
    }

    // Enum validation
    if (schemaObj['enum'] && Array.isArray(schemaObj['enum']) && !schemaObj['enum'].includes(value)) {
      errors.push(`Invalid value for ${fieldName}: must be one of ${(schemaObj['enum'] as unknown[]).join(', ')}`)
    }

    // Number constraints
    if (schemaObj['type'] === 'number') {
      const numValue = coercedValue !== undefined ? coercedValue : value
      if (typeof numValue === 'number') {
        if (schemaObj['minimum'] !== undefined && numValue < (schemaObj['minimum'] as number)) {
          errors.push(`${fieldName} must be >= ${schemaObj['minimum']}`)
        }
        if (schemaObj['maximum'] !== undefined && numValue > (schemaObj['maximum'] as number)) {
          errors.push(`${fieldName} must be <= ${schemaObj['maximum']}`)
        }
      }
    }

    // Array validation
    if (schemaObj['type'] === 'array') {
      const arrValue = coercedValue !== undefined ? coercedValue : value
      if (Array.isArray(arrValue)) {
        if (schemaObj['minItems'] !== undefined && arrValue.length < (schemaObj['minItems'] as number)) {
          errors.push(`${fieldName} must have at least ${schemaObj['minItems']} items`)
        }
        if (schemaObj['maxItems'] !== undefined && arrValue.length > (schemaObj['maxItems'] as number)) {
          errors.push(`${fieldName} must have at most ${schemaObj['maxItems']} items`)
        }
        
        // Validate array items
        if (schemaObj['items']) {
          arrValue.forEach((item, index) => {
            const itemValidation = this.validateField(
              item,
              schemaObj['items'],
              `${fieldName}[${index}]`,
              options
            )
            errors.push(...itemValidation.errors)
            warnings.push(...itemValidation.warnings)
          })
        }
      }
    }

    return { errors, warnings, coercedValue }
  }

  /**
   * Type coercion
   */
  private coerceType(value: any, targetType: string): { success: boolean; value?: any } {
    try {
      switch (targetType) {
        case 'string':
          return { success: true, value: String(value) }
        
        case 'number':
          const num = Number(value)
          return { success: !isNaN(num), value: num }
        
        case 'boolean':
          if (typeof value === 'string') {
            const lower = value.toLowerCase()
            if (lower === 'true' || lower === '1') return { success: true, value: true }
            if (lower === 'false' || lower === '0') return { success: true, value: false }
          }
          return { success: false }
        
        case 'array':
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value)
              return { success: Array.isArray(parsed), value: parsed }
            } catch {
              return { success: false }
            }
          }
          return { success: false }
        
        default:
          return { success: false }
      }
    } catch {
      return { success: false }
    }
  }

  /**
   * Template-specific validation rules
   */
  private validateTemplateSpecific(templateId: TemplateId, data: any): { errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []

    switch (templateId) {
      case 'job_match':
        // Score should be reasonable
        if (data.score !== undefined) {
          if (data.score < 0 || data.score > 100) {
            errors.push('Score must be between 0 and 100')
          }
          if (data.score % 1 !== 0) {
            warnings.push('Score should be an integer')
          }
        }
        
        // Arrays should not be empty
        if (data.highlights && data.highlights.length === 0) {
          warnings.push('Highlights array is empty')
        }
        if (data.gaps && data.gaps.length === 0) {
          warnings.push('Gaps array is empty')
        }
        break

      case 'resume_edit':
        // Operations should have valid types
        if (data.ops && Array.isArray(data.ops)) {
          data.ops.forEach((op: any, index: number) => {
            if (!op.type) {
              errors.push(`Operation ${index} missing type`)
            }
            if (op.type === 'move' && (!op.from || !op.to)) {
              errors.push(`Move operation ${index} missing from/to`)
            }
            if (!op.reason) {
              warnings.push(`Operation ${index} missing reason`)
            }
          })
        }
        break

      case 'interview_prep':
        // Check intro length
        if (data.intro && data.intro.length > 500) {
          warnings.push('Introduction is too long (>500 characters)')
        }
        
        // Check QA items count
        if (data.qa_items && data.qa_items.length > 20) {
          warnings.push('Too many QA items (>20)')
        }
        if (data.qa_items && data.qa_items.length < 5) {
          warnings.push('Too few QA items (<5)')
        }
        break

      case 'resume_summary':
      case 'job_summary':
        // Check for empty arrays
        if (data.skills && data.skills.length === 0) {
          warnings.push('Skills array is empty')
        }
        if (data.experience && data.experience.length === 0) {
          warnings.push('Experience array is empty')
        }
        break
    }

    return { errors, warnings }
  }

  /**
   * Validate and fix common LLM output issues
   */
  autoFix(templateId: TemplateId, output: string): { fixed: string; changes: string[] } {
    const changes: string[] = []
    let fixed = output

    // Fix common JSON issues
    fixed = this.fixCommonJSONIssues(fixed, changes)
    
    // Template-specific fixes
    fixed = this.applyTemplateSpecificFixes(templateId, fixed, changes)

    return { fixed, changes }
  }

  /**
   * Fix common JSON formatting issues
   */
  private fixCommonJSONIssues(output: string, changes: string[]): string {
    let fixed = output

    // Remove markdown code blocks
    if (fixed.includes('```json')) {
      fixed = fixed.replace(/```json\s*|\s*```/g, '')
      changes.push('Removed markdown code blocks')
    }

    // Fix trailing commas
    if (fixed.includes(',}') || fixed.includes(',]')) {
      fixed = fixed.replace(/,(\s*[}\]])/g, '$1')
      changes.push('Removed trailing commas')
    }

    // Fix single quotes to double quotes
    if (fixed.includes("'")) {
      fixed = fixed.replace(/'/g, '"')
      changes.push('Converted single quotes to double quotes')
    }

    return fixed
  }

  /**
   * Apply template-specific fixes
   */
  private applyTemplateSpecificFixes(templateId: TemplateId, output: string, changes: string[]): string {
    // Template-specific fixes can be added here
    return output
  }
}

// Global validator instance
export const outputValidator = new OutputValidator()

/**
 * Convenience function to validate LLM output
 */
export function validateLLMOutput(
  templateId: TemplateId,
  output: string,
  options?: ValidationOptions
): ValidationResult {
  return outputValidator.validateOutput(templateId, output, options)
}

/**
 * Convenience function to validate and auto-fix LLM output
 */
export function validateAndFix(
  templateId: TemplateId,
  output: string,
  options?: ValidationOptions
): ValidationResult & { fixed?: string; changes?: string[] } {
  // First try auto-fix
  const { fixed, changes } = outputValidator.autoFix(templateId, output)
  
  // Then validate
  const result = outputValidator.validateOutput(templateId, fixed, options)
  
  const finalResult: ValidationResult & { fixed?: string; changes?: string[] } = { ...result }
  
  if (changes.length > 0) {
    finalResult.fixed = fixed
    finalResult.changes = changes
  }
  
  return finalResult
}