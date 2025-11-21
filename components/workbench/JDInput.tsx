'use client'
import { useState, useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Clipboard, FileUp } from 'lucide-react'

export function JDInput({ dict, disabled, valueText, onChangeText, valueFile, onChangeFile }: { dict: any; disabled?: boolean; valueText: string; onChangeText: (v: string) => void; valueFile: File | null; onChangeFile: (f: File | null) => void }) {
  const [mode, setMode] = useState<'paste' | 'upload'>('paste')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border bg-muted p-1">
        <Button type="button" variant={mode === 'paste' ? 'secondary' : 'ghost'} size="sm" onClick={() => setMode('paste')} disabled={disabled} className="gap-2"><Clipboard className="h-4 w-4" />{dict.segmentedPaste}</Button>
        <Button type="button" variant={mode === 'upload' ? 'secondary' : 'ghost'} size="sm" onClick={() => setMode('upload')} disabled={disabled} className="gap-2"><FileUp className="h-4 w-4" />{dict.segmentedUpload}</Button>
      </div>
      {mode === 'paste' ? (
        <Textarea value={valueText} onChange={(e) => onChangeText(e.target.value)} rows={10} placeholder={dict.placeholderText} disabled={disabled} />
      ) : (
        <div className="flex items-center gap-3">
          <input ref={fileInputRef} name="jd_image" type="file" accept="image/*" disabled={disabled} onChange={(e) => onChangeFile(e.target.files?.[0] || null)} className="sr-only" />
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={disabled}>{dict.uploadCta}</Button>
          <div className="text-sm text-muted-foreground">{valueFile ? `${dict.selectedFile} ${valueFile.name}` : dict.noFile}</div>
        </div>
      )}
    </div>
  )
}