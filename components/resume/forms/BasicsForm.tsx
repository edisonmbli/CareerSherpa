'use client'

import { useResumeStore } from '@/store/resume-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResumeData } from '@/lib/types/resume-schema'

import { formInputClass } from './styles'

export function BasicsForm() {
  const { resumeData, updateBasics } = useResumeStore()

  if (!resumeData) return null

  const basics = resumeData.basics

  const handleChange = (key: keyof ResumeData['basics'], value: string) => {
    updateBasics({ [key]: value })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Limit increased to 2MB
    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      handleChange('photoUrl', result)
      // Save to localStorage for persistence across reloads (MVP)
      try {
        localStorage.setItem('user_avatar', result)
      } catch (err) {
        console.error('Failed to save avatar to localStorage', err)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
      {/* Row 1: Avatar and Name */}
      <div className="flex flex-col gap-3 items-center sm:items-start">
        <Label>头像</Label>
        <div className="relative group">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-100 bg-gray-50 dark:bg-secondary/50 dark:border-gray-800 flex items-center justify-center">
            {basics.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={basics.photoUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-gray-300 text-xs">上传头像</span>
            )}
          </div>
          <label className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
            <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">
              更换
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
        <p className="text-[10px] text-muted-foreground text-center sm:text-left w-24 leading-tight">
          支持 jpg/png
          <br />
          Max 2MB
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label>姓名</Label>
          <Input
            value={basics.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            className={formInputClass}
            placeholder="您的姓名"
          />
        </div>
        <div className="space-y-2">
          <Label>地址</Label>
          <Input
            value={basics.address || ''}
            onChange={(e) => handleChange('address', e.target.value)}
            className={formInputClass}
            placeholder="例如：北京市海淀区"
          />
        </div>
      </div>

      {/* Row 2: Mobile and Email */}
      <div className="space-y-2">
        <Label>手机</Label>
        <Input
          value={basics.mobile || ''}
          onChange={(e) => handleChange('mobile', e.target.value)}
          className={formInputClass}
          placeholder="+86 188..."
        />
      </div>
      <div className="space-y-2">
        <Label>邮箱</Label>
        <Input
          value={basics.email || ''}
          onChange={(e) => handleChange('email', e.target.value)}
          className={formInputClass}
          placeholder="example@email.com"
        />
      </div>

      {/* Row 3: WeChat and QQ */}
      <div className="space-y-2">
        <Label>微信</Label>
        <Input
          value={basics.wechat || ''}
          onChange={(e) => handleChange('wechat', e.target.value)}
          className={formInputClass}
        />
      </div>
      <div className="space-y-2">
        <Label>QQ</Label>
        <Input
          value={basics.qq || ''}
          onChange={(e) => handleChange('qq', e.target.value)}
          className={formInputClass}
        />
      </div>
      <div className="space-y-2">
        <Label>GitHub</Label>
        <Input
          value={basics.github || ''}
          onChange={(e) => handleChange('github', e.target.value)}
          className={formInputClass}
          placeholder="github.com/username"
        />
      </div>

      <div className="space-y-2">
        <Label>LinkedIn</Label>
        <Input
          value={basics.linkedin || ''}
          onChange={(e) => handleChange('linkedin', e.target.value)}
          className={formInputClass}
          placeholder="linkedin.com/in/username"
        />
      </div>

      <div className="space-y-2">
        <Label>个人网站</Label>
        <Input
          value={basics.website || ''}
          onChange={(e) => handleChange('website', e.target.value)}
          className={formInputClass}
          placeholder="your-portfolio.com"
        />
      </div>

      <div className="space-y-2">
        <Label>Twitter / X</Label>
        <Input
          value={basics.twitter || ''}
          onChange={(e) => handleChange('twitter', e.target.value)}
          className={formInputClass}
          placeholder="twitter.com/username"
        />
      </div>

      <div className="space-y-2">
        <Label>Behance</Label>
        <Input
          value={basics.behance || ''}
          onChange={(e) => handleChange('behance', e.target.value)}
          className={formInputClass}
          placeholder="behance.net/user"
        />
      </div>
      <div className="space-y-2">
        <Label>Dribbble</Label>
        <Input
          value={basics.dribbble || ''}
          onChange={(e) => handleChange('dribbble', e.target.value)}
          className={formInputClass}
          placeholder="dribbble.com/user"
        />
      </div>
    </div>
  )
}
