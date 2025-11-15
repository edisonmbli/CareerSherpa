'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Check } from 'lucide-react'

export default function PrimaryDemo({ labels }: { labels: { default: string; disabled: string; focus: string } }) {
  const [disabled, setDisabled] = React.useState(false)
  const focusRef = React.useRef<HTMLButtonElement | null>(null)

  React.useEffect(() => {
    // 初次渲染后，为了演示焦点环，主动 focus 一次
    const t = setTimeout(() => focusRef.current?.focus(), 300)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button>
          <Sparkles className="mr-2 h-4 w-4" />
          {labels.default}
        </Button>
        <Button ref={focusRef} variant="default">
          <Check className="mr-2 h-4 w-4" />
          {labels.focus}
        </Button>
        <Button disabled={disabled} onClick={() => setDisabled(true)}>
          {labels.disabled}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Hover/Active 由系统交互触发；Disabled 按钮点击后进入禁用以验证对比度与可读性。
      </p>
    </div>
  )
}