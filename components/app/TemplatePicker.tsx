'use client'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

export function TemplatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <RadioGroupItem id="tpl-classic" value="classic" />
        <Label htmlFor="tpl-classic">经典</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem id="tpl-modern" value="modern" />
        <Label htmlFor="tpl-modern">现代</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem id="tpl-professional" value="professional" />
        <Label htmlFor="tpl-professional">专业</Label>
      </div>
    </RadioGroup>
  )
}