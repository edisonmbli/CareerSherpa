import React from 'react'
import { cn } from '@/lib/utils'

import { SECTION_TITLES, SectionKey } from '../section-titles'
import { SOCIAL_PLATFORMS, SocialPlatformKey } from '../social-config'

export function getSectionTitle(
  sectionKey: string,
  lang: 'en' | 'zh' = 'en', // Default to Chinese as per request context, or use store state later
  userOverride?: string
) {
  if (userOverride && userOverride.trim()) return userOverride

  const key = sectionKey as SectionKey
  const titles = SECTION_TITLES[key]

  if (!titles) return sectionKey // Fallback to key if not found

  return titles[lang] || titles.en
}

export interface RenderDescriptionOptions {
  listClass?: string
  itemClass?: string
}

export function renderDescription(
  description?: string,
  options: RenderDescriptionOptions = {}
) {
  if (!description) return null

  // Preprocessing: Robustly handle potential LLM formatting artifacts
  const text = description
    // 1. Replace all variants of <br> tags with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // 2. Replace literal "\n" string if somehow escaped
    .replace(/\\n/g, '\n')

  // Primary split by newlines
  let lines = text.split('\n').filter((line) => line.trim() !== '')

  // Fallback: if there are few lines but content has "；" separators, split those too
  // This handles GLM Flash output that uses Chinese semicolons instead of newlines
  if (lines.length <= 2) {
    const expandedLines: string[] = []
    for (const line of lines) {
      // If line contains "；" and no explicit bullet marker, treat "；" as separator
      const trimmed = line.trim()
      const hasBulletMarker = /^(\d+\.|[-•*])\s*/.test(trimmed)
      if (!hasBulletMarker && trimmed.includes('；')) {
        // Split by Chinese semicolon and filter empty
        const subLines = trimmed.split('；').filter((s) => s.trim() !== '')
        expandedLines.push(...subLines)
      } else {
        expandedLines.push(line)
      }
    }
    lines = expandedLines
  }

  if (lines.length === 0) return null

  const {
    listClass = 'list-disc pl-4 space-y-0.5 my-1',
    itemClass = 'text-[length:inherit] leading-relaxed text-gray-700',
  } = options

  // Check if any line starts with a list marker to decide if we should strictly parse as list
  // The user requested that newlines should ALSO be parsed as list structure (implicit list)
  // So we will treat all newline-separated content as a list for better readability in resume

  return (
    <ul className={listClass}>
      {lines.map((line, i) => {
        const trimmed = line.trim()
        // Remove existing markers if present to avoid double bullets (numbers, dots, dashes)
        const cleanText = trimmed.replace(/^(\d+\.|[-•*])\s*/, '')

        return (
          <li key={i} className={itemClass}>
            {/* Simple Markdown Bold/Italic Parser */}
            {parseMarkdown(cleanText)}
          </li>
        )
      })}
    </ul>
  )
}

// Simple helper to parse **bold**, *italic*, and `code`
function parseMarkdown(text: string): React.ReactNode {
  // Split by bold pattern first
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g)

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-bold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="font-mono bg-slate-100 text-slate-900 px-1 py-0.5 rounded text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    // Handle italic inside non-bold/code parts (simplified)
    const italicParts = part.split(/(\*.*?\*)/g)
    return italicParts.map((subPart, subIndex) => {
      if (
        subPart.startsWith('*') &&
        subPart.endsWith('*') &&
        subPart.length > 2
      ) {
        return (
          <em key={`${index}-${subIndex}`} className="italic">
            {subPart.slice(1, -1)}
          </em>
        )
      }
      return subPart
    })
  })
}

export function formatDate(date?: string) {
  if (!date) return ''
  // Assuming YYYY-MM format or YYYY-MM-DD
  return date
}

export function renderSocialItem(key: string, value: string) {
  if (!value) return null
  const platform = SOCIAL_PLATFORMS[key as SocialPlatformKey]
  if (!platform) return null

  let displayLabel = value
  let href = value

  if (key === 'website') {
    // Personal Website: Remove protocol for display, ensure protocol for href
    displayLabel = value
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/^http?:\/\/(www\.)?/, '')
      .replace(/\/$/, '')
    href = value.startsWith('http') ? value : `https://${value}`
  } else {
    // Standard Platforms: Value is username OR full URL (legacy)
    if (value.match(/^https?:\/\//)) {
      // It's a URL
      href = value
      // Clean for display: remove protocol and domain
      displayLabel = value.replace(/^https?:\/\/(www\.)?/, '')
      if (displayLabel.startsWith(platform.domainDisplay)) {
        displayLabel = displayLabel.replace(platform.domainDisplay, '')
      }
    } else {
      // It's a username
      href = `${platform.urlPrefix}${value}`
      displayLabel = value
    }
  }

  return { displayLabel, href, icon: platform.icon, label: platform.label }
}
