import { Loader2, AlertCircle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BatchProgressPanelProps {
  title: string
  description: string
  progress?: number
  mode?: 'processing' | 'error'
  onRetry?: () => void
  isRetryLoading?: boolean
  retryLabel?: string
}

export function BatchProgressPanel({
  title,
  description,
  progress = 66,
  mode = 'processing',
  onRetry,
  isRetryLoading = false,
  retryLabel = '重试',
}: BatchProgressPanelProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6 border rounded-md bg-card min-h-[300px]">
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="flex flex-col items-center gap-3">
          {mode === 'error' ? (
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          )}
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>

        {mode === 'error' && onRetry && (
          <div className="pt-2">
            <Button
              onClick={onRetry}
              disabled={isRetryLoading}
              variant="outline"
              className="gap-2"
            >
              {isRetryLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {retryLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

