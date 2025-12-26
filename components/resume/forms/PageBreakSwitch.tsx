import { useResumeStore } from '@/store/resume-store'
import { Switch } from '../../ui/switch'
import { Label } from '@/components/ui/label'

interface PageBreakSwitchProps {
  sectionKey: string
}

export function PageBreakSwitch({ sectionKey }: PageBreakSwitchProps) {
  const { sectionConfig, togglePageBreak } = useResumeStore()
  const isChecked = sectionConfig.pageBreaks?.[sectionKey] || false

  return (
    <div className="flex items-center justify-between py-4 border-t mt-4">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">底部插入分页符</Label>
        <p className="text-xs text-muted-foreground">强制在此内容后另起一页</p>
      </div>
      <Switch
        checked={isChecked}
        onCheckedChange={() => togglePageBreak(sectionKey)}
      />
    </div>
  )
}
