'use client'
import React, { useCallback } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export function UnifiedJDBox({ dict, disabled, valueText, onChangeText, valueFile, onChangeFile }: { dict: any; disabled?: boolean; valueText: string; onChangeText: (v: string) => void; valueFile: File | null; onChangeFile: (f: File | null) => void }) {
  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (disabled) return
    const files = Array.from(e.dataTransfer.files || [])
    const img = files.find((f) => f.type.startsWith('image/'))
    if (img) onChangeFile(img)
  }, [disabled, onChangeFile])

  const onPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items || [])
    const imgItem = items.find((it) => it.type.startsWith('image/'))
    if (imgItem) {
      const f = imgItem.getAsFile()
      if (f) onChangeFile(f)
    }
  }, [onChangeFile])

  return (
    <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="rounded-xl border-[0.5px] border-black/5 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] backdrop-blur-md shadow-sm dark:shadow-none">
      {!valueFile ? (
        <div className="p-4">
          <Textarea className="border-0 focus:ring-0 focus-visible:ring-0 outline-none bg-transparent" value={valueText} onChange={(e) => onChangeText(e.target.value)} onPaste={onPaste} rows={10} placeholder={dict.placeholderText} disabled={disabled} />
          <input name="jd_image" type="file" accept="image/*" disabled={disabled} onChange={(e) => onChangeFile(e.target.files?.[0] || null)} className="sr-only" />
        </div>
      ) : (
        <div className="p-4 flex items-center justify-between">
          <div className="text-sm">{dict.selectedFile} {valueFile.name}</div>
          <Button type="button" variant="secondary" onClick={() => onChangeFile(null)} disabled={disabled}>移除</Button>
        </div>
      )}
    </div>
  )
}
