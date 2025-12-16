import { Loader2 } from 'lucide-react'

interface BatchProgressPanelProps {
  title: string
  description: string
  progress?: number
}

export function BatchProgressPanel({
  title,
  description,
  progress = 66,
}: BatchProgressPanelProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6 border rounded-md bg-card min-h-[300px]">
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        {/* Progress bar removed as it duplicates the global status console */}
      </div>
    </div>
  )
}
