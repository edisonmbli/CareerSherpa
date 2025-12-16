import React from 'react'

export function renderDescription(description?: string) {
  if (!description) return null
  return (
    <ul className="list-disc pl-4 space-y-0.5">
      {description.split('\n').map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return null
        return <li key={i} className="text-sm leading-relaxed text-gray-700">{trimmed}</li>
      })}
    </ul>
  )
}

export function formatDate(date?: string) {
  if (!date) return ''
  // Assuming YYYY-MM format or YYYY-MM-DD
  return date
}
