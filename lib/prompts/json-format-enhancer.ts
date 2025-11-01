/**
 * JSON Format Enhancer for LLM Prompts
 * 
 * 这个模块专门用于增强 prompt 模板中的 JSON 格式指导，
 * 提高 LLM 输出 JSON 的稳定性和验证通过率。
 */

import type { PromptTemplate } from './templates'

/**
 * JSON 格式增强配置
 */
export interface JsonFormatConfig {
  // 是否启用严格模式（更详细的格式指导）
  strictMode?: boolean
  // 是否包含示例输出
  includeExample?: boolean
  // 是否添加格式验证提示
  includeValidationHints?: boolean
  // 是否添加常见错误避免提示
  includeErrorPrevention?: boolean
  // 自定义格式指导
  customInstructions?: string[]
}

/**
 * 生成增强的 JSON 格式指导文本
 */
export function generateJsonFormatGuidance(
  schema: any,
  config: JsonFormatConfig = {}
): string {
  const {
    strictMode = true,
    includeExample = true,
    includeValidationHints = true,
    includeErrorPrevention = true,
    customInstructions = []
  } = config

  const guidance: string[] = []

  // 基础格式要求
  guidance.push('📋 JSON 输出格式要求：')
  guidance.push('- 必须返回有效的 JSON 格式，不能包含任何其他文本')
  guidance.push('- 使用双引号包围所有字符串字段')
  guidance.push('- 数组字段即使为空也要返回空数组 []')
  guidance.push('- 对象字段即使为空也要返回空对象 {}')
  guidance.push('- 不要在 JSON 末尾添加逗号')

  if (strictMode) {
    guidance.push('')
    guidance.push('🔒 严格模式要求：')
    guidance.push('- 所有必填字段都必须存在')
    guidance.push('- 字段类型必须与 schema 定义完全匹配')
    guidance.push('- 不要添加 schema 中未定义的额外字段')
    guidance.push('- 字符串字段不能为 null 或 undefined')
  }

  if (includeValidationHints) {
    guidance.push('')
    guidance.push('✅ 验证检查点：')
    guidance.push('- 确保 JSON 语法正确（括号匹配、逗号位置）')
    guidance.push('- 确保所有字符串使用双引号而非单引号')
    guidance.push('- 确保数组和对象的嵌套结构正确')
    guidance.push('- 确保数字字段不包含引号')
  }

  if (includeErrorPrevention) {
    guidance.push('')
    guidance.push('❌ 常见错误避免：')
    guidance.push('- 不要在 JSON 前后添加 ```json 代码块标记')
    guidance.push('- 不要在 JSON 中使用注释 // 或 /* */')
    guidance.push('- 不要使用 JavaScript 对象语法（如函数、undefined）')
    guidance.push('- 不要在最后一个字段后添加逗号')
    guidance.push('- 不要使用单引号包围字符串')
  }

  // 添加自定义指导
  if (customInstructions.length > 0) {
    guidance.push('')
    guidance.push('📝 特殊要求：')
    customInstructions.forEach(instruction => {
      guidance.push(`- ${instruction}`)
    })
  }

  // 生成示例（如果启用）
  if (includeExample && schema) {
    const example = generateSchemaExample(schema)
    if (example) {
      guidance.push('')
      guidance.push('📄 输出示例格式：')
      guidance.push('```')
      guidance.push(JSON.stringify(example, null, 2))
      guidance.push('```')
    }
  }

  return guidance.join('\n')
}

/**
 * 根据 schema 生成示例 JSON
 */
function generateSchemaExample(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return null
  }

  if (schema.type === 'object' && schema.properties) {
    const example: any = {}
    
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      example[key] = generatePropertyExample(propSchema as any, key)
    }
    
    return example
  }

  return generatePropertyExample(schema, 'root')
}

/**
 * 生成属性示例值
 */
function generatePropertyExample(propSchema: any, fieldName: string): any {
  if (!propSchema || typeof propSchema !== 'object') {
    return ''
  }

  switch (propSchema.type) {
    case 'string':
      if (propSchema.enum) {
        return propSchema.enum[0]
      }
      return getStringExample(fieldName)
    
    case 'number':
      if (propSchema.minimum !== undefined) {
        return propSchema.minimum
      }
      if (propSchema.maximum !== undefined) {
        return Math.min(propSchema.maximum, 100)
      }
      return getNumberExample(fieldName)
    
    case 'boolean':
      return true
    
    case 'array':
      if (propSchema.items) {
        const itemExample = generatePropertyExample(propSchema.items, fieldName)
        return [itemExample]
      }
      return []
    
    case 'object':
      if (propSchema.properties) {
        const objExample: any = {}
        for (const [key, subSchema] of Object.entries(propSchema.properties)) {
          objExample[key] = generatePropertyExample(subSchema as any, key)
        }
        return objExample
      }
      return {}
    
    default:
      return ''
  }
}

/**
 * 根据字段名生成合适的字符串示例
 */
function getStringExample(fieldName: string): string {
  const lowerField = fieldName.toLowerCase()
  
  if (lowerField.includes('name')) return '示例名称'
  if (lowerField.includes('title')) return '示例标题'
  if (lowerField.includes('company')) return '示例公司'
  if (lowerField.includes('role') || lowerField.includes('position')) return '示例职位'
  if (lowerField.includes('description')) return '示例描述内容'
  if (lowerField.includes('reason')) return '示例原因说明'
  if (lowerField.includes('content')) return '示例内容'
  if (lowerField.includes('summary')) return '示例摘要'
  if (lowerField.includes('script')) return '示例话术内容'
  if (lowerField.includes('intro')) return '示例介绍'
  if (lowerField.includes('question')) return '示例问题'
  if (lowerField.includes('framework')) return 'STAR'
  if (lowerField.includes('duration')) return '2020-2024'
  if (lowerField.includes('location')) return '北京'
  if (lowerField.includes('school')) return '示例大学'
  if (lowerField.includes('degree')) return '本科'
  if (lowerField.includes('major')) return '计算机科学'
  
  return '示例文本'
}

/**
 * 根据字段名生成合适的数字示例
 */
function getNumberExample(fieldName: string): number {
  const lowerField = fieldName.toLowerCase()
  
  if (lowerField.includes('score')) return 85
  if (lowerField.includes('year')) return 3
  if (lowerField.includes('experience')) return 5
  if (lowerField.includes('age')) return 28
  if (lowerField.includes('count')) return 10
  
  return 1
}

/**
 * 增强现有的 prompt 模板
 */
export function enhancePromptTemplate(
  template: PromptTemplate,
  config: JsonFormatConfig = {}
): PromptTemplate {
  if (!template.outputSchema) {
    return template
  }

  const formatGuidance = generateJsonFormatGuidance(template.outputSchema, config)
  
  // 在 userPrompt 中查找 JSON 格式部分并增强
  let enhancedUserPrompt = template.userPrompt
  
  // 查找现有的 JSON 格式说明
  const jsonFormatRegex = /请返回JSON格式[：:]\s*\{[\s\S]*?\}/
  const jsonFormatMatch = enhancedUserPrompt.match(jsonFormatRegex)
  
  if (jsonFormatMatch) {
    // 在现有 JSON 格式说明后添加增强指导
    const insertPosition = jsonFormatMatch.index! + jsonFormatMatch[0].length
    enhancedUserPrompt = 
      enhancedUserPrompt.slice(0, insertPosition) +
      '\n\n' + formatGuidance +
      enhancedUserPrompt.slice(insertPosition)
  } else {
    // 如果没有找到现有格式说明，在末尾添加
    enhancedUserPrompt += '\n\n' + formatGuidance
  }

  return {
    ...template,
    userPrompt: enhancedUserPrompt
  }
}

/**
 * 批量增强所有模板
 */
export function enhanceAllTemplates(
  templates: Record<string, PromptTemplate>,
  config: JsonFormatConfig = {}
): Record<string, PromptTemplate> {
  const enhanced: Record<string, PromptTemplate> = {}
  
  for (const [key, template] of Object.entries(templates)) {
    enhanced[key] = enhancePromptTemplate(template, config)
  }
  
  return enhanced
}

/**
 * 预定义的配置
 */
export const JSON_FORMAT_CONFIGS = {
  // 标准配置：平衡详细程度和简洁性
  standard: {
    strictMode: true,
    includeExample: true,
    includeValidationHints: true,
    includeErrorPrevention: true
  } as JsonFormatConfig,
  
  // 严格配置：最详细的指导，适用于复杂 schema
  strict: {
    strictMode: true,
    includeExample: true,
    includeValidationHints: true,
    includeErrorPrevention: true,
    customInstructions: [
      '输出的 JSON 必须能够通过 JSON.parse() 解析',
      '所有字段都必须严格按照 schema 定义的类型',
      '如果某个字段没有信息，使用合适的默认值而不是省略'
    ]
  } as JsonFormatConfig,
  
  // 简洁配置：最少的指导，适用于简单 schema
  minimal: {
    strictMode: false,
    includeExample: false,
    includeValidationHints: true,
    includeErrorPrevention: true
  } as JsonFormatConfig
} as const