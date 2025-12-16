'use client'

import { useResumeStore } from '@/store/resume-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResumeData } from '@/lib/types/resume-schema'

export function BasicsForm() {
  const { resumeData, updateBasics } = useResumeStore()

  if (!resumeData) return null

  const basics = resumeData.basics

  const handleChange = (key: keyof ResumeData['basics'], value: string) => {
    updateBasics({ [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>姓名</Label>
          <Input
            value={basics.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
          />
        </div>
        {/* Summary is handled in SummaryForm */}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>手机</Label>
          <Input
            value={basics.mobile || ''}
            onChange={(e) => handleChange('mobile', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>邮箱</Label>
          <Input
            value={basics.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>微信</Label>
          <Input
            value={basics.wechat || ''}
            onChange={(e) => handleChange('wechat', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>QQ</Label>
          <Input
            value={basics.qq || ''}
            onChange={(e) => handleChange('qq', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
