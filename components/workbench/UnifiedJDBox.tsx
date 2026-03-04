'use client'
import React, { useCallback, useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ImageIcon } from 'lucide-react'

export function UnifiedJDBox({ dict, disabled, valueText, onChangeText, valueFile, onChangeFile }: { dict: any; disabled?: boolean; valueText: string; onChangeText: (v: string) => void; valueFile: File | null; onChangeFile: (f: File | null) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
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
    <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="flex flex-col flex-1 min-h-0 rounded-2xl border border-slate-200/60 dark:border-white/10 sm:border-[0.5px] sm:border-black/5 sm:dark:border-white/10 bg-slate-100/60 dark:bg-white/[0.08] sm:bg-white/50 sm:dark:bg-white/[0.02] backdrop-blur-md shadow-none sm:shadow-sm dark:shadow-none focus-within:ring-2 focus-within:ring-slate-900/20 sm:dark:focus-within:ring-white/20 focus-within:border-slate-400 dark:focus-within:border-slate-500 transition-all">
      {!valueFile ? (
        <div className="p-4 flex flex-col flex-1 min-h-0 relative">
          <Textarea
            className="border-0 focus:ring-0 focus-visible:ring-0 outline-none bg-transparent flex-1 w-full min-h-[120px] md:min-h-[160px] resize-none pb-14"
            value={valueText}
            onChange={(e) => onChangeText(e.target.value)}
            onPaste={onPaste}
            placeholder={dict.placeholderText}
            disabled={disabled}
          />
          <input
            ref={fileInputRef}
            name="jd_image"
            type="file"
            accept="image/*"
            disabled={disabled}
            onChange={(e) => onChangeFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-10">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-4 py-2 sm:px-3 sm:py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm border border-slate-200/50 dark:border-slate-700 disabled:opacity-50"
              disabled={disabled}
            >
              <ImageIcon className="w-4 h-4" />
              <span className="text-sm sm:text-xs font-medium">{dict.uploadCta || '上传截图'}</span>
            </button>
          </div>
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
