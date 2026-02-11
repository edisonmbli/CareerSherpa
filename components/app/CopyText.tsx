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
      {mode === 'full' && (
        <span className="font-mono truncate max-w-[12rem]">{text}</span>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onCopy}
        aria-label={dict.toast?.copyAria || 'Copy'}
        className="h-7 w-7 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
