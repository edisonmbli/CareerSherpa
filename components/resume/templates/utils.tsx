import React from 'react'
import { cn } from '@/lib/utils'

export function renderDescription(description?: string) {
  if (!description) return null

  const lines = description.split('\n').filter((line) => line.trim() !== '')

  if (lines.length === 0) return null

  // Check if any line starts with a list marker to decide if we should strictly parse as list
  // The user requested that newlines should ALSO be parsed as list structure (implicit list)
  // So we will treat all newline-separated content as a list for better readability in resume

  return (
    <ul className="list-disc pl-4 space-y-0.5 my-1">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        // Remove existing markers if present to avoid double bullets
        // Updated regex to be more permissive (allow no space after marker, though rare, and standard markers)
        const cleanText = trimmed.replace(/^[-•]\s*/, '')

        return (
          <li
            key={i}
            className="text-[length:inherit] leading-relaxed text-gray-700"
          >
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
