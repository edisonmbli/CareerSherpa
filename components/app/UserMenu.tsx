'use client'
import { useUser } from '@stackframe/stack'
import Link from 'next/link'
import Image from 'next/image'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function UserMenu({ locale, dict }: { locale: string; dict: { assets: string; billing: string } }) {
  const user = useUser()
  const avatarUrl = (user as any)?.profileImageUrl || ''
  const display = avatarUrl ? '' : ((user as any)?.name || (user as any)?.username || (locale === 'zh' ? '我的账户' : 'My Account'))
  const onSignOut = async () => {
    try { await user?.signOut?.() } catch {}
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="rounded-full">
          {avatarUrl ? (<Image src={avatarUrl} alt="avatar" width={24} height={24} className="h-6 w-6 rounded-full" />) : (<span>{display}</span>)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          {avatarUrl ? (<Image src={avatarUrl} alt="avatar" width={24} height={24} className="h-6 w-6 rounded-full" />) : (<div className="h-6 w-6 rounded-full bg-muted" />)}
          <span className="truncate">{display}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/account`}>{locale === 'zh' ? '账户设置' : 'Account Settings'}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/profile?tab=assets`}>{dict.assets}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/profile?tab=billing`}>{dict.billing}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}