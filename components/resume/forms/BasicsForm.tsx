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
  Languages,
  Type,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState } from 'react'
import { SECTION_TITLES, SectionKey } from '../section-titles'
import { SOCIAL_PLATFORMS } from '../social-config'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { uiLog } from '@/lib/ui/sse-debug-logger'
import { useResumeDict } from '../ResumeDictContext'

export function BasicsForm() {
  const { resumeData, updateBasics, updateSectionTitle } = useResumeStore()
  const [isTitlesOpen, setIsTitlesOpen] = useState(false)
  const dict = useResumeDict()

  if (!resumeData) return null

  const basics = resumeData.basics
  const sectionTitles = resumeData.sectionTitles || {}

  const handleChange = (
    key: keyof ResumeData['basics'],
    value: string | undefined
  ) => {
    updateBasics({ [key]: value })
  }

  const handleTitleChange = (key: string, value: string) => {
    updateSectionTitle(key, value)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Limit increased to 2MB
    if (file.size > 2 * 1024 * 1024) {
      alert(dict.forms.avatarSizeLimit)
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
        uiLog.error('avatar_local_storage_failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-8">
      {/* Group: Language Selection (Moved Up) */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 border-b pb-2">
          <Languages className="w-4 h-4" />
          {dict.forms.titleLanguage}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          <div className="space-y-2">
            <Select
              value={basics.lang || 'zh'}
              onValueChange={(v) => handleChange('lang', v as 'zh' | 'en')}
            >
              <SelectTrigger className={formInputClass}>
                <SelectValue placeholder={dict.forms.selectLanguage} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文 (Chinese)</SelectItem>
                <SelectItem value="en">英文 (English)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Group 1: Core Information */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 border-b pb-2">
          <User className="w-4 h-4" />
          {dict.forms.coreInfo}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          {/* Avatar and Name */}
          <div className="flex flex-col gap-3 items-center sm:items-start">
            <Label className="text-xs font-medium text-gray-500">{dict.forms.avatar}</Label>
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
                  <span className="text-[10px] font-medium">{dict.forms.changeAvatar}</span>
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
              {dict.forms.avatarHint}
              <br />
              Max 2MB
            </p>
          </div>

          <div className="flex flex-col gap-4 justify-center">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-gray-600">
                <User className="w-3.5 h-3.5" />
                {dict.forms.name}
              </Label>
              <Input
                value={basics.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                className={formInputClass}
                placeholder={dict.forms.namePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-gray-600">
                <MapPin className="w-3.5 h-3.5" />
                {dict.forms.address}
              </Label>
              <Input
                value={basics.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                className={formInputClass}
                placeholder={dict.forms.addressPlaceholder}
              />
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-gray-600">
              <Phone className="w-3.5 h-3.5" />
              {dict.forms.phone}
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
              {dict.forms.email}
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
          {dict.forms.socialLinks}
        </h3>

        <div className="grid grid-cols-1 gap-y-5">
          {Object.values(SOCIAL_PLATFORMS).map((platform) => (
            <div key={platform.key} className="space-y-2">
              <Label className="flex items-center gap-1.5 text-gray-600">
                <platform.icon className="w-3.5 h-3.5" />
                {platform.label}
              </Label>
              <div className="flex rounded-md shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                {platform.urlPrefix && (
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-xs select-none">
                    {platform.domainDisplay}
                  </span>
                )}
                <Input
                  value={basics[platform.key] || ''}
                  onChange={(e) => {
                    let val = e.target.value
                    // Smart cleaning for standard platforms
                    if (
                      platform.key !== 'website' &&
                      val.includes(platform.domainDisplay)
                    ) {
                      val = val
                        .replace(/^https?:\/\/(www\.)?/, '')
                        .replace(platform.domainDisplay, '')
                    }
                    handleChange(platform.key, val)
                  }}
                  className={cn(
                    formInputClass,
                    platform.urlPrefix ? 'rounded-l-none' : '',
                    'focus-visible:ring-0 focus-visible:ring-offset-0' // Remove default input ring to use container ring
                  )}
                  placeholder={platform.placeholder}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
