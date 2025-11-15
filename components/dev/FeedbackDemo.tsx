'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'

type Kind = 'info' | 'success' | 'warning' | 'destructive'

interface Labels {
  showInfo: string
  showSuccess: string
  showWarning: string
  showError: string
  infoTitle: string
  successTitle: string
  warningTitle: string
  errorTitle: string
  infoDesc: string
  successDesc: string
  warningDesc: string
  errorDesc: string
}

export default function FeedbackDemo({ labels }: { labels: Labels }) {
  const [kind, setKind] = React.useState<Kind | null>(null)

  React.useEffect(() => {
    if (!kind) return
    const t = setTimeout(() => setKind(null), 2500)
    return () => clearTimeout(t)
  }, [kind])

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setKind('info')}>
          {labels.showInfo}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setKind('success')}
        >
          {labels.showSuccess}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setKind('warning')}>
          {labels.showWarning}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setKind('destructive')}
        >
          {labels.showError}
        </Button>
      </div>
      <div className="relative h-0">
        {kind && triggerToast(kind, labels)}
      </div>
    </div>
  )
}

function titleFor(k: Kind, labels: Labels) {
  if (k === 'success') return labels.successTitle
  if (k === 'warning') return labels.warningTitle
  if (k === 'destructive') return labels.errorTitle
  return labels.infoTitle
}

function descFor(k: Kind, labels: Labels) {
  if (k === 'success') return labels.successDesc
  if (k === 'warning') return labels.warningDesc
  if (k === 'destructive') return labels.errorDesc
  return labels.infoDesc
}

function triggerToast(k: Kind, labels: Labels) {
  const title = titleFor(k, labels)
  const desc = descFor(k, labels)
  if (k === 'success') return toast.success(desc, { description: title })
  if (k === 'warning') return toast.warning(desc, { description: title })
  if (k === 'destructive') return toast.error(desc, { description: title })
  return toast.info(desc, { description: title })
}
