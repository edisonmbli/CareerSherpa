import { useResumeStore } from '@/store/resume-store'
import { Switch } from '../../ui/switch'
import { Label } from '@/components/ui/label'
import { useResumeDict } from '../ResumeDictContext'

interface PageBreakSwitchProps {
  sectionKey: string
}

export function PageBreakSwitch({ sectionKey }: PageBreakSwitchProps) {
  const { sectionConfig, togglePageBreak } = useResumeStore()
  const dict = useResumeDict()
  const isChecked = sectionConfig.pageBreaks?.[sectionKey] || false

  return (
    <div className="flex items-center justify-between py-4 border-t mt-4">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{dict.forms.pageBreak}</Label>
        <p className="text-xs text-muted-foreground">{dict.forms.pageBreakDesc}</p>
      </div>
      <Switch
        checked={isChecked}
        onCheckedChange={() => togglePageBreak(sectionKey)}
      />
    </div>
  )
}
