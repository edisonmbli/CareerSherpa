'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppCard, AppCardHeader, AppCardTitle, AppCardDescription, AppCardContent } from '@/components/app/AppCard'
import { User, Image as ImageIcon, Mail, Lock, ExternalLink } from 'lucide-react'

export function AccountSettingsClient({ locale, dict }: { locale: 'en' | 'zh'; dict: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
      <AppCard>
        <AppCardHeader>
          <div className="flex items-center justify-between">
            <div>
              <AppCardTitle className="flex items-center gap-2"><User className="h-5 w-5" />{dict.shortcuts.profileName.title}</AppCardTitle>
              <AppCardDescription>{dict.shortcuts.profileName.desc}</AppCardDescription>
            </div>
            <Link href={`/handler/account-settings#profile`} aria-label={dict.shortcuts.open} className="inline-flex items-center">
              <ExternalLink className="h-5 w-5" />
            </Link>
          </div>
        </AppCardHeader>
      </AppCard>

      <AppCard>
        <AppCardHeader>
          <div className="flex items-center justify-between">
            <div>
              <AppCardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" />{dict.shortcuts.profileAvatar.title}</AppCardTitle>
              <AppCardDescription>{dict.shortcuts.profileAvatar.desc}</AppCardDescription>
            </div>
            <Link href={`/handler/account-settings#profile`} aria-label={dict.shortcuts.open} className="inline-flex items-center">
              <ExternalLink className="h-5 w-5" />
            </Link>
          </div>
        </AppCardHeader>
      </AppCard>

      <AppCard>
        <AppCardHeader>
          <div className="flex items-center justify-between">
            <div>
              <AppCardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />{dict.shortcuts.email.title}</AppCardTitle>
              <AppCardDescription>{dict.shortcuts.email.desc}</AppCardDescription>
            </div>
            <Link href={`/handler/account-settings#auth`} aria-label={dict.shortcuts.open} className="inline-flex items-center">
              <ExternalLink className="h-5 w-5" />
            </Link>
          </div>
        </AppCardHeader>
      </AppCard>

      <AppCard>
        <AppCardHeader>
          <div className="flex items-center justify-between">
            <div>
              <AppCardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />{dict.shortcuts.password.title}</AppCardTitle>
              <AppCardDescription>{dict.shortcuts.password.desc}</AppCardDescription>
            </div>
            <Link href={`/handler/account-settings#auth`} aria-label={dict.shortcuts.open} className="inline-flex items-center">
              <ExternalLink className="h-5 w-5" />
            </Link>
          </div>
        </AppCardHeader>
      </AppCard>
    </div>
  )
}