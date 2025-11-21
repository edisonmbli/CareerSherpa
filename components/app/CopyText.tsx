'use client'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

export function CopyText({ text, dict, mode = 'full' }: { text: string; dict: any; mode?: 'full' | 'compact' }) {
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(dict.toast?.copied || 'Copied', { description: text })
    } catch {}
  }
  return (
    <div className="flex items-center gap-2">
      {mode === 'full' && <span className="font-mono truncate max-w-[12rem]">{text}</span>}
      <Button variant="ghost" size="icon" onClick={onCopy} aria-label={dict.toast?.copyAria || 'Copy'}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  )
}