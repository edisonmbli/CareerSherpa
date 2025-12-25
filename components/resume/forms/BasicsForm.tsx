'use client'

import { useResumeStore } from '@/store/resume-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResumeData } from '@/lib/types/resume-schema'
import { formInputClass } from './styles'
import {
  User,
  MapPin,
  Phone,
  Mail,
  Globe,
  Github,
  Linkedin,
  Twitter,
  Dribbble,
  Palette,
  Upload,
} from 'lucide-react'

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
    <div className="space-y-8">
      {/* Group 1: Core Information */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 border-b pb-2">
          <User className="w-4 h-4" />
          核心信息
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          {/* Avatar and Name */}
          <div className="flex flex-col gap-3 items-center sm:items-start">
            <Label className="text-xs font-medium text-gray-500">头像</Label>
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-100 bg-gray-50 dark:bg-secondary/50 dark:border-gray-800 flex items-center justify-center shadow-sm">
                {basics.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={basics.photoUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-gray-300" />
                )}
              </div>
              <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer rounded-full backdrop-blur-[1px]">
                <div className="flex flex-col items-center gap-1 text-white">
                  <Upload className="w-4 h-4" />
                  <span className="text-[10px] font-medium">更换</span>
                </div>
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

          <div className="flex flex-col gap-4 justify-center">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-gray-600">
                <User className="w-3.5 h-3.5" />
                姓名
              </Label>
              <Input
                value={basics.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                className={formInputClass}
                placeholder="您的姓名"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-gray-600">
                <MapPin className="w-3.5 h-3.5" />
                地址
              </Label>
              <Input
                value={basics.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                className={formInputClass}
                placeholder="例如：北京市海淀区"
              />
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-gray-600">
              <Phone className="w-3.5 h-3.5" />
              手机
            </Label>
            <Input
              value={basics.mobile || ''}
              onChange={(e) => handleChange('mobile', e.target.value)}
              className={formInputClass}
              placeholder="+86 188..."
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-gray-600">
              <Mail className="w-3.5 h-3.5" />
              邮箱
            </Label>
            <Input
              value={basics.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              className={formInputClass}
              placeholder="example@email.com"
            />
          </div>
        </div>
      </div>

      {/* Group 2: Social Links */}
      <div className="space-y-4 pt-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 border-b pb-2">
          <Globe className="w-4 h-4" />
          社交链接
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-gray-600">
              <Github className="w-3.5 h-3.5" />
              GitHub
            </Label>
            <Input
              value={basics.github || ''}
              onChange={(e) => handleChange('github', e.target.value)}
              className={formInputClass}
              placeholder="github.com/username"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-gray-600">
              <Linkedin className="w-3.5 h-3.5" />
              LinkedIn
            </Label>
            <Input
              value={basics.linkedin || ''}
              onChange={(e) => handleChange('linkedin', e.target.value)}
              className={formInputClass}
              placeholder="linkedin.com/in/username"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-gray-600">
              <Globe className="w-3.5 h-3.5" />
              个人网站
            </Label>
            <Input
              value={basics.website || ''}
              onChange={(e) => handleChange('website', e.target.value)}
              className={formInputClass}
              placeholder="your-portfolio.com"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-gray-600">
              <Twitter className="w-3.5 h-3.5" />
              Twitter / X
            </Label>
            <Input
              value={basics.twitter || ''}
              onChange={(e) => handleChange('twitter', e.target.value)}
              className={formInputClass}
              placeholder="twitter.com/username"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-gray-600">
              <Palette className="w-3.5 h-3.5" />
              Behance
            </Label>
            <Input
              value={basics.behance || ''}
              onChange={(e) => handleChange('behance', e.target.value)}
              className={formInputClass}
              placeholder="behance.net/user"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-gray-600">
              <Dribbble className="w-3.5 h-3.5" />
              Dribbble
            </Label>
            <Input
              value={basics.dribbble || ''}
              onChange={(e) => handleChange('dribbble', e.target.value)}
              className={formInputClass}
              placeholder="dribbble.com/user"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
